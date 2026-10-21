import {
  data,
  Link,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "react-router";
import type { Route } from "./+types/checkout-complete";
import { getOrder } from "../services/orders.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  if (!params.id) {
    throw new Response("Nie podano numeru zamówienia.", { status: 400 });
  }
  const { order, setCookie } = await getOrder(request, params.id);
  return data(
    { order },
    { headers: setCookie ? { "Set-Cookie": setCookie } : undefined },
  );
}

function formatPrice(priceInCents: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
  }).format(priceInCents / 100);
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Zamówienie przyjęte — Shop" },
    { name: "description", content: "Potwierdzenie złożenia zamówienia." },
  ];
}

export default function CheckoutCompletePage() {
  const { order } = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">Zamówienie utworzone</p>
        <h1>Dziękujemy, {order.customerName}!</h1>
        <p className="intro">
          Zamówienie <strong>{order.id}</strong> zapisaliśmy jako oczekujące na
          płatność. W tej wersji sklepu płatności nie są obsługiwane.
        </p>
      </header>

      <section className="order-confirmation">
        <h2>Podsumowanie zamówienia</h2>
        <ul className="checkout-items">
          {order.items.map((item, index) => (
            <li key={`${item.productName}-${index}`}>
              <span>
                {item.productName} × {item.quantity}
              </span>
              <strong>
                {formatPrice(item.lineTotalInCents, order.currency)}
              </strong>
            </li>
          ))}
        </ul>
        <p className="cart-total">
          <span>Razem</span>
          <strong>{formatPrice(order.totalInCents, order.currency)}</strong>
        </p>
        <h3>Dostawa</h3>
        <p>
          {order.customerName}
          <br />
          {order.street}
          <br />
          {order.postalCode} {order.city}
          <br />
          {order.email}
        </p>
      </section>

      <Link className="primary-link" to="/">
        Wróć do sklepu
      </Link>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main className="page">
      <p className="eyebrow">{isNotFound ? "404" : "Zamówienie"}</p>
      <h1>
        {isNotFound
          ? "Nie znaleziono zamówienia."
          : "Nie udało się wczytać zamówienia."}
      </h1>
      <Link className="back-to-products" to="/">
        ← Wróć do sklepu
      </Link>
    </main>
  );
}
