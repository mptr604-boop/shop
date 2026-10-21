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
      availableStock: products.stockQuantity,
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
  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.id, cartId))
      .for("update");

    const [product] = await transaction
      .select({ stockQuantity: products.stockQuantity })
      .from(products)
      .where(eq(products.id, productId))
      .for("update");
    const [existingItem] = await transaction
      .select({ quantity: cartItems.quantity })
      .from(cartItems)
      .where(
        and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)),
      );

    const nextQuantity = (existingItem?.quantity ?? 0) + quantity;
    if (!product || nextQuantity > 99 || nextQuantity > product.stockQuantity) {
      return false;
    }

    await transaction
      .insert(cartItems)
      .values({ cartId, productId, quantity })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.productId],
        set: { quantity: sql`${cartItems.quantity} + EXCLUDED.quantity` },
      });

    return true;
  });
}

export async function setCartItemQuantity(
  cartId: string,
  productId: string,
  quantity: number,
) {
  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.id, cartId))
      .for("update");

    const [product] = await transaction
      .select({ stockQuantity: products.stockQuantity })
      .from(products)
      .where(eq(products.id, productId))
      .for("update");
    const [existingItem] = await transaction
      .select({ quantity: cartItems.quantity })
      .from(cartItems)
      .where(
        and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)),
      );

    if (!existingItem) {
      return "not-found" as const;
    }
    if (!product || quantity > product.stockQuantity) {
      return "out-of-stock" as const;
    }

    await transaction
      .update(cartItems)
      .set({ quantity })
      .where(
        and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)),
      );

    return "updated" as const;
  });
}

export async function removeCartItem(cartId: string, productId: string) {
  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.id, cartId))
      .for("update");

    const [item] = await transaction
      .delete(cartItems)
      .where(
        and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)),
      )
      .returning({ productId: cartItems.productId });

    return item ?? null;
  });
}
