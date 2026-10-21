import { Router } from "express";
import { productListSchema } from "@shop/contracts";
import { getProducts } from "./catalog.service.js";

export const catalogRouter = Router();

catalogRouter.get("/", async (_request, response) => {
  const products = await getProducts();
  response.json(productListSchema.parse(products));
});
