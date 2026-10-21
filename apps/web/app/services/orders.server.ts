import {
  apiErrorSchema,
  orderSchema,
  type CreateOrderInput,
} from "@shop/contracts";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

async function requestOrderApi(
  request: Request,
  path: string,
  init: RequestInit = {},
) {
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
    const error = apiErrorSchema.parse(await response.json());
    throw new Response(error.message, { status: response.status });
  }

  return {
    order: orderSchema.parse(await response.json()),
    setCookie: response.headers.get("Set-Cookie"),
  };
}

export function createOrder(request: Request, input: CreateOrderInput) {
  return requestOrderApi(request, "/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function getOrder(request: Request, id: string) {
  return requestOrderApi(request, `/orders/${encodeURIComponent(id)}`);
}
