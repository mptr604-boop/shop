# Instrukcje dla agentów

1. **Najpierw przeczytaj [docs/STATUS.md](./docs/STATUS.md)**: mapa plików, stan, ograniczenia, decyzje. Nie skanuj całego monorepo, jeśli to wystarcza.
2. Po zmianie kodu lub decyzji zaktualizuj `docs/STATUS.md` w tym samym commicie.
3. Kontrakty (zod) żyją w `packages/contracts`. Po ich zmianie przebuduj pakiet (`npm run build --workspace @shop/contracts`); skrypty `dev`, `test:api` i `typecheck` robią to same.
4. Zmiany stanu magazynu tylko w transakcji, z blokadą wierszy i `ORDER BY id`.
5. Migracje: `npm run db:generate`, potem `npm run db:migrate`. Nie uruchamiaj ich automatycznie przy starcie.
6. Przed commitem: `npm run typecheck` i `npm run test:api`.
7. Nie commituj sekretów ani `.env`. Używaj plików `*.example`.
