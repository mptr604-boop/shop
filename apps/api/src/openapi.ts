import {
  healthResponseSchema,
  readinessResponseSchema,
} from "@shop/contracts";
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
    "/ready": {
      get: {
        summary: "Sprawdza dostępność API i bazy danych",
        operationId: "getReadiness",
        responses: {
          "200": {
            description: "API i baza danych są dostępne.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(readinessResponseSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "503": {
            description: "Baza danych jest niedostępna.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(readinessResponseSchema, {
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
