import express from "express";
import swaggerUi from "swagger-ui-express";
import {
  healthResponseSchema,
  readinessResponseSchema,
} from "@shop/contracts";
import { pool } from "./db/client.js";
import { openApiDocument } from "./openapi.js";

export const app = express();

app.disable("x-powered-by");
app.use(express.json());

app.get("/openapi.json", (_request, response) => {
  response.json(openApiDocument);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

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
