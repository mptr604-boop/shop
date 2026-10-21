import { Link, isRouteErrorResponse, useLoaderData, useRouteError } from "react-router";
import type { Route } from "./+types/product-detail";
import { getProduct } from "../services/api.server";

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.slug) {
    throw new Response("Nie podano identyfikatora produktu.", { status: 400 });
  }

  return { product: await getProduct(params.slug) };
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Produkt — Shop" },
    { name: "description", content: "Szczegóły produktu w sklepie." },
  ];
}

export default function ProductDetail() {
  const { product } = useLoaderData<typeof loader>();
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
