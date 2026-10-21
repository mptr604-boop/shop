import {
  orderSchema,
  type CreateOrderInput,
  type Order,
} from "@shop/contracts";
import {
  cancelOrderRecord,
  createOrderRecord,
  findOrderForCart,
} from "./orders.repository.js";

export class OrderServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: 404 | 409,
  ) {
    super(message);
    this.name = "OrderServiceError";
  }
}

export async function createOrder(
  cartId: string,
  input: CreateOrderInput,
): Promise<Order> {
  const result = await createOrderRecord(cartId, input);
  if (result.kind === "empty") {
    throw new OrderServiceError("Koszyk jest pusty.", 409);
  }
  if (result.kind === "mixed-currencies") {
    throw new OrderServiceError(
      "Nie można złożyć jednego zamówienia z różnymi walutami.",
      409,
    );
  }
  if (result.kind === "out-of-stock") {
    throw new OrderServiceError(
      `Brak wystarczającej liczby produktów: ${result.productNames.join(", ")}.`,
      409,
    );
  }

  return orderSchema.parse({
    ...result.order,
    createdAt: result.order.createdAt.toISOString(),
    items: result.items,
  });
}

export async function getOrder(
  orderId: string,
  cartId: string,
): Promise<Order> {
  const order = await findOrderForCart(orderId, cartId);
  if (!order) {
    throw new OrderServiceError("Nie znaleziono zamówienia.", 404);
  }

  return orderSchema.parse(order);
}

export async function cancelOrder(
  orderId: string,
  cartId: string,
): Promise<Order> {
  const order = await cancelOrderRecord(orderId, cartId);
  if (!order) {
    throw new OrderServiceError("Nie znaleziono zamówienia.", 404);
  }

  return orderSchema.parse(order);
}
