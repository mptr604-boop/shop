import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("products/:slug", "routes/product-detail.tsx"),
  route("cart", "routes/cart.tsx"),
  route("favicon.ico", "routes/favicon.ts"),
] satisfies RouteConfig;
