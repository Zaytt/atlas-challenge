## Why

`GET /pay-items` builds `ORDER BY` from the raw `sort` query string via `sql.raw`, so any client can inject SQL against payroll data (FINDINGS C-02). `minAmount` is coerced with `Number()` without rejecting non-finite values, which weakens the filter. This must be fixed before the next pay run.

## What Changes

- Replace raw `ORDER BY` injection with an allowlisted set of sort columns mapped through Drizzle `orderBy` (no user text reaches `sql.raw`).
- Reject unknown `sort` values with HTTP `400`.
- Accept `minAmount` only when it is a finite number; otherwise respond `400` or omit the filter only when the param is absent (default sort `id` unchanged).
- Keep valid `minAmount` filtering and allowlisted `sort` (e.g. `amount`) working as today.
- Add/extend tests for allowlisted sort, rejected sort, and invalid `minAmount`.

## Capabilities

### New Capabilities

- `pay-items`: Safe listing of pay items with validated query params (`sort`, `minAmount`).

### Modified Capabilities

- (none — main specs are empty; this introduces the first pay-items requirements)

## Impact

- **Code:** `src/server.ts` (`GET /pay-items`); possibly a small shared allowlist helper if kept local to the route.
- **API:** Same path and success shape; **semi-breaking** only for clients that relied on arbitrary SQL identifiers in `sort` (those requests become `400`). Valid values such as `id` / `amount` remain supported.
- **Tests:** `src/server.test.ts` E8 plus new cases for `400` paths.
- **Out of scope:** Lifecycle write-locks (C-04/H-01), currency summary (C-01), broader validation across other routes (H-03).
