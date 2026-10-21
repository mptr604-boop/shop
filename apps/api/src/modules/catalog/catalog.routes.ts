import { Router } from "express";
import {
  apiErrorSchema,
  productListSchema,
  productSchema,
} from "@shop/contracts";
import { getProduct, getProducts } from "./catalog.service.js";

export const catalogRouter = Router();

catalogRouter.get("/", async (_request, response) => {
  const products = await getProducts();
  response.json(productListSchema.parse(products));
});

catalogRouter.get("/:slug", async (request, response) => {
  const product = await getProduct(request.params.slug);

  if (!product) {
    response
      .status(404)
      .json(apiErrorSchema.parse({ message: "Nie znaleziono produktu." }));
    return;
  }

  response.json(productSchema.parse(product));
});
