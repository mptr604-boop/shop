import assert from "node:assert/strict";
import { createHash, scryptSync } from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { CreateOrderInput } from "@shop/contracts";
import { app } from "../../app.js";
import { closeDatabase, pool } from "../../db/client.js";
import { expirePendingOrders } from "./orders.repository.js";

const customer: CreateOrderInput = {
  customerName: "Testowy Klient",
  email: "test@example.com",
  street: "Testowa 1",
  postalCode: "00-001",
  city: "Warszawa",
};

let server: ReturnType<typeof app.listen>;
let baseUrl: string;
const adminEnvKeys = [
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD_HASH",
] as const;
const previousAdminEnv = new Map(
  adminEnvKeys.map((key) => [key, process.env[key]]),
);

async function createTestCart() {
  const response = await fetch(`${baseUrl}/cart`);
  assert.equal(response.status, 200);

  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "API should set the guest cart cookie");
  return setCookie.split(";", 1)[0];
}

async function deleteTestCart(cookie: string) {
  const token = cookie.slice(cookie.indexOf("=") + 1);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM orders
       WHERE cart_id = (SELECT id FROM carts WHERE token_hash = $1)`,
      [tokenHash],
    );
    await client.query("DELETE FROM carts WHERE token_hash = $1", [tokenHash]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function addSeedProduct(cookie: string) {
  const productResponse = await fetch(`${baseUrl}/products/kawa-ziarnista`);
  assert.equal(productResponse.status, 200);
  const product = (await productResponse.json()) as {
    id: string;
    slug: string;
    priceInCents: number;
    stockQuantity: number;
  };

  const response = await fetch(`${baseUrl}/cart/items`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ slug: product.slug, quantity: 2 }),
  });
  assert.equal(response.status, 200);

  return product;
}

async function restoreProductStock(productId: string, stockQuantity: number) {
  await pool.query("UPDATE products SET stock_quantity = $1 WHERE id = $2", [
    stockQuantity,
    productId,
  ]);
}

describe("orders API", () => {
  before(async () => {
    const salt = Buffer.from("a".repeat(32), "hex");
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.ADMIN_PASSWORD_HASH = `${salt.toString("hex")}$${scryptSync(
      "correct horse battery staple",
      salt,
      64,
    ).toString("hex")}`;
    server = app.listen(0);
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not determine the integration test server port.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
    await pool.query("SELECT 1");
  });

  after(async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    } finally {
      await closeDatabase();
      for (const key of adminEnvKeys) {
        const value = previousAdminEnv.get(key);
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it("protects admin operations and allows inventory management", async () => {
    const openApiResponse = await fetch(`${baseUrl}/openapi.json`);
    assert.equal(openApiResponse.status, 200);
    const openApi = (await openApiResponse.json()) as {
      paths: Record<string, unknown>;
    };
    assert.deepEqual(
      Object.keys(openApi.paths)
        .filter((path) => path.startsWith("/admin"))
        .sort(),
      [
        "/admin/dashboard",
        "/admin/login",
        "/admin/logout",
        "/admin/products",
        "/admin/products/{id}",
        "/admin/products/{id}/stock",
        "/admin/session",
      ],
    );
    const loginDocumentation = openApi.paths["/admin/login"] as {
      post: { responses: Record<string, unknown> };
    };
    const dashboardDocumentation = openApi.paths["/admin/dashboard"] as {
      get: { responses: Record<string, unknown> };
    };
    const productDocumentation = openApi.paths["/admin/products"] as {
      post: { responses: Record<string, unknown> };
    };
    const productIdDocumentation = openApi.paths["/admin/products/{id}"] as {
      patch: { responses: Record<string, unknown> };
      delete: { responses: Record<string, unknown> };
    };
    assert.deepEqual(
      Object.keys(loginDocumentation.post.responses).sort(),
      ["200", "401", "503"],
    );
    assert.deepEqual(
      Object.keys(dashboardDocumentation.get.responses).sort(),
      ["200", "401"],
    );
    assert.deepEqual(
      Object.keys(productDocumentation.post.responses).sort(),
      ["201", "400", "409"],
    );
    assert.deepEqual(
      Object.keys(productIdDocumentation.patch.responses).sort(),
      ["200", "400", "404", "409"],
    );
    assert.deepEqual(
      Object.keys(productIdDocumentation.delete.responses).sort(),
      ["204", "400", "404"],
    );

    const unauthenticated = await fetch(`${baseUrl}/admin/dashboard`);
    assert.equal(unauthenticated.status, 401);

    const badLogin = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@example.com",
        password: "incorrect password",
      }),
    });
    assert.equal(badLogin.status, 401);

    const login = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@example.com",
        password: "correct horse battery staple",
      }),
    });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get("set-cookie");
    assert.ok(setCookie);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    assert.match(setCookie, /Path=\//i);
    const cookie = setCookie.split(";", 1)[0];

    const dashboard = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Cookie: cookie },
    });
    assert.equal(dashboard.status, 200);
    const body = await dashboard.json();
    assert.ok(body.products.length > 0);
    assert.ok(Array.isArray(body.orders));

    const product = body.products[0] as {
      id: string;
      stockQuantity: number;
    };
    const invalidUpdate = await fetch(
      `${baseUrl}/admin/products/${product.id}/stock`,
      {
        method: "PATCH",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ stockQuantity: -1 }),
      },
    );
    assert.equal(invalidUpdate.status, 400);

    const updatedStock = product.stockQuantity + 7;
    try {
      const update = await fetch(
        `${baseUrl}/admin/products/${product.id}/stock`,
        {
          method: "PATCH",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ stockQuantity: updatedStock }),
        },
      );
      assert.equal(update.status, 200);
      assert.equal((await update.json()).stockQuantity, updatedStock);
    } finally {
      await restoreProductStock(product.id, product.stockQuantity);
    }

    const testSlug = `test-admin-product-${Date.now()}`;
    const productInput = {
      name: "Produkt testowy admina",
      slug: testSlug,
      description: "Testowa edycja produktu.",
      priceInCents: 1234,
      currency: "PLN",
      stockQuantity: 5,
    };
    const invalidProduct = await fetch(`${baseUrl}/admin/products`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ ...productInput, slug: "Niepoprawny slug!" }),
    });
    assert.equal(invalidProduct.status, 400);

    const createdProductResponse = await fetch(`${baseUrl}/admin/products`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(productInput),
    });
    assert.equal(createdProductResponse.status, 201);
    const createdProduct = await createdProductResponse.json();

    try {
      const duplicateSlug = await fetch(`${baseUrl}/admin/products`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productInput,
          name: "Inny produkt testowy",
        }),
      });
      assert.equal(duplicateSlug.status, 409);

      const updatedProductResponse = await fetch(
        `${baseUrl}/admin/products/${createdProduct.id}`,
        {
          method: "PATCH",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            ...productInput,
            name: "Zmieniony produkt testowy",
            slug: `${testSlug}-zmieniony`,
            stockQuantity: 8,
          }),
        },
      );
      assert.equal(updatedProductResponse.status, 200);
      assert.equal(
        (await updatedProductResponse.json()).name,
        "Zmieniony produkt testowy",
      );

      const deleteResponse = await fetch(
        `${baseUrl}/admin/products/${createdProduct.id}`,
        { method: "DELETE", headers: { Cookie: cookie } },
      );
      assert.equal(deleteResponse.status, 204);
      assert.equal(await deleteResponse.text(), "");
      const deletedAgain = await fetch(
        `${baseUrl}/admin/products/${createdProduct.id}`,
        { method: "DELETE", headers: { Cookie: cookie } },
      );
      assert.equal(deletedAgain.status, 404);
    } finally {
      await pool.query("DELETE FROM products WHERE id = $1", [
        createdProduct.id,
      ]);
    }

    const logout = await fetch(`${baseUrl}/admin/logout`, {
      method: "POST",
      headers: { Cookie: cookie },
    });
    assert.equal(logout.status, 200);
    const protectedAfterLogout = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Cookie: cookie },
    });
    assert.equal(protectedAfterLogout.status, 401);
  });

  it("adds, updates, and removes a cart item", async (context) => {
    const cookie = await createTestCart();
    context.after(() => deleteTestCart(cookie));
    const product = await addSeedProduct(cookie);

    const updatedResponse = await fetch(
      `${baseUrl}/cart/items/${product.slug}`,
      {
        method: "PATCH",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: 3 }),
      },
    );
    assert.equal(updatedResponse.status, 200);
    assert.equal((await updatedResponse.json()).items[0].quantity, 3);

    const removedResponse = await fetch(
      `${baseUrl}/cart/items/${product.slug}`,
      {
        method: "DELETE",
        headers: { Cookie: cookie },
      },
    );
    assert.equal(removedResponse.status, 200);
    assert.deepEqual((await removedResponse.json()).items, []);
  });

  it("rejects an invalid cart quantity and an unknown product", async (context) => {
    const cookie = await createTestCart();
    context.after(() => deleteTestCart(cookie));
    const headers = { Cookie: cookie, "Content-Type": "application/json" };

    const invalidQuantity = await fetch(`${baseUrl}/cart/items`, {
      method: "POST",
      headers,
      body: JSON.stringify({ slug: "kawa-ziarnista", quantity: 100 }),
    });
    assert.equal(invalidQuantity.status, 400);

    const unknownProduct = await fetch(`${baseUrl}/cart/items`, {
      method: "POST",
      headers,
      body: JSON.stringify({ slug: "not-a-real-product", quantity: 1 }),
    });
    assert.equal(unknownProduct.status, 404);
  });

  it("rejects adding more items than are in stock", async (context) => {
    const cookie = await createTestCart();
    const product = await addSeedProduct(cookie);
    context.after(async () => {
      await deleteTestCart(cookie);
      await restoreProductStock(product.id, product.stockQuantity);
    });
    await pool.query("UPDATE products SET stock_quantity = 1 WHERE id = $1", [
      product.id,
    ]);

    const response = await fetch(`${baseUrl}/cart/items`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ slug: product.slug, quantity: 1 }),
    });

    assert.equal(response.status, 409);

    const updateResponse = await fetch(
      `${baseUrl}/cart/items/${product.slug}`,
      {
        method: "PATCH",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: 2 }),
      },
    );
    assert.equal(updateResponse.status, 409);
  });

  it("creates an order, snapshots its items, and empties the cart", async (context) => {
    const cookie = await createTestCart();
    const product = await addSeedProduct(cookie);
    context.after(async () => {
      await deleteTestCart(cookie);
      await restoreProductStock(product.id, product.stockQuantity);
    });

    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(customer),
    });
    assert.equal(response.status, 201);

    const order = await response.json();
    assert.equal(order.status, "pending_payment");
    assert.ok(Date.parse(order.expiresAt) > Date.now());
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].quantity, 2);
    assert.equal(order.items[0].unitPriceInCents, product.priceInCents);
    assert.equal(order.totalInCents, product.priceInCents * 2);

    const savedOrderResponse = await fetch(`${baseUrl}/orders/${order.id}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(savedOrderResponse.status, 200);
    assert.equal((await savedOrderResponse.json()).id, order.id);

    const cartResponse = await fetch(`${baseUrl}/cart`, {
      headers: { Cookie: cookie },
    });
    assert.equal(cartResponse.status, 200);
    assert.deepEqual((await cartResponse.json()).items, []);
  });

  it("rejects invalid customer data", async (context) => {
    const cookie = await createTestCart();
    context.after(() => deleteTestCart(cookie));

    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...customer,
        customerName: "",
        email: "not-an-email",
      }),
    });

    assert.equal(response.status, 400);
  });

  it("does not create an order from an empty cart", async (context) => {
    const cookie = await createTestCart();
    context.after(() => deleteTestCart(cookie));

    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(customer),
    });

    assert.equal(response.status, 409);
  });

  it("does not expose an order to a different guest cart", async (context) => {
    const ownerCookie = await createTestCart();
    const otherCookie = await createTestCart();
    const product = await addSeedProduct(ownerCookie);
    context.after(async () => {
      await deleteTestCart(ownerCookie);
      await deleteTestCart(otherCookie);
      await restoreProductStock(product.id, product.stockQuantity);
    });
    const createResponse = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
      body: JSON.stringify(customer),
    });
    assert.equal(createResponse.status, 201);
    const order = await createResponse.json();

    const response = await fetch(`${baseUrl}/orders/${order.id}`, {
      headers: { Cookie: otherCookie },
    });
    assert.equal(response.status, 404);
  });

  it("cancels an order and restores stock only once", async (context) => {
    const cookie = await createTestCart();
    const otherCookie = await createTestCart();
    const product = await addSeedProduct(cookie);
    context.after(async () => {
      await deleteTestCart(cookie);
      await deleteTestCart(otherCookie);
      await restoreProductStock(product.id, product.stockQuantity);
    });

    const createResponse = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(customer),
    });
    assert.equal(createResponse.status, 201);
    const order = await createResponse.json();

    const unauthorizedCancelResponse = await fetch(
      `${baseUrl}/orders/${order.id}/cancel`,
      { method: "POST", headers: { Cookie: otherCookie } },
    );
    assert.equal(unauthorizedCancelResponse.status, 404);

    const stockAfterOrder = await pool.query<{ stock_quantity: number }>(
      "SELECT stock_quantity FROM products WHERE id = $1",
      [product.id],
    );
    assert.equal(
      stockAfterOrder.rows[0].stock_quantity,
      product.stockQuantity - 2,
    );

    const cancelResponse = await fetch(
      `${baseUrl}/orders/${order.id}/cancel`,
      { method: "POST", headers: { Cookie: cookie } },
    );
    assert.equal(cancelResponse.status, 200);
    assert.equal((await cancelResponse.json()).status, "cancelled");

    const stockAfterCancellation = await pool.query<{ stock_quantity: number }>(
      "SELECT stock_quantity FROM products WHERE id = $1",
      [product.id],
    );
    assert.equal(
      stockAfterCancellation.rows[0].stock_quantity,
      product.stockQuantity,
    );

    const repeatedCancelResponse = await fetch(
      `${baseUrl}/orders/${order.id}/cancel`,
      { method: "POST", headers: { Cookie: cookie } },
    );
    assert.equal(repeatedCancelResponse.status, 200);
    assert.equal((await repeatedCancelResponse.json()).status, "cancelled");

    const stockAfterRepeatedCancellation = await pool.query<{
      stock_quantity: number;
    }>("SELECT stock_quantity FROM products WHERE id = $1", [product.id]);
    assert.equal(
      stockAfterRepeatedCancellation.rows[0].stock_quantity,
      product.stockQuantity,
    );
  });

  it("expires unpaid orders and restores stock exactly once", async (context) => {
    const cookie = await createTestCart();
    const product = await addSeedProduct(cookie);
    context.after(async () => {
      await deleteTestCart(cookie);
      await restoreProductStock(product.id, product.stockQuantity);
    });

    const createResponse = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(customer),
    });
    assert.equal(createResponse.status, 201);
    const order = await createResponse.json();
    await pool.query(
      "UPDATE orders SET expires_at = now() - interval '1 second' WHERE id = $1",
      [order.id],
    );

    const expiryRuns = await Promise.all([
      expirePendingOrders(),
      expirePendingOrders(),
    ]);
    assert.equal(expiryRuns.reduce((total, count) => total + count, 0), 1);

    const orderResponse = await fetch(`${baseUrl}/orders/${order.id}`, {
      headers: { Cookie: cookie },
    });
    assert.equal(orderResponse.status, 200);
    assert.equal((await orderResponse.json()).status, "expired");

    const stock = await pool.query<{ stock_quantity: number }>(
      "SELECT stock_quantity FROM products WHERE id = $1",
      [product.id],
    );
    assert.equal(stock.rows[0].stock_quantity, product.stockQuantity);
    assert.equal(await expirePendingOrders(), 0);
  });

  it("marks a late cancellation as expired and restores stock", async (context) => {
    const cookie = await createTestCart();
    const product = await addSeedProduct(cookie);
    context.after(async () => {
      await deleteTestCart(cookie);
      await restoreProductStock(product.id, product.stockQuantity);
    });

    const createResponse = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(customer),
    });
    assert.equal(createResponse.status, 201);
    const order = await createResponse.json();
    await pool.query(
      "UPDATE orders SET expires_at = now() - interval '1 second' WHERE id = $1",
      [order.id],
    );

    const cancelResponse = await fetch(
      `${baseUrl}/orders/${order.id}/cancel`,
      { method: "POST", headers: { Cookie: cookie } },
    );
    assert.equal(cancelResponse.status, 200);
    assert.equal((await cancelResponse.json()).status, "expired");

    const stock = await pool.query<{ stock_quantity: number }>(
      "SELECT stock_quantity FROM products WHERE id = $1",
      [product.id],
    );
    assert.equal(stock.rows[0].stock_quantity, product.stockQuantity);
    assert.equal(await expirePendingOrders(), 0);
  });

  it("prevents two carts from ordering the same remaining stock", async (context) => {
    const firstCookie = await createTestCart();
    const secondCookie = await createTestCart();
    const product = await addSeedProduct(firstCookie);
    await pool.query("UPDATE products SET stock_quantity = 2 WHERE id = $1", [
      product.id,
    ]);
    context.after(async () => {
      await deleteTestCart(firstCookie);
      await deleteTestCart(secondCookie);
      await restoreProductStock(product.id, product.stockQuantity);
    });
    const secondAddResponse = await fetch(`${baseUrl}/cart/items`, {
      method: "POST",
      headers: { Cookie: secondCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ slug: product.slug, quantity: 2 }),
    });
    assert.equal(secondAddResponse.status, 200);

    const firstOrderResponse = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { Cookie: firstCookie, "Content-Type": "application/json" },
      body: JSON.stringify(customer),
    });
    assert.equal(firstOrderResponse.status, 201);

    const secondOrderResponse = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { Cookie: secondCookie, "Content-Type": "application/json" },
      body: JSON.stringify(customer),
    });
    assert.equal(secondOrderResponse.status, 409);

    const secondCart = await fetch(`${baseUrl}/cart`, {
      headers: { Cookie: secondCookie },
    });
    const cartBody = await secondCart.json();
    assert.equal(cartBody.items[0].quantity, 2);
    assert.equal(cartBody.items[0].availableStock, 0);
  });
});
