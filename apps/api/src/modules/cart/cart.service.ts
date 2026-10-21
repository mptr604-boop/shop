import type { Cart, CartItem } from "@shop/contracts";
import {
  addProductToCart,
  findCartItems,
  findProductBySlug,
  removeCartItem,
  setCartItemQuantity,
} from "./cart.repository.js";

export class CartServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: 404 | 409,
  ) {
    super(message);
    this.name = "CartServiceError";
  }
}

function toCart(items: CartItem[]): Cart {
  const totalsByCurrency = new Map<string, number>();

  for (const item of items) {
    totalsByCurrency.set(
      item.currency,
      (totalsByCurrency.get(item.currency) ?? 0) + item.lineTotalInCents,
    );
  }

  return {
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    totalsByCurrency: [...totalsByCurrency].map(([currency, totalInCents]) => ({
      currency,
      totalInCents,
    })),
  };
}

export async function getCart(cartId: string): Promise<Cart> {
  const rows = await findCartItems(cartId);
  return toCart(
    rows.map((item) => ({
      ...item,
      lineTotalInCents: item.priceInCents * item.quantity,
    })),
  );
}

export async function addItem(
  cartId: string,
  slug: string,
  quantity: number,
): Promise<Cart> {
  const product = await findProductBySlug(slug);
  if (!product) {
    throw new CartServiceError("Nie znaleziono produktu.", 404);
  }

  const item = await addProductToCart(cartId, product.id, quantity);
  if (!item) {
    throw new CartServiceError(
      "Łączna ilość produktu w koszyku nie może przekroczyć 99.",
      409,
    );
  }

  return getCart(cartId);
}

export async function updateItem(
  cartId: string,
  slug: string,
  quantity: number,
): Promise<Cart> {
  const product = await findProductBySlug(slug);
  if (!product) {
    throw new CartServiceError("Nie znaleziono produktu.", 404);
  }

  const item = await setCartItemQuantity(cartId, product.id, quantity);
  if (!item) {
    throw new CartServiceError("Produkt nie znajduje się w koszyku.", 404);
  }

  return getCart(cartId);
}

export async function removeItem(
  cartId: string,
  slug: string,
): Promise<Cart> {
  const product = await findProductBySlug(slug);
  if (!product) {
    throw new CartServiceError("Nie znaleziono produktu.", 404);
  }

  const item = await removeCartItem(cartId, product.id);
  if (!item) {
    throw new CartServiceError("Produkt nie znajduje się w koszyku.", 404);
  }

  return getCart(cartId);
}
