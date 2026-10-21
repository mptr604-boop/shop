import {
  Form,
  Link,
  data,
  isRouteErrorResponse,
  redirect,
  useActionData,
  useLoaderData,
  useRouteError,
} from "react-router";
import { addCartItemSchema } from "@shop/contracts";
import type { Route } from "./+types/product-detail";
import { addCartItem } from "../services/cart.server";
import { getProduct } from "../services/api.server";

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.slug) {
    throw new Response("Nie podano identyfikatora produktu.", { status: 400 });
  }

  return { product: await getProduct(params.slug) };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const input = addCartItemSchema.safeParse({
    slug: formData.get("slug"),
    quantity: Number(formData.get("quantity")),
  });

  if (!input.success) {
    return data(
      { error: "Wybierz prawidłową ilość produktu (1–99)." },
      { status: 400 },
    );
  }

  const { setCookie } = await addCartItem(request, input.data);
  return redirect("/cart", {
    headers: setCookie ? { "Set-Cookie": setCookie } : undefined,
  });
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Produkt — Shop" },
    { name: "description", content: "Szczegóły produktu w sklepie." },
  ];
}

export default function ProductDetail() {
  const { product } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const price = new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: product.currency,
  }).format(product.priceInCents / 100);

  return (
    <main className="page">
      <Link className="back-to-products" to="/">
        ← Wszystkie produkty
      </Link>
      <article>
        <div className="product-art" aria-hidden="true">
          {product.name.slice(0, 1)}
        </div>
        <div className="product-details">
          <p className="eyebrow">Produkt</p>
          <h1>{product.name}</h1>
          <p className="product-description">
            {product.description ?? "Brak opisu produktu."}
          </p>
          <strong className="product-detail-price">{price}</strong>
          <Form className="add-to-cart-form" method="post">
            <input name="slug" type="hidden" value={product.slug} />
            <label>
              Ilość
              <input
                defaultValue={1}
                max={99}
                min={1}
                name="quantity"
                type="number"
              />
            </label>
            <button type="submit">Dodaj do koszyka</button>
          </Form>
          {actionData?.error && (
            <p className="form-error" role="alert">
              {actionData.error}
            </p>
          )}
        </div>
      </article>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main className="page">
      <p className="eyebrow">{isNotFound ? "404" : "Błąd"}</p>
      <h1>{isNotFound ? "Nie znaleziono produktu." : "Nie udało się wczytać produktu."}</h1>
      <Link className="back-to-products" to="/">
        ← Wróć do produktów
      </Link>
    </main>
  );
}
