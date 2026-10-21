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
API zapisuje żądania i nieoczekiwane błędy jako logi JSON z identyfikatorem
`X-Request-Id`, który można przekazać przy zgłoszeniu problemu. Logi pomijają
częste sondy `/health` i `/ready`; błędy sprawdzenia bazy nadal są logowane.
Katalog produktów jest dostępny pod `GET /products`, a szczegóły pojedynczego
produktu pod `GET /products/{slug}`. Frontend renderuje listę i strony
szczegółów po stronie serwera.

Koszyk gościa jest dostępny przez `GET /cart`, `POST /cart/items`,
`PATCH /cart/items/{slug}` i `DELETE /cart/items/{slug}`. API identyfikuje
koszyk przez losowe cookie `HttpOnly`; w bazie zapisuje jego skrót, a nie
wartość cookie. Sesja wygasa po 30 dniach bez aktywności. Frontend umożliwia
dodawanie produktów i zarządzanie koszykiem. Produkt ma stan magazynowy:
koszyk sprawdza dostępność, a API atomowo ponownie weryfikuje i odejmuje sztuki
podczas tworzenia zamówienia, żeby równoległe zakupy nie sprzedały tego samego
stanu dwa razy. Checkout tworzy zamówienie z danymi dostawy i kopią pozycji
koszyka; płatności nie są jeszcze obsługiwane.
Klient może anulować nieopłacone zamówienie przez
`POST /orders/{id}/cancel`; stan magazynowy wraca wtedy do poprzedniej
wartości. Nieopłacone zamówienie wygasa po 30 minutach. API sprawdza je co
30 sekund, ustawia status `expired` i atomowo zwraca produkty do magazynu.
Uruchomienie kilku instancji API nie powoduje podwójnego zwrotu zapasu.
API udostępnia też `POST /orders` i `GET /orders/{id}`.

Panel administratora jest dostępny pod `/admin`. W `.env` ustaw `ADMIN_EMAIL`,
wygeneruj hash hasła przez `npm run admin:hash-password` i ustaw
`ADMIN_PASSWORD_HASH`. Panel używa losowego cookie sesji `HttpOnly`,
`SameSite=Strict`, ważnego 8 godzin; w PostgreSQL przechowywany jest tylko
skrót tokenu. Wylogowanie unieważnia sesję również po stronie serwera. Panel
pozwala dodawać, edytować i usuwać produkty oraz pokazuje 50 ostatnich
zamówień. Usunięcie produktu usuwa go z aktywnych koszyków, ale zachowuje
nazwę i cenę jako historyczny zapis w istniejących zamówieniach. Nie używaj
przykładowych ani słabych haseł na środowisku produkcyjnym.

## Opcjonalne wdrożenie na VPS

Katalog `deploy` zawiera produkcyjny obraz Docker, Compose z PostgreSQL i Caddy
(automatyczny HTTPS) oraz skrypty wdrożenia i rollbacku. Skrypty uruchamiaj na
VPS-ie, w czystym checkoutcie repozytorium. VPS powinien mieć Docker z wtyczką
Compose v2; domeny sklepu i `api.<domena>` dla każdego środowiska muszą
wskazywać na właściwy serwer, a porty 80 i 443 muszą być otwarte. Na początek
użyj osobnego VPS-a dla stagingu i produkcji.

Na serwerze skopiuj odpowiedni przykład konfiguracji, ustaw silne hasła i
uzupełnij hash administratora (wygenerowany lokalnie przez
`npm run admin:hash-password`). W pliku środowiskowym zapisz hash w
pojedynczych cudzysłowach, ponieważ zawiera znak `$`. Hasło bazy w
`DATABASE_URL` musi być URL-bezpieczne, tak by nie wymagało kodowania znaków
specjalnych.

```bash
cp deploy/.env.staging.example deploy/.env.staging
chmod 600 deploy/.env.staging
# Uzupełnij ustawienia, domenę stagingu oraz hash administratora.
git pull --ff-only
./deploy/scripts/deploy.sh staging
```

Do produkcji użyj osobnego pliku `deploy/.env.production` i uruchom
`./deploy/scripts/deploy.sh production`. Wdrożenie buduje obraz z bieżącego
commita, zapisuje backup PostgreSQL przed migracją, uruchamia migracje i
sprawdza gotowość API oraz SSR. Backupy lokalne na serwerze są przechowywane
przez 14 dni; skonfiguruj dodatkową kopię poza VPS-em przed użyciem produkcyjnym.
W razie problemu `./deploy/scripts/rollback.sh staging` (lub `production`)
przywraca poprzednią wersję aplikacji. Rollback nie cofa schematu ani danych
bazy; migracje wdrożeniowe muszą pozostać kompatybilne ze starą wersją aplikacji.
Ten skrypt nadal zarządza rollbackiem usług Docker Compose na hoście, na którym
uruchomiono produkcyjny stack; nie wymaga GitHub Actions. Nie usuwaj poprzednich
tagów obrazów, bo rollback uruchamia zachowany obraz poprzedniego release'u.

### CI/CD i obrazy Docker w GitHub Actions

