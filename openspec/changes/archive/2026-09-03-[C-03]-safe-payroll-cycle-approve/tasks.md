## 1. Approve handler

- [x] 1.1 Validate `POST /payroll-cycles/:id/approve` `:id` as a decimal digit string that `Number`s to a value passing `isPositiveInt`; otherwise respond `400` with `{ error: "Invalid id" }` — verify with a request using `:id=abc`
- [x] 1.2 Select the cycle by id before updating; if missing, respond `404` with `{ error: "Payroll cycle not found" }` and do not throw — verify with a request using an unused numeric id (e.g. `9999`)
- [x] 1.3 Update status to `approved` only after the cycle is found; return `200` `{ id, status }` without `row!` — verify existing E5 still passes

## 2. Tests

- [x] 2.1 Keep E5 green: `POST /payroll-cycles/2/approve` returns `200` and `status: 'approved'` — verify in `src/server.test.ts`
- [x] 2.2 Add test: non-numeric `:id` returns `400` — verify in `src/server.test.ts`
- [x] 2.3 Add test: unknown numeric id returns `404` — verify in `src/server.test.ts`
- [x] 2.4 Run `npm test` and `npm run typecheck` and confirm both pass
