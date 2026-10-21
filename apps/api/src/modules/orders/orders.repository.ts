import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { CreateOrderInput } from "@shop/contracts";
import { db } from "../../db/client.js";
import { cartItems, carts, orderItems, orders, products } from "../../db/schema.js";

export const pendingOrderLifetimeMs = 30 * 60 * 1000;

type CreatedOrder = {
  order: typeof orders.$inferSelect;
  items: {
    productName: string;
    unitPriceInCents: number;
    quantity: number;
    lineTotalInCents: number;
  }[];
};

type CreateOrderResult =
  | { kind: "empty" }
  | { kind: "mixed-currencies" }
  | { kind: "out-of-stock"; productNames: string[] }
  | ({ kind: "created" } & CreatedOrder);

export async function createOrderRecord(
  cartId: string,
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.id, cartId))
      .for("update");

    const cartRows = await transaction
      .select({
        productId: products.id,
        quantity: cartItems.quantity,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, cartId))
      .orderBy(products.id);

    if (cartRows.length === 0) {
      return { kind: "empty" };
    }

    const lockedProducts = await transaction
      .select({
        id: products.id,
        productName: products.name,
        unitPriceInCents: products.priceInCents,
        currency: products.currency,
        stockQuantity: products.stockQuantity,
      })
      .from(products)
      .where(
        inArray(
          products.id,
          cartRows.map((item) => item.productId),
        ),
      )
      .orderBy(products.id)
      .for("update");
    const productById = new Map(
      lockedProducts.map((product) => [product.id, product]),
    );
    const items = cartRows.map((item) => {
      const product = productById.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} disappeared during checkout.`);
      }

      return { ...item, ...product };
    });
    const unavailable = items.filter(
      (item) => item.quantity > item.stockQuantity,
    );
    if (unavailable.length > 0) {
      return {
        kind: "out-of-stock",
        productNames: unavailable.map((item) => item.productName),
      };
    }

    const currency = items[0].currency;
    if (items.some((item) => item.currency !== currency)) {
      return { kind: "mixed-currencies" };
    }

    for (const item of items) {
      await transaction
        .update(products)
        .set({
          stockQuantity: sql`${products.stockQuantity} - ${item.quantity}`,
        })
        .where(eq(products.id, item.productId));
    }

    const totalInCents = items.reduce(
      (total, item) => total + item.unitPriceInCents * item.quantity,
      0,
    );
    const [order] = await transaction
      .insert(orders)
      .values({
        cartId,
        ...input,
        currency,
        totalInCents,
        expiresAt: new Date(Date.now() + pendingOrderLifetimeMs),
      })
      .returning();

    await transaction.insert(orderItems).values(
      items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        productName: item.productName,
        unitPriceInCents: item.unitPriceInCents,
        currency: item.currency,
        quantity: item.quantity,
      })),
    );

    await transaction.delete(cartItems).where(eq(cartItems.cartId, cartId));

    return {
      kind: "created",
      order,
      items: items.map((item) => ({
        productName: item.productName,
        unitPriceInCents: item.unitPriceInCents,
        quantity: item.quantity,
        lineTotalInCents: item.unitPriceInCents * item.quantity,
      })),
    };
  });
}

export async function findOrderForCart(orderId: string, cartId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.cartId, cartId)))
    .limit(1);

  if (!order) {
    return null;
  }

  const items = await db
    .select({
      productName: orderItems.productName,
      unitPriceInCents: orderItems.unitPriceInCents,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    expiresAt: order.expiresAt.toISOString(),
    items: items.map((item) => ({
      ...item,
      lineTotalInCents: item.unitPriceInCents * item.quantity,
    })),
  };
}

export async function cancelOrderRecord(orderId: string, cartId: string) {
  const result = await db.transaction(async (transaction) => {
    const [order] = await transaction
      .select({
        id: orders.id,
        status: orders.status,
        expiresAt: orders.expiresAt,
      })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.cartId, cartId)))
      .for("update");

    if (!order) {
      return { kind: "not-found" as const };
    }

    if (order.status === "pending_payment") {
      const status =
        order.expiresAt <= new Date() ? "expired" : "cancelled";
      const items = await transaction
        .select({
          productId: orderItems.productId,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));
      const quantityByProduct = new Map<string, number>();

      for (const item of items) {
        if (item.productId) {
          quantityByProduct.set(
            item.productId,
            (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
          );
        }
      }

      const productIds = [...quantityByProduct.keys()].sort();
      if (productIds.length > 0) {
        await transaction
          .select({ id: products.id })
          .from(products)
          .where(inArray(products.id, productIds))
          .orderBy(products.id)
          .for("update");

        for (const [productId, quantity] of quantityByProduct) {
          await transaction
            .update(products)
            .set({
              stockQuantity: sql`${products.stockQuantity} + ${quantity}`,
            })
            .where(eq(products.id, productId));
        }
      }

      await transaction
        .update(orders)
        .set({ status })
        .where(eq(orders.id, orderId));
    }

    return { kind: "cancelled" as const };
  });

  if (result.kind === "not-found") {
    return null;
  }

  return findOrderForCart(orderId, cartId);
}

export const expiryBatchSize = 100;

export async function expirePendingOrders() {
  return db.transaction(async (transaction) => {
    const expiredOrders = await transaction
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.status, "pending_payment"),
          lte(orders.expiresAt, new Date()),
        ),
      )
      .orderBy(orders.expiresAt, orders.id)
      .limit(expiryBatchSize)
      .for("update", { skipLocked: true });

    if (expiredOrders.length === 0) {
      return 0;
    }

    const orderIds = expiredOrders.map((order) => order.id);
    const items = await transaction
      .select({
        productId: orderItems.productId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));
    const quantityByProduct = new Map<string, number>();

    for (const item of items) {
      if (item.productId) {
        quantityByProduct.set(
          item.productId,
          (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
        );
      }
    }

    const productIds = [...quantityByProduct.keys()].sort();
    if (productIds.length > 0) {
      await transaction
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.id, productIds))
        .orderBy(products.id)
        .for("update");

      for (const [productId, quantity] of [...quantityByProduct].sort(
        ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0),
      )) {
        await transaction
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} + ${quantity}`,
          })
          .where(eq(products.id, productId));
      }
    }

    await transaction
      .update(orders)
      .set({ status: "expired" })
      .where(inArray(orders.id, orderIds));

    return expiredOrders.length;
  });
}

export async function findAdminOrders() {
  const rows = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return Promise.all(
    rows.map(async (order) => {
      const items = await db
        .select({
          productName: orderItems.productName,
          unitPriceInCents: orderItems.unitPriceInCents,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));

      return {
        ...order,
        createdAt: order.createdAt.toISOString(),
        expiresAt: order.expiresAt.toISOString(),
        items: items.map((item) => ({
          ...item,
          lineTotalInCents: item.unitPriceInCents * item.quantity,
        })),
      };
    }),
  );
}
