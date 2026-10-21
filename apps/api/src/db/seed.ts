import { db, closeDatabase } from "./client.js";
import { products } from "./schema.js";

try {
  await db
    .insert(products)
    .values([
      {
        name: "Kawa ziarnista",
        slug: "kawa-ziarnista",
        description: "Aromatyczna kawa 100% arabica, palona lokalnie.",
        priceInCents: 4590,
      },
      {
        name: "Kubek ceramiczny",
        slug: "kubek-ceramiczny",
        description: "Ręcznie wykończony kubek o pojemności 350 ml.",
        priceInCents: 3890,
      },
      {
        name: "Notes w kropki",
        slug: "notes-w-kropki",
        description: "Twarda oprawa i papier z recyklingu.",
        priceInCents: 2490,
      },
    ])
    .onConflictDoNothing({ target: products.slug });
  console.log("Sample products are ready.");
} finally {
  await closeDatabase();
}
