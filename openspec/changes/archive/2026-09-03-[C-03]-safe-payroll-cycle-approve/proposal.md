## Why

`POST /payroll-cycles/:id/approve` always runs an update, then reads the row with a non-null assertion (`row!`). When the cycle does not exist—or when `:id` is not a number—the select returns `undefined` and the handler throws, so a core lifecycle action returns an unhandled 500 instead of a controlled error (FINDINGS C-03). This must be fixed before relying on approve in the next pay run.

## What Changes

- Validate `:id` as a finite integer before touching the database; invalid → HTTP `400`.
- Load the payroll cycle first; if no row exists, respond `404` and do not throw.
- Apply the existing approve update only when the cycle exists; keep the current success body `{ id, status }` with `200`.
- Add tests for missing id (`404`), non-numeric id (`400`), and the existing happy path (E5).

## Capabilities

### New Capabilities

- `payroll-cycles`: Safe approval of a payroll cycle by id, with validated params and explicit not-found handling.

### Modified Capabilities

- (none — main specs are empty; this introduces the first payroll-cycles requirements)

## Impact

- **Code:** `src/server.ts` (`POST /payroll-cycles/:id/approve`).
- **API:** Same path and success shape. Clients that previously received a 500 for unknown/non-numeric ids now get `404` / `400`. Not a breaking change for valid existing cycles.
- **Tests:** `src/server.test.ts` E5 plus new cases for `400` and `404`.
- **Out of scope:** Full lifecycle / illegal transitions (H-01), write-lock on approved cycles (C-04), GET cycle `null` vs `404` (M-03), shared validation layer for all routes (H-03).
