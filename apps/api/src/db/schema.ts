import {
  check,
  integer,
  pgTable,
  primaryKey,
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
    stockQuantity: integer("stock_quantity").notNull().default(20),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "products_price_in_cents_non_negative",
      sql`${table.priceInCents} >= 0`,
    ),
    check(
      "products_stock_quantity_non_negative",
      sql`${table.stockQuantity} >= 0`,
    ),
  ],
);

export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const adminSessions = pgTable("admin_sessions", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.cartId, table.productId] }),
    check(
      "cart_items_quantity_range",
      sql`${table.quantity} >= 1 AND ${table.quantity} <= 99`,
    ),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 30 }).notNull().default("pending_payment"),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    street: varchar("street", { length: 200 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    totalInCents: integer("total_in_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("orders_total_in_cents_non_negative", sql`${table.totalInCents} >= 0`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productName: varchar("product_name", { length: 255 }).notNull(),
    unitPriceInCents: integer("unit_price_in_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    check(
      "order_items_unit_price_non_negative",
      sql`${table.unitPriceInCents} >= 0`,
    ),
    check(
      "order_items_quantity_range",
      sql`${table.quantity} >= 1 AND ${table.quantity} <= 99`,
    ),
  ],
);
