import express from "express";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import {
  apiErrorSchema,
  healthResponseSchema,
  readinessResponseSchema,
} from "@shop/contracts";
import { pool } from "./db/client.js";
import { cartRouter } from "./modules/cart/cart.routes.js";
import { CartServiceError } from "./modules/cart/cart.service.js";
import { catalogRouter } from "./modules/catalog/catalog.routes.js";
import { ordersRouter } from "./modules/orders/orders.routes.js";
import { OrderServiceError } from "./modules/orders/orders.service.js";
import { openApiDocument } from "./openapi.js";

export const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.use(cookieParser());

app.get("/openapi.json", (_request, response) => {
  response.json(openApiDocument);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use("/cart", cartRouter);
app.use("/orders", ordersRouter);
app.use("/products", catalogRouter);

app.get("/health", (_request, response) => {
  const body = healthResponseSchema.parse({
    status: "ok",
    service: "api",
  });

  response.status(200).json(body);
});

app.get("/ready", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.status(200).json(
      readinessResponseSchema.parse({
        status: "ok",
        service: "api",
        dependencies: { database: "ok" },
      }),
    );
  } catch (error) {
    console.error("Readiness check failed: database is unavailable", error);
    response.status(503).json(
      readinessResponseSchema.parse({
        status: "error",
        service: "api",
        dependencies: { database: "unavailable" },
      }),
    );
  }
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    next: express.NextFunction,
  ) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error instanceof CartServiceError || error instanceof OrderServiceError) {
      response
        .status(error.statusCode)
        .json(apiErrorSchema.parse({ message: error.message }));
      return;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "type" in error &&
      error.type === "entity.parse.failed"
    ) {
      response
        .status(400)
        .json(apiErrorSchema.parse({ message: "Nieprawidłowy format JSON." }));
      return;
    }

    console.error("Unhandled API error", error);
    response
      .status(500)
      .json(apiErrorSchema.parse({ message: "Wystąpił nieoczekiwany błąd." }));
  },
);
