import {
  apiErrorSchema,
  healthResponseSchema,
  productListSchema,
  productSchema,
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
    "/products": {
      get: {
        summary: "Pobiera listę produktów",
        operationId: "getProducts",
        responses: {
          "200": {
            description: "Lista produktów.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(productListSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
        },
      },
    },
    "/products/{slug}": {
      get: {
        summary: "Pobiera produkt po slug",
        operationId: "getProductBySlug",
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Szczegóły produktu.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(productSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "404": {
            description: "Nie znaleziono produktu.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(apiErrorSchema, {
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
