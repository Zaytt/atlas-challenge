## Context

See proposal.md — Why. Today `GET /pay-items` in `src/server.ts` builds:

```ts
sql`SELECT * FROM ${payItems} ${conditions} ORDER BY ${sql.raw(sort)}`
```

`sort` defaults to `'id'`; the existing test E8 uses `sort=amount`. `minAmount` uses `Number(minAmount)` without rejecting `NaN` / non-finite values. Schema columns on `pay_items`: `id`, `payroll_cycle_id`, `employee_id`, `type`, `amount`, `currency`.

## Goals / Non-Goals

**Goals:**

- Eliminate identifier injection on this route.
- Preserve current happy-path behavior for omit-`sort`, `sort=amount`, and finite `minAmount`.
- Return clear `400`s for bad query params.

**Non-Goals:**

- Direction (`asc`/`desc`) query param (keep ascending-only unless already implied by DB default).
- Full request-validation layer for all routes (H-03).
- Changing response JSON shape of successful listings.

## Decisions

1. **Allowlist → Drizzle column map**  
   Map string keys to `payItems` column refs and pass them to `orderBy` / typed query builders. Prefer rewriting the handler to Drizzle `select().from(payItems).where(...).orderBy(...)` instead of string SQL with a safer `ORDER BY`, so column identity never leaves the ORM.  
   **Allowlist (API values = SQL column names used today):** `id`, `amount`, `type`, `currency`, `payroll_cycle_id`, `employee_id`.  
   **Rejected alternative:** regex-sanitizing `sort` then still using `sql.raw` — still brittle and unnecessary.

2. **`minAmount` validation**  
   If the query param is missing → no filter. If present → parse with `Number`; require `Number.isFinite(n)`; else `400`.  
   **Rejected alternative:** treat invalid as “no filter” — silent failure hides bad clients and weakens the acceptance criteria in FINDINGS.

3. **Error body**  
   Keep minimal: HTTP `400` with a short JSON `{ error: "..." }` (or Hono text) naming the bad param. No new error framework.

4. **Tests**  
   Keep E8 as the combined valid path. Add cases: missing sort (200), injection-like `sort` (400), non-finite `minAmount` (400). Assert status and that allowlisted paths never call `sql.raw` with request input (by construction / code review; tests focus on HTTP behavior).

## Risks / Trade-offs

- **[Risk] Clients using camelCase (`payrollCycleId`) get 400** → Mitigation: document allowlist as SQL/snake names matching today’s raw SQL; only `id` and `amount` are known in-tree consumers.
- **[Risk] Shared in-memory DB test order sensitivity (H-04)** → Mitigation: new assertions stay status/filter oriented like E8; do not expand suite isolation in this change.
- **[Trade-off] Asc-only sorting** → Enough for C-02; direction can be a later ADDED requirement.

## Migration Plan

- Deploy as a single route change; no schema migration.
- Rollback: revert the handler (reintroduces the vuln — prefer hotfix forward).

## Open Questions

- None that block implementation; allowlist set above matches schema + current test usage.
