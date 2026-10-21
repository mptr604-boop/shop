import {
  adminDashboardSchema,
  adminLoginSchema,
  adminProductInputSchema,
  adminSessionSchema,
  addCartItemSchema,
  apiErrorSchema,
  cartSchema,
  createOrderSchema,
  healthResponseSchema,
  orderIdSchema,
  orderSchema,
  productListSchema,
  productSchema,
  readinessResponseSchema,
  updateCartItemSchema,
  updateStockSchema,
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
      AdminCookie: {
        type: "apiKey",
        in: "cookie",
        name: "shop_admin",
        description: "Sesja administratora; cookie ustawia API po logowaniu.",
      },
    },
  },
  paths: {
    "/admin/login": {
      post: {
        summary: "Loguje administratora",
        operationId: "loginAdmin",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: zodToJsonSchema(adminLoginSchema, {
                target: "openApi3",
                $refStrategy: "none",
              }),
            },
          },
        },
        responses: {
          "200": {
            description: "Sesja administratora została utworzona.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(adminSessionSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "401": {
            description: "Nieprawidłowe dane logowania.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(apiErrorSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "503": {
            description: "Panel administratora nie jest skonfigurowany.",
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
    "/admin/logout": {
      post: {
        summary: "Wylogowuje administratora i unieważnia sesję",
        operationId: "logoutAdmin",
        responses: {
          "200": {
            description: "Sesja została unieważniona.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(adminSessionSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
        },
      },
    },
    "/admin/session": {
      get: {
        summary: "Sprawdza sesję administratora",
        operationId: "getAdminSession",
        responses: {
          "200": {
            description: "Stan sesji administratora.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(adminSessionSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
        },
      },
    },
    "/admin/dashboard": {
      get: {
        summary: "Pobiera produkty i ostatnie zamówienia",
        operationId: "getAdminDashboard",
        security: [{ AdminCookie: [] }],
        responses: {
          "200": {
            description: "Dane panelu administratora.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(adminDashboardSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "401": {
            description: "Wymagane logowanie administratora.",
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
    "/admin/products/{id}/stock": {
      patch: {
        summary: "Aktualizuje stan magazynowy produktu",
        operationId: "updateAdminProductStock",
        security: [{ AdminCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: zodToJsonSchema(updateStockSchema, {
                target: "openApi3",
                $refStrategy: "none",
              }),
            },
          },
        },
        responses: {
          "200": {
            description: "Zaktualizowany produkt.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(productSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "401": { description: "Wymagane logowanie administratora." },
          "404": { description: "Nie znaleziono produktu." },
        },
      },
    },
    "/admin/products": {
      post: {
        summary: "Dodaje produkt",
        operationId: "createAdminProduct",
        security: [{ AdminCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: zodToJsonSchema(adminProductInputSchema, {
                target: "openApi3",
                $refStrategy: "none",
              }),
            },
          },
        },
        responses: {
          "201": {
            description: "Utworzony produkt.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(productSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "400": { description: "Nieprawidłowe dane produktu." },
          "409": { description: "Adres produktu jest już zajęty." },
        },
      },
    },
    "/admin/products/{id}": {
      patch: {
        summary: "Edytuje produkt",
        operationId: "updateAdminProduct",
        security: [{ AdminCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: zodToJsonSchema(adminProductInputSchema, {
                target: "openApi3",
                $refStrategy: "none",
              }),
            },
          },
        },
        responses: {
          "200": {
            description: "Zaktualizowany produkt.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(productSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "400": { description: "Nieprawidłowe dane produktu." },
          "404": { description: "Nie znaleziono produktu." },
          "409": { description: "Adres produktu jest już zajęty." },
        },
      },
      delete: {
        summary: "Usuwa produkt",
        operationId: "deleteAdminProduct",
        security: [{ AdminCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "204": { description: "Produkt został usunięty." },
          "400": { description: "Nieprawidłowy identyfikator produktu." },
          "404": { description: "Nie znaleziono produktu." },
        },
      },
    },
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
            description: "Przekroczono limit ilości lub stan magazynowy.",
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
          "409": {
            description: "Ilość przekracza dostępny stan magazynowy.",
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
    "/orders": {
      post: {
        summary: "Tworzy zamówienie z koszyka",
        operationId: "createOrder",
        security: [{ CartCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: zodToJsonSchema(createOrderSchema, {
                target: "openApi3",
                $refStrategy: "none",
              }),
            },
          },
        },
        responses: {
          "201": {
            description: "Zamówienie utworzone; płatność nie jest obsługiwana.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(orderSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "400": {
            description: "Nieprawidłowe dane dostawy.",
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
            description:
              "Koszyk jest pusty, zawiera różne waluty albo brakuje sztuk w magazynie.",
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
    "/orders/{id}": {
      get: {
        summary: "Pobiera zamówienie koszyka gościa",
        operationId: "getOrder",
        security: [{ CartCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: zodToJsonSchema(orderIdSchema, {
              target: "openApi3",
              $refStrategy: "none",
            }),
          },
        ],
        responses: {
          "200": {
            description: "Szczegóły zamówienia.",
            content: {
              "application/json": {
                schema: zodToJsonSchema(orderSchema, {
                  target: "openApi3",
                  $refStrategy: "none",
                }),
              },
            },
          },
          "404": {
            description: "Nie znaleziono zamówienia dla tego koszyka.",
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
      post: {
          summary: "Anuluje zamówienie i przywraca produkty do magazynu",
          operationId: "cancelOrder",
          security: [{ CartCookie: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: zodToJsonSchema(orderIdSchema, {
                target: "openApi3",
                $refStrategy: "none",
              }),
            },
          ],
          responses: {
            "200": {
              description: "Anulowane zamówienie.",
              content: {
                "application/json": {
                  schema: zodToJsonSchema(orderSchema, {
                    target: "openApi3",
                    $refStrategy: "none",
                  }),
              },
            },
            "404": {
              description: "Nie znaleziono zamówienia dla tego koszyka.",
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
  },
};
