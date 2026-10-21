import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { cartItems, carts, products } from "../../db/schema.js";

export async function findActiveCart(tokenHash: string, now: Date) {
  const [cart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(and(eq(carts.tokenHash, tokenHash), gt(carts.expiresAt, now)))
    .limit(1);

  return cart ?? null;
}

export async function createCart(tokenHash: string, expiresAt: Date) {
  const [cart] = await db
    .insert(carts)
    .values({ tokenHash, expiresAt })
    .returning({ id: carts.id });

  return cart;
}

export function extendCart(cartId: string, expiresAt: Date) {
  return db.update(carts).set({ expiresAt }).where(eq(carts.id, cartId));
}

export function findCartItems(cartId: string) {
  return db
    .select({
      productId: products.id,
      slug: products.slug,
      name: products.name,
      priceInCents: products.priceInCents,
      currency: products.currency,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(products.name);
}

export async function findProductBySlug(slug: string) {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  return product ?? null;
}

export async function addProductToCart(
  cartId: string,
  productId: string,
  quantity: number,
) {
  const [item] = await db
    .insert(cartItems)
    .values({ cartId, productId, quantity })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId],
      set: { quantity: sql`${cartItems.quantity} + EXCLUDED.quantity` },
      setWhere: sql`${cartItems.quantity} + EXCLUDED.quantity <= 99`,
    })
    .returning({ productId: cartItems.productId });

  return item ?? null;
}

export async function setCartItemQuantity(
  cartId: string,
  productId: string,
  quantity: number,
) {
  const [item] = await db
    .update(cartItems)
    .set({ quantity })
    .where(
      and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)),
    )
    .returning({ productId: cartItems.productId });

  return item ?? null;
}

export async function removeCartItem(cartId: string, productId: string) {
  const [item] = await db
    .delete(cartItems)
    .where(
      and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)),
    )
    .returning({ productId: cartItems.productId });

  return item ?? null;
}
