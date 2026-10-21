import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { products } from "../../db/schema.js";

export function findAllProducts() {
  return db.select().from(products).orderBy(asc(products.name));
}

export async function findProductBySlug(slug: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  return product ?? null;
}
