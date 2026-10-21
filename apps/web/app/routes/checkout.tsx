import {
  Form,
  data,
  isRouteErrorResponse,
  redirect,
  useActionData,
  useLoaderData,
  useRouteError,
} from "react-router";
import { createOrderSchema } from "@shop/contracts";
import type { Route } from "./+types/checkout";
import { getCart } from "../services/cart.server";
import { createOrder } from "../services/orders.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { cart, setCookie } = await getCart(request);
  if (cart.items.length === 0) {
    throw redirect("/cart", {
      headers: setCookie ? { "Set-Cookie": setCookie } : undefined,
    });
  }

  return data(
    { cart },
    { headers: setCookie ? { "Set-Cookie": setCookie } : undefined },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const input = createOrderSchema.safeParse({
    customerName: formData.get("customerName"),
    email: formData.get("email"),
    street: formData.get("street"),
    postalCode: formData.get("postalCode"),
    city: formData.get("city"),
  });

  if (!input.success) {
    return data(
      { error: "Sprawdź imię i nazwisko, e-mail oraz dane adresowe." },
      { status: 400 },
    );
  }

  const { order, setCookie } = await createOrder(request, input.data);
  return redirect(`/checkout/complete/${order.id}`, {
    headers: setCookie ? { "Set-Cookie": setCookie } : undefined,
  });
}

function formatPrice(priceInCents: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
  }).format(priceInCents / 100);
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Dane dostawy — Shop" },
    { name: "description", content: "Podaj dane do dostawy zamówienia." },
  ];
}

export default function CheckoutPage() {
  const { cart } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">Ostatni krok</p>
        <h1>Dane dostawy</h1>
        <p className="intro">
          Podaj dane kontaktowe i adres. To zamówienie nie pobiera płatności.
        </p>
      </header>

      {actionData?.error && (
        <p className="form-error" role="alert">
          {actionData.error}
        </p>
      )}

      <div className="checkout-layout">
        <Form className="checkout-form" method="post">
          <label>
            Imię i nazwisko
            <input autoComplete="name" maxLength={120} name="customerName" required />
          </label>
          <label>
            E-mail
            <input
              autoComplete="email"
              maxLength={255}
              name="email"
              required
              type="email"
            />
          </label>
          <label>
            Ulica i numer
            <input
              autoComplete="street-address"
              maxLength={200}
              name="street"
              required
            />
          </label>
          <div className="address-fields">
            <label>
              Kod pocztowy
              <input
                autoComplete="postal-code"
                maxLength={20}
                name="postalCode"
                required
              />
            </label>
            <label>
              Miasto
              <input autoComplete="address-level2" maxLength={100} name="city" required />
            </label>
          </div>
          <button className="primary-button" type="submit">
            Złóż zamówienie
          </button>
        </Form>

        <aside className="cart-summary" aria-label="Podsumowanie zamówienia">
          <h2>Podsumowanie</h2>
          <ul className="checkout-items">
            {cart.items.map((item) => (
              <li key={item.productId}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <strong>
                  {formatPrice(item.lineTotalInCents, item.currency)}
                </strong>
              </li>
            ))}
          </ul>
          {cart.totalsByCurrency.map((total) => (
            <p className="cart-total" key={total.currency}>
              <span>Razem</span>
              <strong>{formatPrice(total.totalInCents, total.currency)}</strong>
            </p>
          ))}
          <p className="muted">Płatność nie jest obecnie obsługiwana.</p>
        </aside>
      </div>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.data
    : "Nie udało się przygotować zamówienia.";

  return (
    <main className="page">
      <p className="eyebrow">Dane dostawy</p>
      <h1>Nie udało się wczytać checkoutu.</h1>
      <p className="intro">{message}</p>
    </main>
  );
}
