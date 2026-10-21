import { createHash, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { cartsCookieName } from "./cart.session.js";
import {
  createCart,
  extendCart,
  findActiveCart,
} from "./cart.repository.js";

const cartLifetimeMs = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isValidToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export const ensureCart: RequestHandler = async (request, response, next) => {
  try {
    const now = new Date();
    const cookieToken = request.cookies?.[cartsCookieName];
    const token = isValidToken(cookieToken)
      ? cookieToken
      : randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(now.getTime() + cartLifetimeMs);
    const existingCart = await findActiveCart(tokenHash, now);
    const cart = existingCart
      ? existingCart
      : await createCart(tokenHash, expiresAt);

    if (existingCart) {
      await extendCart(cart.id, expiresAt);
    }

    response.cookie(cartsCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: cartLifetimeMs,
    });

    response.locals.cartId = cart.id;
    next();
  } catch (error) {
    next(error);
  }
};
