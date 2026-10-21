import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set before starting the API.");
}

export const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 3_000,
});
export const db = drizzle({ client: pool, schema });

export function closeDatabase() {
  return pool.end();
}
