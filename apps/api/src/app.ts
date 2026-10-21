import express from "express";
import swaggerUi from "swagger-ui-express";
import { healthResponseSchema } from "@shop/contracts";
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
