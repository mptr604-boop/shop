import type { ProductList } from "@shop/contracts";
import { findAllProducts } from "./catalog.repository.js";

export async function getProducts(): Promise<ProductList> {
  const rows = await findAllProducts();

  return rows.map((product) => ({
    ...product,
    createdAt: product.createdAt.toISOString(),
  }));
}
