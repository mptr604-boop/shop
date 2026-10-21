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

export const updateStockSchema = z.object({
  stockQuantity: z.number().int().min(0).max(1_000_000),
});

export const adminDashboardSchema = z.object({
  products: productListSchema,
  orders: z.array(orderSchema),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminSession = z.infer<typeof adminSessionSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
export type AdminDashboard = z.infer<typeof adminDashboardSchema>;
