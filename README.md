# Shop

Aplikacja sklepu internetowego oparta na React 19 z renderowaniem po stronie
serwera, API REST w Express i TypeScript oraz PostgreSQL. Repozytorium korzysta
z npm workspaces; schemat bazy i migracje obsługuje Drizzle ORM.

## Wymagania

- Node.js 24 (wersję można ustawić przez `nvm use`)
- npm dołączony do Node.js
- Docker z Docker Compose

## Uruchomienie

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run dev
```

Frontend działa pod `http://localhost:5173`, a API pod
`http://localhost:4000`. Interaktywna dokumentacja API jest dostępna pod
`http://localhost:4000/docs`, a dokument OpenAPI pod
`http://localhost:4000/openapi.json`. Endpoint `GET /health` sprawdza proces
API, natomiast `GET /ready` sprawdza również połączenie z bazą danych.

Przydatne polecenia:

```bash
npm run dev:web
npm run dev:api
npm run db:generate
npm run db:migrate
npm run db:seed
npm run typecheck
npm run build
```

## Struktura

- `apps/web` — aplikacja React Router renderowana po stronie serwera.
- `apps/api` — API HTTP w Express.
- `apps/api/src/openapi.ts` — dokument OpenAPI generowany ze współdzielonego
  schematu Zod i używany przez Swagger UI.
- `apps/api/src/db/schema.ts` — schemat PostgreSQL zarządzany przez Drizzle.
- `apps/api/drizzle` — migracje bazy danych.
- `packages/contracts` — współdzielone schematy walidacji i typy.

## Baza danych

Lokalna instancja PostgreSQL działa w Docker Compose, a jej dane są
przechowywane w wolumenie `postgres_data`. Plik `.env` zawiera ustawienia
lokalne i nie powinien trafiać do repozytorium. Endpoint `GET /ready` zwraca
status `503`, gdy baza danych jest niedostępna.

Schemat bazy znajduje się w `apps/api/src/db/schema.ts`. Polecenie
`npm run db:generate` generuje migrację Drizzle, a `npm run db:migrate`
stosuje oczekujące migracje. Migracje nie uruchamiają się automatycznie przy
starcie API.

`npm run db:seed` dodaje przykładowe produkty. Operacja jest bezpieczna do
ponownego uruchomienia — istniejące produkty o tych samych slugach pozostają
bez zmian. Lista produktów jest dostępna pod `GET /products` i wyświetlana na
stronie głównej przez loader renderowany po stronie serwera.
