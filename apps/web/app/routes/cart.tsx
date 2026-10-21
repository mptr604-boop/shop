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
import {
  removeCartItem,
  getCart,
  updateCartItem,
} from "../services/cart.server";
import { updateCartItemSchema } from "@shop/contracts";
import type { Route } from "./+types/cart";

export async function loader({ request }: Route.LoaderArgs) {
  const { cart, setCookie } = await getCart(request);

  return data(
    { cart },
    { headers: setCookie ? { "Set-Cookie": setCookie } : undefined },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const slug = formData.get("slug");

  if (typeof slug !== "string" || slug.length === 0) {
    return data({ error: "Nie podano produktu." }, { status: 400 });
  }

  if (intent === "remove") {
    const { setCookie } = await removeCartItem(request, slug);
    return redirect("/cart", {
      headers: setCookie ? { "Set-Cookie": setCookie } : undefined,
    });
  }

  if (intent !== "update") {
    return data({ error: "Nieznana operacja koszyka." }, { status: 400 });
  }

  const input = updateCartItemSchema.safeParse({
    quantity: Number(formData.get("quantity")),
  });

  if (!input.success) {
    return data(
      { error: "Ilość musi być liczbą całkowitą od 1 do 99." },
      { status: 400 },
    );
  }

  const { setCookie } = await updateCartItem(request, slug, input.data.quantity);
  return redirect("/cart", {
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
    { title: "Koszyk — Shop" },
    { name: "description", content: "Produkty w Twoim koszyku." },
  ];
}

export default function CartPage() {
  const { cart } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">Twoje zakupy</p>
        <h1>Koszyk</h1>
        <p className="intro">
          {cart.itemCount === 1
            ? "1 produkt"
            : `${cart.itemCount} produktów`}
        </p>
      </header>

      {actionData?.error && (
        <p className="form-error" role="alert">
          {actionData.error}
        </p>
      )}

      {cart.items.length === 0 ? (
        <section className="empty-state">
          <h2>Koszyk jest pusty</h2>
          <p>Wybierz produkt z oferty, aby rozpocząć zakupy.</p>
          <Link className="primary-link" to="/">
            Przeglądaj produkty
          </Link>
        </section>
      ) : (
        <div className="cart-layout">
          <section aria-label="Produkty w koszyku">
            <ul className="cart-items">
              {cart.items.map((item) => (
                <li className="cart-item" key={item.productId}>
                  <div className="cart-item-main">
                    <div className="cart-item-art" aria-hidden="true">
                      {item.name.slice(0, 1)}
                    </div>
                    <div>
                      <h2>{item.name}</h2>
                      <p>{formatPrice(item.priceInCents, item.currency)}</p>
                    </div>
                  </div>

                  <div className="cart-item-actions">
                    <Form className="quantity-form" method="post">
                      <input name="intent" type="hidden" value="update" />
                      <input name="slug" type="hidden" value={item.slug} />
                      <label>
                        Ilość
                        <input
                          defaultValue={item.quantity}
                          max={99}
                          min={1}
                          name="quantity"
                          type="number"
                        />
                      </label>
                      <button className="secondary-button" type="submit">
                        Zmień
                      </button>
                    </Form>
                    <Form method="post">
                      <input name="intent" type="hidden" value="remove" />
                      <input name="slug" type="hidden" value={item.slug} />
                      <button className="text-button" type="submit">
                        Usuń
                      </button>
                    </Form>
                  </div>

                  <strong className="cart-line-total">
                    {formatPrice(item.lineTotalInCents, item.currency)}
                  </strong>
                </li>
              ))}
            </ul>
          </section>

          <aside className="cart-summary" aria-label="Podsumowanie koszyka">
            <h2>Podsumowanie</h2>
            {cart.totalsByCurrency.map((total) => (
              <p className="cart-total" key={total.currency}>
                <span>Razem</span>
                <strong>
                  {formatPrice(total.totalInCents, total.currency)}
                </strong>
              </p>
            ))}
            <p className="muted">Koszty dostawy obliczymy przy zamówieniu.</p>
            <Link className="checkout-button" to="/checkout">
              Przejdź do kasy
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.data
    : "Nie udało się wczytać koszyka.";

  return (
    <main className="page">
      <p className="eyebrow">Koszyk</p>
      <h1>Nie udało się wczytać koszyka.</h1>
      <p className="intro">{message}</p>
    </main>
  );
}
