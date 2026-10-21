import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("products/:slug", "routes/product-detail.tsx"),
  route("cart", "routes/cart.tsx"),
  route("checkout", "routes/checkout.tsx"),
  route("checkout/complete/:id", "routes/checkout-complete.tsx"),
  route("admin", "routes/admin.tsx"),
  route("admin/login", "routes/admin-login.tsx"),
  route("favicon.ico", "routes/favicon.ts"),
] satisfies RouteConfig;
