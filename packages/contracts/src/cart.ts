import { z } from "zod";

export const addCartItemSchema = z.object({
  slug: z.string().min(1).max(255),
  quantity: z.number().int().min(1).max(99),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(99),
});

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  priceInCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  quantity: z.number().int().min(1).max(99),
  lineTotalInCents: z.number().int().nonnegative(),
});

export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  itemCount: z.number().int().nonnegative(),
  totalsByCurrency: z.array(
    z.object({
      currency: z.string().length(3),
      totalInCents: z.number().int().nonnegative(),
    }),
  ),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type Cart = z.infer<typeof cartSchema>;
