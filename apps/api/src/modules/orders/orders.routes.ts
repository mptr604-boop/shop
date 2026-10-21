import { Router } from "express";
import {
  apiErrorSchema,
  createOrderSchema,
  orderIdSchema,
  orderSchema,
} from "@shop/contracts";
import { ensureCart } from "../cart/cart.middleware.js";
import { createOrder, getOrder } from "./orders.service.js";

export const ordersRouter = Router();

ordersRouter.use(ensureCart);

ordersRouter.post("/", async (request, response) => {
  const input = createOrderSchema.safeParse(request.body);
  if (!input.success) {
    response
      .status(400)
      .json(
        apiErrorSchema.parse({
          message: "Uzupełnij poprawnie dane do dostawy.",
        }),
      );
    return;
  }

  const order = await createOrder(response.locals.cartId, input.data);
  response.status(201).json(orderSchema.parse(order));
});

ordersRouter.get("/:id", async (request, response) => {
  const orderId = orderIdSchema.safeParse(request.params.id);
  if (!orderId.success) {
    response
      .status(400)
      .json(apiErrorSchema.parse({ message: "Nieprawidłowy numer zamówienia." }));
    return;
  }

  const order = await getOrder(orderId.data, response.locals.cartId);
  response.json(orderSchema.parse(order));
});
