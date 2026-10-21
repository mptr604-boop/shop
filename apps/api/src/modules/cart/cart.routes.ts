import { Router } from "express";
import {
  addCartItemSchema,
  apiErrorSchema,
  cartSchema,
  updateCartItemSchema,
} from "@shop/contracts";
import { ensureCart } from "./cart.middleware.js";
import {
  addItem,
  getCart,
  removeItem,
  updateItem,
} from "./cart.service.js";

export const cartRouter = Router();

cartRouter.use(ensureCart);

cartRouter.get("/", async (_request, response) => {
  const cart = await getCart(response.locals.cartId);
  response.json(cartSchema.parse(cart));
});

cartRouter.post("/items", async (request, response) => {
  const input = addCartItemSchema.safeParse(request.body);
  if (!input.success) {
    response
      .status(400)
      .json(
        apiErrorSchema.parse({
          message: "Podaj poprawny slug produktu i ilość od 1 do 99.",
        }),
      );
    return;
  }

  const cart = await addItem(
    response.locals.cartId,
    input.data.slug,
    input.data.quantity,
  );
  response.json(cartSchema.parse(cart));
});

cartRouter.patch("/items/:slug", async (request, response) => {
  const input = updateCartItemSchema.safeParse(request.body);
  if (!input.success) {
    response
      .status(400)
      .json(
        apiErrorSchema.parse({
          message: "Ilość musi być liczbą całkowitą od 1 do 99.",
        }),
      );
    return;
  }

  const cart = await updateItem(
    response.locals.cartId,
    request.params.slug,
    input.data.quantity,
  );
  response.json(cartSchema.parse(cart));
});

cartRouter.delete("/items/:slug", async (request, response) => {
  const cart = await removeItem(
    response.locals.cartId,
    request.params.slug,
  );
  response.json(cartSchema.parse(cart));
});
