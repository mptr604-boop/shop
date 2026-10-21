import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Sklep — projekt edukacyjny" },
    {
      name: "description",
      content: "Edukacyjny projekt sklepu internetowego.",
    },
  ];
}

export default function Home() {
  return (
    <main className="page">
      <p className="eyebrow">Projekt edukacyjny</p>
      <h1>Fundament sklepu jest gotowy.</h1>
      <p className="intro">
        To miejsce będziemy rozwijać etapami: od katalogu produktów po
        wdrożenie i monitoring.
      </p>
      <ul className="stack">
        <li>React 19 renderowany po stronie serwera</li>
        <li>API w Express i TypeScript</li>
        <li>Wspólny kontrakt typów i walidacji</li>
      </ul>
    </main>
  );
}
