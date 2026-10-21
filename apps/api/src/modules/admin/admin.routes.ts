import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  adminDashboardSchema,
  adminLoginSchema,
  adminSessionSchema,
  apiErrorSchema,
  productSchema,
  updateStockSchema,
} from "@shop/contracts";
import { db } from "../../db/client.js";
import { products } from "../../db/schema.js";
import { findAdminOrders } from "../orders/orders.repository.js";
import {
  authenticateAdmin,
  clearAdminCookie,
  isAdminSessionValid,
  requireAdmin,
  revokeAdminSession,
  setAdminCookie,
} from "./admin.auth.js";

export const adminRouter = Router();

adminRouter.post("/login", async (request, response) => {
  const input = adminLoginSchema.safeParse(request.body);
  if (!input.success) {
    response
      .status(400)
      .json(apiErrorSchema.parse({ message: "Podaj poprawny e-mail i hasło." }));
    return;
  }

  const result = await authenticateAdmin(input.data.email, input.data.password);
  if (result === "not-configured") {
    response.status(503).json(
      apiErrorSchema.parse({
        message: "Panel administratora nie jest skonfigurowany.",
      }),
    );
    return;
  }
  if (result === "invalid-credentials") {
    response.status(401).json(
      apiErrorSchema.parse({ message: "Nieprawidłowy e-mail lub hasło." }),
    );
    return;
  }

  setAdminCookie(response, result.token, result.maxAge);
  response.json(adminSessionSchema.parse({ authenticated: true }));
});

adminRouter.post("/logout", async (request, response) => {
  await revokeAdminSession(request.cookies?.shop_admin);
  clearAdminCookie(response);
  response.json(adminSessionSchema.parse({ authenticated: false }));
});

adminRouter.get("/session", async (request, response, next) => {
  try {
    response.json(
      adminSessionSchema.parse({
        authenticated: await isAdminSessionValid(request.cookies?.shop_admin),
      }),
    );
  } catch (error) {
    next(error);
  }
});

adminRouter.use(requireAdmin);

adminRouter.get("/dashboard", async (_request, response) => {
  const rows = await db.select().from(products).orderBy(products.name);
  const productList = rows.map((product) => ({
    ...product,
    createdAt: product.createdAt.toISOString(),
  }));
  const orders = await findAdminOrders();

  response.json(
    adminDashboardSchema.parse({ products: productList, orders }),
  );
});

adminRouter.patch("/products/:id/stock", async (request, response) => {
  const stock = updateStockSchema.safeParse(request.body);
  if (!stock.success) {
    response.status(400).json(
      apiErrorSchema.parse({ message: "Podaj prawidłowy stan magazynowy." }),
    );
    return;
  }

  const [product] = await db
    .update(products)
    .set({ stockQuantity: stock.data.stockQuantity })
    .where(eq(products.id, request.params.id))
    .returning();

  if (!product) {
    response.status(404).json(
      apiErrorSchema.parse({ message: "Nie znaleziono produktu." }),
    );
    return;
  }

  response.json(
    productSchema.parse({
      ...product,
      createdAt: product.createdAt.toISOString(),
    }),
  );
});
