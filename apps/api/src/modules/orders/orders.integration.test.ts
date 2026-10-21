import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { CreateOrderInput } from "@shop/contracts";
import { app } from "../../app.js";
import { closeDatabase, pool } from "../../db/client.js";

const customer: CreateOrderInput = {
  customerName: "Testowy Klient",
  email: "test@example.com",
  street: "Testowa 1",
  postalCode: "00-001",
  city: "Warszawa",
};

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

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
    slug: string;
    priceInCents: number;
  };

  const response = await fetch(`${baseUrl}/cart/items`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ slug: product.slug, quantity: 2 }),
  });
  assert.equal(response.status, 200);

  return product;
}

describe("orders API", () => {
  before(async () => {
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
    }
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

  it("creates an order, snapshots its items, and empties the cart", async (context) => {
    const cookie = await createTestCart();
    context.after(() => deleteTestCart(cookie));
    const product = await addSeedProduct(cookie);

    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(customer),
    });
    assert.equal(response.status, 201);

    const order = await response.json();
    assert.equal(order.status, "pending_payment");
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
    context.after(async () => {
      await deleteTestCart(ownerCookie);
      await deleteTestCart(otherCookie);
    });

    await addSeedProduct(ownerCookie);
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
});
