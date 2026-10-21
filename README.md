# Sklep edukacyjny

Monorepo sklepu internetowego budowanego etapami z React 19, SSR, Express,
TypeScript i PostgreSQL.

## Wymagania

- Node.js 24 (wersję można ustawić przez `nvm use`)
- npm dołączony do Node.js

## Uruchomienie

```bash
npm install
npm run dev
```

Frontend jest dostępny pod `http://localhost:5173`, a API pod
`http://localhost:4000/health`. Interaktywna dokumentacja API znajduje się pod
`http://localhost:4000/docs`, a surowy dokument OpenAPI pod
`http://localhost:4000/openapi.json`.

Przydatne polecenia:

```bash
npm run dev:web
npm run dev:api
npm run typecheck
npm run build
```

## Struktura

- `apps/web` — aplikacja React Router renderowana po stronie serwera.
- `apps/api` — API HTTP w Express.
- `apps/api/src/openapi.ts` — dokument OpenAPI generowany ze współdzielonego
  schematu Zod i używany przez Swagger UI.
- `packages/contracts` — współdzielone schematy walidacji i typy.

PostgreSQL i Docker Compose dodamy w następnym etapie, razem z pierwszą
migracją bazy.
