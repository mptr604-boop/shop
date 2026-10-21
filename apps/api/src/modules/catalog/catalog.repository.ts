import { asc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { products } from "../../db/schema.js";

export function findAllProducts() {
  return db.select().from(products).orderBy(asc(products.name));
}
