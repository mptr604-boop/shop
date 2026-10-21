import {
  apiErrorSchema,
  productListSchema,
  productSchema,
} from "@shop/contracts";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

export async function getProducts() {
  const response = await fetch(`${apiBaseUrl}/products`);

  if (!response.ok) {
    throw new Response("Nie udało się pobrać produktów.", { status: 502 });
  }

  const responseBody: unknown = await response.json();
  return productListSchema.parse(responseBody);
}

export async function getProduct(slug: string) {
  const response = await fetch(
    `${apiBaseUrl}/products/${encodeURIComponent(slug)}`,
  );

  if (response.status === 404) {
    const errorBody: unknown = await response.json();
    const error = apiErrorSchema.parse(errorBody);
    throw new Response(error.message, { status: 404 });
  }

  if (!response.ok) {
    throw new Response("Nie udało się pobrać produktu.", { status: 502 });
  }

  const responseBody: unknown = await response.json();
  return productSchema.parse(responseBody);
}
