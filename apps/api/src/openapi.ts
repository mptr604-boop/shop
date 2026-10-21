import { healthResponseSchema } from "@shop/contracts";
import { zodToJsonSchema } from "zod-to-json-schema";

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Shop API",
    version: "0.1.0",
    description: "API edukacyjnego sklepu internetowego.",
  },
  paths: {
    "/health": {
      get: {
        summary: "Sprawdza dostępność API",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "API działa poprawnie.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(healthResponseSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
        },
      },
    },
  },
};
