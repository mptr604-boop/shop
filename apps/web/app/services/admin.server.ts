import {
  adminDashboardSchema,
  adminLoginSchema,
  apiErrorSchema,
  type AdminProductInput,
  productSchema,
  type AdminLoginInput,
} from "@shop/contracts";

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

async function requestAdminApi(
  request: Request,
  path: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  const cookie = request.headers.get("Cookie");
  if (cookie) {
    headers.set("Cookie", cookie);
  }

  const response = await fetch(`${apiBaseUrl}/admin${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const error = apiErrorSchema.parse(await response.json());
    throw new Response(error.message, { status: response.status });
  }

  return {
    body: response.status === 204 ? undefined : ((await response.json()) as unknown),
    setCookie: response.headers.get("Set-Cookie"),
  };
}

export async function loginAdmin(request: Request, input: AdminLoginInput) {
  const result = await requestAdminApi(request, "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return { setCookie: result.setCookie };
}

export async function logoutAdmin(request: Request) {
  const result = await requestAdminApi(request, "/logout", { method: "POST" });
  return { setCookie: result.setCookie };
}

export async function getAdminDashboard(request: Request) {
  const result = await requestAdminApi(request, "/dashboard");
  return {
    dashboard: adminDashboardSchema.parse(result.body),
    setCookie: result.setCookie,
  };
}

export async function createAdminProduct(
  request: Request,
  input: AdminProductInput,
) {
  const result = await requestAdminApi(request, "/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return {
    product: productSchema.parse(result.body),
    setCookie: result.setCookie,
  };
}

export async function updateAdminProduct(
  request: Request,
  productId: string,
  input: AdminProductInput,
) {
  const result = await requestAdminApi(
    request,
    `/products/${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return {
    product: productSchema.parse(result.body),
    setCookie: result.setCookie,
  };
}

export async function deleteAdminProduct(request: Request, productId: string) {
  const result = await requestAdminApi(
    request,
    `/products/${encodeURIComponent(productId)}`,
    { method: "DELETE" },
  );
  return { setCookie: result.setCookie };
}
