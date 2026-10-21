import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, lt } from "drizzle-orm";
import type { RequestHandler } from "express";
import { apiErrorSchema } from "@shop/contracts";
import { db } from "../../db/client.js";
import { adminSessions } from "../../db/schema.js";

const scryptAsync = promisify(scrypt);
const adminCookieName = "shop_admin";
const sessionLifetimeMs = 8 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export async function isAdminSessionValid(token: unknown) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return false;
  }

  const [session] = await db
    .select({ tokenHash: adminSessions.tokenHash })
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.tokenHash, hashToken(token)),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return Boolean(session);
}

export async function authenticateAdmin(email: string, password: string) {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!configuredEmail || !passwordHash) {
    return "not-configured" as const;
  }

  const [salt, expectedHash, extra] = passwordHash.split("$");
  if (
    !salt ||
    !expectedHash ||
    extra !== undefined ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(expectedHash)
  ) {
    throw new Error("ADMIN_PASSWORD_HASH has an invalid format.");
  }

  const actualHash = (await scryptAsync(
    password,
    Buffer.from(salt, "hex"),
    64,
  )) as Buffer;
  const validPassword = safeEqual(actualHash.toString("hex"), expectedHash);
  const validEmail = safeEqual(email.trim().toLowerCase(), configuredEmail);

  if (!validEmail || !validPassword) {
    return "invalid-credentials" as const;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);

  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  await db.insert(adminSessions).values({
    tokenHash: hashToken(token),
    expiresAt,
  });

  return { token, maxAge: sessionLifetimeMs };
}

export async function revokeAdminSession(token: unknown) {
  if (typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    await db
      .delete(adminSessions)
      .where(eq(adminSessions.tokenHash, hashToken(token)));
  }
}

export const requireAdmin: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    if (!(await isAdminSessionValid(request.cookies?.[adminCookieName]))) {
      response.status(401).json(
        apiErrorSchema.parse({ message: "Zaloguj się jako administrator." }),
      );
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export function setAdminCookie(
  response: Parameters<RequestHandler>[1],
  token: string,
  maxAge: number,
) {
  response.cookie(adminCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}

export function clearAdminCookie(
  response: Parameters<RequestHandler>[1],
) {
  response.clearCookie(adminCookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}
