import { z } from "zod";

export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  priceInCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  stockQuantity: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export const productListSchema = z.array(productSchema);

export type Product = z.infer<typeof productSchema>;
export type ProductList = z.infer<typeof productListSchema>;
