import {
  Form,
  data,
  isRouteErrorResponse,
  redirect,
  useActionData,
  useLoaderData,
  useRouteError,
} from "react-router";
import { adminProductInputSchema } from "@shop/contracts";
import type { Route } from "./+types/admin";
import {
  createAdminProduct,
  deleteAdminProduct,
  getAdminDashboard,
  logoutAdmin,
  updateAdminProduct,
} from "../services/admin.server";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const { dashboard, setCookie } = await getAdminDashboard(request);
    return data(
      { dashboard },
      { headers: setCookie ? { "Set-Cookie": setCookie } : undefined },
    );
  } catch (error) {
    if (error instanceof Response && error.status === 401) {
      throw redirect("/admin/login");
    }
    throw error;
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "logout") {
    const { setCookie } = await logoutAdmin(request);
    return redirect("/admin/login", {
      headers: setCookie ? { "Set-Cookie": setCookie } : undefined,
    });
  }

  if (intent === "create-product" || intent === "update-product") {
    const input = adminProductInputSchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      description: formData.get("description") || null,
      priceInCents: Number(formData.get("priceInCents")),
      currency: formData.get("currency"),
      stockQuantity: Number(formData.get("stockQuantity")),
    });
    if (!input.success) {
      return data(
        { error: "Sprawdź dane produktu. Adres musi zawierać małe litery i myślniki." },
        { status: 400 },
      );
    }

    try {
      if (intent === "create-product") {
        await createAdminProduct(request, input.data);
      } else {
        const productId = formData.get("productId");
        if (typeof productId !== "string" || productId.length === 0) {
          return data({ error: "Nie podano produktu." }, { status: 400 });
        }
        await updateAdminProduct(request, productId, input.data);
      }
    } catch (error) {
      if (error instanceof Response) {
        return data({ error: await error.text() }, { status: error.status });
      }
      throw error;
    }
    return redirect("/admin");
  }

  if (intent === "delete-product") {
    const productId = formData.get("productId");
    if (typeof productId !== "string" || productId.length === 0) {
      return data({ error: "Nie podano produktu." }, { status: 400 });
    }
    try {
      await deleteAdminProduct(request, productId);
    } catch (error) {
      if (error instanceof Response) {
        return data({ error: await error.text() }, { status: error.status });
      }
      throw error;
    }
    return redirect("/admin");
  }

  return data({ error: "Nieznana operacja panelu." }, { status: 400 });
}

function formatPrice(priceInCents: number, currency: string) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
  }).format(priceInCents / 100);
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Panel administratora — Shop" }];
}

