import { useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { getProducts } from "../services/api.server";

export async function loader(_args: Route.LoaderArgs) {
  return { products: await getProducts() };
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Sklep — produkty" },
    {
      name: "description",
      content: "Przeglądaj produkty w naszym sklepie.",
    },
  ];
}

export default function Home() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">Drobne przyjemności na co dzień</p>
        <h1>Wybierz coś dobrego.</h1>
        <p className="intro">Starannie wybrane rzeczy, które umilają dzień.</p>
      </header>

      <section aria-labelledby="products-heading">
        <div className="section-heading">
          <h2 id="products-heading">Produkty</h2>
          <span>{products.length} produktów</span>
        </div>
        {products.length === 0 ? (
          <p className="empty-state">Aktualnie nie ma produktów w ofercie.</p>
        ) : (
          <ul className="product-grid">
            {products.map((product) => (
              <li className="product-card" key={product.id}>
                <div className="product-art" aria-hidden="true">
                  {product.name.slice(0, 1)}
                </div>
                <div className="product-details">
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <strong>
                    {new Intl.NumberFormat("pl-PL", {
                      style: "currency",
                      currency: product.currency,
                    }).format(product.priceInCents / 100)}
                  </strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
