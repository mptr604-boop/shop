import type { Product, ProductList } from "@shop/contracts";
import { findAllProducts, findProductBySlug } from "./catalog.repository.js";
import type { products } from "../../db/schema.js";

function toProductResponse(
  product: typeof products.$inferSelect,
): Product {
  return {
    ...product,
    createdAt: product.createdAt.toISOString(),
  } satisfies Product;
}

export async function getProducts(): Promise<ProductList> {
  const rows = await findAllProducts();

  return rows.map(toProductResponse);
}

export async function getProduct(slug: string): Promise<Product | null> {
  const product = await findProductBySlug(slug);
  return product ? toProductResponse(product) : null;
}
