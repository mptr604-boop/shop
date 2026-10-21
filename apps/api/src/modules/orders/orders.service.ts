import {
  orderSchema,
  type CreateOrderInput,
  type Order,
} from "@shop/contracts";
import {
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
  if (!result) {
    throw new OrderServiceError("Koszyk jest pusty.", 409);
  }
  if ("mixedCurrencies" in result) {
    throw new OrderServiceError(
      "Nie można złożyć jednego zamówienia z różnymi walutami.",
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
