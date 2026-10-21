import {
  Form,
  data,
  isRouteErrorResponse,
  redirect,
  useActionData,
  useRouteError,
} from "react-router";
import { adminLoginSchema } from "@shop/contracts";
import type { Route } from "./+types/admin-login";
import { loginAdmin } from "../services/admin.server";

export async function loader() {
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const input = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!input.success) {
    return data({ error: "Podaj poprawny e-mail i hasło." }, { status: 400 });
  }

  const { setCookie } = await loginAdmin(request, input.data);
  return redirect("/admin", {
    headers: setCookie ? { "Set-Cookie": setCookie } : undefined,
  });
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Logowanie administratora — Shop" }];
}

export default function AdminLoginPage() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="page admin-page">
      <header className="page-header">
        <p className="eyebrow">Panel sklepu</p>
        <h1>Logowanie administratora</h1>
        <p className="intro">
          Dostęp jest ograniczony do konta skonfigurowanego na serwerze.
        </p>
      </header>

      {actionData?.error && (
        <p className="form-error" role="alert">
          {actionData.error}
        </p>
      )}
      <Form className="checkout-form admin-login-form" method="post">
        <label>
          E-mail administratora
          <input
            autoComplete="username"
            maxLength={255}
            name="email"
            required
            type="email"
          />
        </label>
        <label>
          Hasło
          <input
            autoComplete="current-password"
            maxLength={200}
            name="password"
            required
            type="password"
          />
        </label>
        <button className="primary-button" type="submit">
          Zaloguj się
        </button>
      </Form>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.data
    : "Nie udało się zalogować.";

  return (
    <main className="page">
      <p className="eyebrow">Panel sklepu</p>
      <h1>Nie udało się zalogować administratora.</h1>
      <p className="intro">{message}</p>
    </main>
  );
}
