# STATUS: czytaj to najpierw

Aktualizuj ten plik w tym samym commicie, w którym zmienia się kod lub decyzja. Cel: poniżej 150 linii.

**Ostatnia aktualizacja:** 2026-10-24 · **Node:** 24 (`.nvmrc`)

## 1. Czym jest projekt

Sklep internetowy w monorepo npm workspaces: React Router (SSR) + Express API + PostgreSQL (Drizzle), współdzielone kontrakty zod, Docker, CI/CD, rollback i backupy. Szczegóły uruchomienia: [README.md](../README.md).

## 2. Mapa plików

| Ścieżka | Zadanie |
|---|---|
| `apps/web` | Front: React Router renderowany po stronie serwera |
| `apps/api/src/app.ts`, `index.ts` | Aplikacja Express i start serwera; `/docs` (Swagger UI), `/openapi.json`, `/ready` |
| `apps/api/src/openapi.ts` | OpenAPI generowane ze schematów zod |
| `apps/api/src/modules/{catalog,cart,orders,admin}` | Moduły: routes → service → repository |
| `apps/api/src/modules/orders/orders.repository.ts` | Zamówienie w transakcji: blokada `FOR UPDATE`, `ORDER BY id` (unika deadlocków) |
| `apps/api/src/modules/orders/order-expiry.worker.ts` | Worker wygaszający nieopłacone zamówienia |
| `apps/api/src/middleware/request-logging.ts` | Logi z ID korelacji żądania |
| `apps/api/src/db/schema.ts`, `apps/api/drizzle/` | Schemat Drizzle i migracje |
| `packages/contracts` | Wspólne schematy zod i typy (front i API) |
| `deploy/` | `compose.yml`, `Dockerfile`, `Caddyfile`, skrypty `deploy.sh`, `rollback.sh`, `backup.sh`, `restore.sh`, `monitor.sh` |
| `.github/workflows/ci.yml` | CI, publikacja obrazów do GHCR, wdrożenie staging → produkcja |
| `tests/deploy/` | Testy skryptów monitoringu, odtwarzania backupu i dziennika wdrożeń |

## 3. Uruchomienie

`npm run dev` · `npm run db:migrate` · `npm run db:seed` · `npm run test:api` · `npm run typecheck` · `npm run build`
Migracje nie uruchamiają się automatycznie przy starcie API.

## 4. Stan funkcji

| Funkcja | Stan |
|---|---|
| Katalog, koszyk, zamówienia (transakcja, kontrola stanu magazynu) | ✅ |
| Panel admina | ✅ |
| OpenAPI + Swagger UI | ✅ |
| Logi z ID korelacji | ✅ |
| CI, obrazy GHCR, wdrożenie przez SSH (staging przed produkcją), rollback | ✅ |
| Backup, restore (testowany), monitoring z alertami webhookiem | ✅ |
| Dziennik wdrożeń `deploy/.state/journal.jsonl` (deploy, rollback z powodem, restore); testowany dla rollbacku, deploy/restore tylko `bash -n` | ✅ |
| Płatności | ❌ brak (celowo, zakres demonstracyjny) |

## 5. Znane ograniczenia (stan faktyczny)

- Brak realnych płatności.
- Testy API obejmują logowanie żądań i integrację zamówień. Testy UI i pełne E2E nie istnieją.
- Wdrożenie na VPS jest opcjonalne i wymaga własnej konfiguracji (domena, hash administratora, sekrety w `.env`).
- Nie sprawdzono tu aktualnego pokrycia testami ani wyników CI: zweryfikuj w GitHub Actions.

## 6. Decyzje

- Kontrakty zod we wspólnym pakiecie: jedno źródło prawdy dla frontu, API i OpenAPI.
- Stan magazynu zmieniany w transakcji z blokadą wierszy i stałą kolejnością (`ORDER BY id`).
- Migracje uruchamiane ręcznie, świadomie, a nie przy starcie.
- Staging przed produkcją; rollback do poprzedniego obrazu.
- Sekrety poza repo (`.env`, pliki `*.example`).

## 7. Dziennik zmian

| Data | Zmiana |
|---|---|
| 2026-10-24 | `docs/STATUS.md` i `AGENTS.md` |
