import {
  apiErrorSchema,
  cartSchema,
  type Cart,
} from "@shop/contracts";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

type CartApiResult = {
  cart: Cart;
  setCookie: string | null;
};

async function requestCartApi(
  request: Request,
  path: string,
  init: RequestInit = {},
): Promise<CartApiResult> {
  const headers = new Headers(init.headers);
  const cookie = request.headers.get("Cookie");

  if (cookie) {
    headers.set("Cookie", cookie);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json();
    const error = apiErrorSchema.parse(errorBody);
    throw new Response(error.message, { status: response.status });
  }

  const responseBody: unknown = await response.json();

  return {
    cart: cartSchema.parse(responseBody),
    setCookie: response.headers.get("Set-Cookie"),
  };
}

export function getCart(request: Request) {
  return requestCartApi(request, "/cart");
}

export function addCartItem(
  request: Request,
  input: { slug: string; quantity: number },
) {
  return requestCartApi(request, "/cart/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateCartItem(
  request: Request,
  slug: string,
  quantity: number,
) {
  return requestCartApi(
    request,
    `/cart/items/${encodeURIComponent(slug)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    },
  );
}

export function removeCartItem(request: Request, slug: string) {
  return requestCartApi(
    request,
    `/cart/items/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
  );
}