Workflow CI uruchamia testy, kontrolę typów i build przy pushu oraz przy pull
requeście. Po udanym CI push na `main` publikuje obrazy aplikacji i migratora w
GitHub Container Registry (GHCR). Wypchnięcie taga
`vX.Y.Z` po przejściu CI publikuje dodatkowo wersjonowane obrazy. Pull requesty
obrazy budują i sprawdzają, ale ich nie publikują. Pipeline publikuje artefakty,
nie uruchamia publicznego sklepu i nie wymaga VPS-a.

Nazwy obrazów:

```text
ghcr.io/mptr604-boop/shop:main
ghcr.io/mptr604-boop/shop:sha-<commit>
ghcr.io/mptr604-boop/shop:latest
ghcr.io/mptr604-boop/shop:main-migrator
ghcr.io/mptr604-boop/shop:sha-<commit>-migrator
ghcr.io/mptr604-boop/shop:latest-migrator
```

Pobranie obrazów wymaga, by pakiet `shop` był publiczny albo by użytkownik
zalogował się do GHCR z uprawnieniami do prywatnego pakietu:

```bash
docker pull ghcr.io/mptr604-boop/shop:main
docker pull ghcr.io/mptr604-boop/shop:main-migrator
```

Widoczność pakietu można ustawić w ustawieniach pakietu GitHub. Do prezentacji
sklepu na laptopie nadal można uruchamiać projekt lokalnie (`npm run dev`); samo
opublikowanie obrazu w GHCR nie wystawia aplikacji w internecie.
Publikacja obrazów nie zastępuje rollbacku Dockera: skrypt
`deploy/scripts/rollback.sh production` pozostaje dostępny dla hosta, na którym
działa produkcyjny stack. Usunięta została tylko automatyzacja GitHub łącząca
się z hostem przez SSH, bo wymagałaby VPS-a i sekretów dostępowych.

Dependabot co tydzień proponuje grupowane aktualizacje zależności npm i GitHub
Actions jako osobne pull requesty; każdy z nich przechodzi przez ten sam CI.

#### Odtwarzanie backupu bazy

Odtwarzanie zastępuje bieżącą bazę i wymaga wpisania dokładnego potwierdzenia.
Przed zmianą skrypt weryfikuje sumę SHA-256 i archiwum, tworzy świeży backup
ochronny, odtwarza wybraną kopię do tymczasowej bazy i dopiero wtedy przełącza
aplikację. Poprzednia baza zostaje na serwerze pod nazwą wypisaną przez skrypt;
usuń ją dopiero po sprawdzeniu danych i działania sklepu. Operacja wymaga
zatrzymania usług aplikacji na czas przełączenia.

```bash
ls -lh deploy/backups/production
./deploy/scripts/restore.sh production 20261021T120000Z.dump
```

Uruchamiaj skrypt interaktywnie na VPS-ie. Kopie nadal znajdują się na tym samym
serwerze, dlatego przed produkcyjnym użyciem skonfiguruj dodatkowy backup poza
VPS-em.

### Monitorowanie i alerty

Skrypt monitorujący sprawdza HTTPS strony głównej oraz `/ready` API. Alert
wysyła tylko przy zmianie stanu (awaria/powrót), przez Slack-compatible
incoming webhook; po odzyskaniu dostępności wysyła powiadomienie o powrocie.
Wymaga `curl` i Python 3. Ustaw URL webhooka w zmiennej `ALERT_WEBHOOK_URL`
procesu uruchamiającego skrypt; przykładowy plik `deploy/.env.monitoring`
można zabezpieczyć przez `chmod 600`.

```bash
cp deploy/.env.monitoring.example deploy/.env.monitoring
chmod 600 deploy/.env.monitoring
# Wstaw URL Slack-compatible webhooka do pliku.
set -a
. deploy/.env.monitoring
set +a
./deploy/scripts/monitor.sh production https://shop.example.com https://api.shop.example.com
```

Uruchamiaj polecenie co 5 minut z crona (z katalogu repozytorium), przekierowując
wyjście do chronionego pliku logu. Pierwszy poprawny odczyt jest traktowany jako
stan początkowy bez wysyłania alertu. Jeśli webhook nie jest ustawiony lub nie
odpowiada, skrypt kończy się błędem, więc awaria dostarczenia alertu nie jest
ukrywana. To podstawowy monitoring dostępności HTTP; logi wyjątków API nadal
wymagają osobnego centralnego zbierania.

Przykładowy wpis crona (zmień ścieżkę repozytorium i domeny):

```cron
*/5 * * * * cd /srv/shop && set -a && . deploy/.env.monitoring && set +a && ./deploy/scripts/monitor.sh production https://shop.example.com https://api.shop.example.com >> /var/log/shop-monitor.log 2>&1
```

Przydatne polecenia:

```bash
npm run dev:web
npm run dev:api
npm run db:generate
npm run db:migrate
npm run db:seed
npm run typecheck
npm run test:api
npm run build
```

Testy integracyjne API wymagają działającego PostgreSQL z zastosowanymi
migracjami i przykładowymi produktami (`npm run db:migrate` oraz
`npm run db:seed`). Testy tworzą własne koszyki testowe i sprzątają je po
zakończeniu. GitHub Actions wykonuje migracje, testy, sprawdzenie typów i build
przy każdym pushu oraz pull requeście.

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
