## Context

See proposal.md — Why. Today `POST /payroll-cycles/:id/approve` in `src/server.ts` does:

```ts
const id = Number(c.req.param('id'));
db.update(payrollCycles).set({ status: 'approved' }).where(eq(payrollCycles.id, id)).run();
const row = db.select().from(payrollCycles).where(eq(payrollCycles.id, id)).get();
return c.json({ id: row!.id, status: row!.status });
```

`Number('abc')` is `NaN`; SQLite matches no row; `row!` throws. The same happens for a well-formed id with no matching cycle. `GET /payroll-cycles/:id` still returns `200` + `null` (M-03); this change does not alter that route. The file already has `isPositiveInt` for JSON bodies and `{ error: string }` JSON for `400`/`404`.

## Goals / Non-Goals

**Goals:**

- Make approve fail closed: validate id, then existence, then update.
- Keep the success contract (`200`, `{ id, status }`).
- Reuse existing id/error conventions in this file rather than adding a new error framework.

**Non-Goals:**

- Legal status transitions / re-approve rules (H-01).
- Changing GET-by-id not-found semantics (M-03).
- Shared param parsing across all routes (H-03) beyond what this handler needs.

## Decisions

1. **Parse `:id` as a positive integer path param**  
   Read the raw string. Accept only a decimal digit string that `Number`s to a value passing existing `isPositiveInt` (integer `> 0`). Else `400` with `{ error: 'Invalid id' }` (or equivalent short message).  
   **Rejected alternative:** `Number(id)` plus `Number.isFinite` only — floats (`2.5`), scientific notation (`1e2`), and empty/`NaN` would be inconsistent with autoincrement PKs and with `isPositiveInt` used on create.

2. **Select then update, not update-then-assert**  
   After a valid id, `select` the cycle. Missing → `404` `{ error: 'Payroll cycle not found' }` (wording can match nearby “not found” messages). Only then `update` status to `approved` and return `{ id, status }` from the loaded/updated row. Drop `row!`.  
   **Rejected alternative:** rely on SQLite `changes()` after a blind update — cheaper, but FINDINGS C-03 asks to load first, and select-first is clearer when H-01 later needs the current status.

3. **Error body**  
   Same `{ error: "..." }` JSON used elsewhere in `src/server.ts`. No Hono `onError` work in this change (M-07).

4. **Tests**  
   Keep E5 as the existing-cycle success path (seed cycle `2` is already `approved`; asserting `200` + `status: 'approved'` remains valid). Add cases: non-numeric `:id` → `400`; unused high id (e.g. `9999`) → `404`. Do not expand DB isolation (H-04).

## Risks / Trade-offs

- **[Risk] Shared in-memory DB (H-04)** → Mitigation: new tests only assert status codes and do not insert cycles solely for approve, so they do not change later totals.
- **[Trade-off] Re-approve still succeeds** → Intentional; H-01 owns illegal transitions. C-03 only stops the crash.
- **[Trade-off] GET-by-id still `200` + `null`** → Keeps this change to the approve crash; M-03 can align later.

## Migration Plan

- Deploy as a single handler change; no schema migration.
- Rollback: revert the handler (reintroduces the 500).

## Open Questions

- None that block implementation.