export default function AdminPage() {
  const { dashboard } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <main className="page admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Zarządzanie sklepem</p>
          <h1>Panel administratora</h1>
        </div>
        <Form method="post">
          <input name="intent" type="hidden" value="logout" />
          <button className="secondary-button" type="submit">
            Wyloguj
          </button>
        </Form>
      </header>

      {actionData?.error && (
        <p className="form-error" role="alert">
          {actionData.error}
        </p>
      )}

      <section className="admin-section" aria-labelledby="inventory-heading">
        <h2 id="inventory-heading">Produkty</h2>
        <Form className="checkout-form admin-product-form" method="post">
          <input name="intent" type="hidden" value="create-product" />
          <h3>Dodaj produkt</h3>
          <label>
            Nazwa
            <input maxLength={255} minLength={2} name="name" required />
          </label>
          <label>
            Adres produktu
            <input
              maxLength={255}
              name="slug"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
            />
          </label>
          <label>
            Opis
            <textarea maxLength={2000} name="description" rows={3} />
          </label>
          <div className="admin-product-fields">
            <label>
              Cena (grosze)
              <input
                max={100_000_000}
                min={0}
                name="priceInCents"
                required
                type="number"
              />
            </label>
            <label>
              Waluta
              <input
                defaultValue="PLN"
                maxLength={3}
                minLength={3}
                name="currency"
                pattern="[A-Z]{3}"
                required
              />
            </label>
            <label>
              Stan
              <input
                defaultValue={0}
                max={1_000_000}
                min={0}
                name="stockQuantity"
                required
                type="number"
              />
            </label>
          </div>
          <button className="primary-button" type="submit">
            Dodaj produkt
          </button>
        </Form>
        <ul className="admin-product-list">
          {dashboard.products.map((product) => (
            <li className="admin-product" key={product.id}>
              <Form className="checkout-form admin-product-form" method="post">
                <input name="intent" type="hidden" value="update-product" />
                <input name="productId" type="hidden" value={product.id} />
                <h3>{product.name}</h3>
                <div className="admin-product-fields">
                  <label>
                    Nazwa
                    <input
                      defaultValue={product.name}
                      maxLength={255}
                      minLength={2}
                      name="name"
                      required
                    />
                  </label>
                  <label>
                    Adres produktu
                    <input
                      defaultValue={product.slug}
                      maxLength={255}
                      name="slug"
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      required
                    />
                  </label>
                  <label>
                    Cena (grosze)
                    <input
                      defaultValue={product.priceInCents}
                      max={100_000_000}
                      min={0}
                      name="priceInCents"
                      required
                      type="number"
                    />
                  </label>
                  <label>
                    Waluta
                    <input
                      defaultValue={product.currency}
                      maxLength={3}
                      minLength={3}
                      name="currency"
                      pattern="[A-Z]{3}"
                      required
                    />
                  </label>
                  <label>
                    Stan
                  <input
                    aria-label={`Stan magazynowy: ${product.name}`}
                    defaultValue={product.stockQuantity}
                    max={1_000_000}
                    min={0}
                    name="stockQuantity"
                    required
                    type="number"
                  />
                  </label>
                </div>
                <label>
                  Opis
                  <textarea
                    defaultValue={product.description ?? ""}
                    maxLength={2000}
                    name="description"
                    rows={3}
                  />
                </label>
                <div className="admin-product-actions">
                  <button className="secondary-button" type="submit">
                    Zapisz zmiany
                  </button>
                </div>
              </Form>
              <Form
                method="post"
                onSubmit={(event) => {
                  if (!window.confirm(`Usunąć produkt „${product.name}”?`)) {
                    event.preventDefault();
                  }
                }}
              >
                <input name="intent" type="hidden" value="delete-product" />
                <input name="productId" type="hidden" value={product.id} />
                <button className="text-button" type="submit">
                  Usuń
                </button>
              </Form>
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-section" aria-labelledby="orders-heading">
        <h2 id="orders-heading">Ostatnie zamówienia</h2>
        {dashboard.orders.length === 0 ? (
          <p className="empty-state">Nie ma jeszcze zamówień.</p>
        ) : (
          <ul className="admin-order-list">
            {dashboard.orders.map((order) => (
              <li className="admin-order" key={order.id}>
                <div>
                  <h3>{order.customerName}</h3>
                  <p>{order.email}</p>
                  <p className="muted">
                    {order.id} ·{" "}
                    {new Date(order.createdAt).toLocaleString("pl-PL")}
                  </p>
                </div>
                <div className="admin-order-total">
                  <span className={`order-status order-status-${order.status}`}>
                    {order.status === "cancelled"
                      ? "Anulowane"
                      : order.status === "expired"
                        ? "Wygasło"
                        : "Oczekuje na płatność"}
                  </span>
                  <strong>
                    {formatPrice(order.totalInCents, order.currency)}
                  </strong>
                  <span>{order.items.length} pozycji</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.data
    : "Nie udało się wczytać panelu administratora.";

  return (
    <main className="page">
      <p className="eyebrow">Panel sklepu</p>
      <h1>Nie udało się wczytać panelu.</h1>
      <p className="intro">{message}</p>
    </main>
  );
}
