## 1. Secure GET /pay-items

- [x] 1.1 Replace `GET /pay-items` raw SQL with Drizzle `select().from(payItems)` plus allowlisted `orderBy` map (`id`, `amount`, `type`, `currency`, `payroll_cycle_id`, `employee_id`); default omit-`sort` to `id` — verify by code review that request `sort` text never reaches `sql.raw`
- [x] 1.2 Reject non-allowlisted `sort` with HTTP `400` and a short JSON error — verify with a request using an injection-like `sort` value
- [x] 1.3 Apply `minAmount` only when present and `Number.isFinite`; otherwise `400` when present-but-invalid, no filter when absent — verify with finite and non-finite query values

## 2. Tests

- [x] 2.1 Keep E8 (`minAmount=3000&sort=amount`) green and assert `200` plus amount filter — verify `npm test` covers E8
- [x] 2.2 Add test: `GET /pay-items` without `sort` returns `200` — verify in `src/server.test.ts`
- [x] 2.3 Add test: non-allowlisted / SQL-fragment `sort` returns `400` — verify in `src/server.test.ts`
- [x] 2.4 Add test: non-finite `minAmount` (e.g. `abc`) returns `400` — verify in `src/server.test.ts`
- [x] 2.5 Run `npm test` and `npm run typecheck` and confirm both pass
