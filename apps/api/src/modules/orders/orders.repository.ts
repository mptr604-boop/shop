import { and, eq } from "drizzle-orm";
import type { CreateOrderInput } from "@shop/contracts";
import { db } from "../../db/client.js";
import { cartItems, carts, orderItems, orders, products } from "../../db/schema.js";

export async function createOrderRecord(
  cartId: string,
  input: CreateOrderInput,
) {
  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.id, cartId))
      .for("update");

    const items = await transaction
      .select({
        productId: products.id,
        productName: products.name,
        unitPriceInCents: products.priceInCents,
        currency: products.currency,
        quantity: cartItems.quantity,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, cartId));

    if (items.length === 0) {
      return null;
    }

    const currency = items[0].currency;
    if (items.some((item) => item.currency !== currency)) {
      return { mixedCurrencies: true as const };
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
    items: items.map((item) => ({
      ...item,
      lineTotalInCents: item.unitPriceInCents * item.quantity,
    })),
  };
}
