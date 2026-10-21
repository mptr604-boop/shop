import {
  Form,
  data,
  isRouteErrorResponse,
  redirect,
  useActionData,
  useLoaderData,
  useRouteError,
} from "react-router";
import { updateStockSchema } from "@shop/contracts";
import type { Route } from "./+types/admin";
import {
  getAdminDashboard,
  logoutAdmin,
  updateProductStock,
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

  if (intent !== "update-stock") {
    return data({ error: "Nieznana operacja panelu." }, { status: 400 });
  }

  const productId = formData.get("productId");
  if (typeof productId !== "string" || productId.length === 0) {
    return data({ error: "Nie podano produktu." }, { status: 400 });
  }
  const stock = updateStockSchema.safeParse({
    stockQuantity: Number(formData.get("stockQuantity")),
  });
  if (!stock.success) {
    return data(
      { error: "Stan magazynowy musi być liczbą od 0 do 1 000 000." },
      { status: 400 },
    );
  }

  await updateProductStock(request, productId, stock.data.stockQuantity);
  return redirect("/admin");
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
        <h2 id="inventory-heading">Produkty i stany magazynowe</h2>
        <ul className="admin-product-list">
          {dashboard.products.map((product) => (
            <li className="admin-product" key={product.id}>
              <div>
                <h3>{product.name}</h3>
                <p>
                  {product.slug} ·{" "}
                  {formatPrice(product.priceInCents, product.currency)}
                </p>
              </div>
              <Form className="admin-stock-form" method="post">
                <input name="intent" type="hidden" value="update-stock" />
                <input name="productId" type="hidden" value={product.id} />
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
                <button className="secondary-button" type="submit">
                  Zapisz
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
