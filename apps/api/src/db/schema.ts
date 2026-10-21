import {
  check,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    description: varchar("description", { length: 2000 }),
    priceInCents: integer("price_in_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("PLN"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "products_price_in_cents_non_negative",
      sql`${table.priceInCents} >= 0`,
    ),
  ],
);
