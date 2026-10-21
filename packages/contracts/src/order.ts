import { z } from "zod";

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  street: z.string().trim().min(3).max(200),
  postalCode: z.string().trim().min(3).max(20),
  city: z.string().trim().min(2).max(100),
});

export const orderIdSchema = z.string().uuid();

export const orderSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending_payment", "cancelled"]),
  customerName: z.string(),
  email: z.string().email(),
  street: z.string(),
  postalCode: z.string(),
  city: z.string(),
  currency: z.string().length(3),
  totalInCents: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  items: z.array(
    z.object({
      productName: z.string().min(1),
      unitPriceInCents: z.number().int().nonnegative(),
      quantity: z.number().int().min(1).max(99),
      lineTotalInCents: z.number().int().nonnegative(),
    }),
  ),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type Order = z.infer<typeof orderSchema>;
