import {
  addCartItemSchema,
  apiErrorSchema,
  cartSchema,
  healthResponseSchema,
  productListSchema,
  productSchema,
  readinessResponseSchema,
  updateCartItemSchema,
} from "@shop/contracts";
import { zodToJsonSchema } from "zod-to-json-schema";

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Shop API",
    version: "0.1.0",
    description: "API edukacyjnego sklepu internetowego.",
  },
  components: {
    securitySchemes: {
      CartCookie: {
        type: "apiKey",
        in: "cookie",
        name: "shop_cart",
        description: "Identyfikuje koszyk gościa; cookie ustawia API.",
      },
    },
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
    "/cart": {
      get: {
        summary: "Pobiera koszyk gościa",
        operationId: "getCart",
        security: [{ CartCookie: [] }],
        responses: {
          "200": {
            description: "Aktualna zawartość koszyka.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(cartSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
        },
      },
    },
    "/cart/items": {
      post: {
        summary: "Dodaje produkt do koszyka",
        operationId: "addCartItem",
        security: [{ CartCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: zodToJsonSchema(addCartItemSchema, {
                target: "openApi3",
                $refStrategy: "none",
              }),
            },
          },
        },
        responses: {
          "200": {
            description: "Koszyk po dodaniu produktu.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(cartSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "400": {
            description: "Nieprawidłowe dane wejściowe.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(apiErrorSchema, {
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
          "409": {
            description: "Przekroczono limit ilości produktu w koszyku.",
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
    "/cart/items/{slug}": {
      patch: {
        summary: "Ustawia ilość produktu w koszyku",
        operationId: "updateCartItem",
        security: [{ CartCookie: [] }],
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: zodToJsonSchema(updateCartItemSchema, {
                target: "openApi3",
                $refStrategy: "none",
              }),
            },
          },
        },
        responses: {
          "200": {
            description: "Koszyk po aktualizacji ilości.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(cartSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "400": {
            description: "Nieprawidłowa ilość.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(apiErrorSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "404": {
            description: "Nie znaleziono produktu lub pozycji w koszyku.",
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
      delete: {
        summary: "Usuwa produkt z koszyka",
        operationId: "removeCartItem",
        security: [{ CartCookie: [] }],
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
            description: "Koszyk po usunięciu produktu.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(cartSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "404": {
            description: "Nie znaleziono produktu lub pozycji w koszyku.",
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
