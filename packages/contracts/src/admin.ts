import { z } from "zod";
import { productListSchema } from "./product.js";
import { orderSchema } from "./order.js";

export const adminLoginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
});

export const adminSessionSchema = z.object({
  authenticated: z.boolean(),
});

export const adminProductInputSchema = z.object({
  name: z.string().trim().min(2).max(255),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(2000).nullable(),
  priceInCents: z.number().int().min(0).max(100_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  stockQuantity: z.number().int().min(0).max(1_000_000),
});

export const adminProductIdSchema = z.string().uuid();

export const updateStockSchema = z.object({
  stockQuantity: z.number().int().min(0).max(1_000_000),
});

export const adminDashboardSchema = z.object({
  products: productListSchema,
  orders: z.array(orderSchema),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminProductInput = z.infer<typeof adminProductInputSchema>;
export type AdminSession = z.infer<typeof adminSessionSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
export type AdminDashboard = z.infer<typeof adminDashboardSchema>;
