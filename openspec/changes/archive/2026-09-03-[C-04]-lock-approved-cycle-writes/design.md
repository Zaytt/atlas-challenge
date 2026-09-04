## Context

See proposal.md — Why. `POST /pay-items` in `src/server.ts` inserts with no cycle lookup. Seed cycle `1` is `approved`; cycle `2` is `draft` until E5 approves it. E7 currently posts to cycle `2`, so after E5 it writes to an approved run. `POST /payroll-cycles` always inserts `status: 'draft'` then nested items in the same transaction. Status is free text; `paid` / `processing` are not written by the API yet (H-01). Existing `{ error }` JSON and `src/utils/validation.ts` helpers are in place.

## Goals / Non-Goals

**Goals:**

- One status predicate used by every pay-item insert path.
- Fail with `409` before insert when locked; keep draft inserts working including E3 nested create.
- Keep E7 green without depending on E5's mutation of cycle `2`.

**Non-Goals:**

- Encoding legal status transitions (H-01).
- Full `POST /pay-items` body validation (H-03), except what is required to load the cycle.
- Isolating the test database (H-04) beyond retargeting E7.

## Decisions

1. **Locked statuses: exact `approved` and `paid`**  
   Helper e.g. `isCycleLocked(status: string): boolean` → `status === 'approved' || status === 'paid'`. All other values (including `draft` and `processing`) are writable.  
   **Rejected alternative:** treat only `draft` as writable — would lock unknown statuses and collide with H-01's `processing` allowance in FINDINGS C-04.

2. **Load cycle, then insert**  
   `POST /pay-items`: parse `payrollCycleId` with existing `isPositiveInt` (JSON number). Missing/invalid id → `400` `{ error: 'Invalid payrollCycleId' }` only when the value is present but not a positive int (minimal, needed to look up). Load cycle; none → `404` `{ error: 'Payroll cycle not found' }` (same wording as approve). Locked → `409` `{ error: 'Payroll cycle is locked' }` (or equivalent). Else insert as today (`{ id }`).  
   **Rejected alternative:** insert then check — a row could land before a conflict response.

3. **Shared predicate on nested create**  
   Call the same lock helper on the new cycle's status (`draft`) before nested inserts so both FINDINGS write paths share the rule. No extra HTTP branch on create today.  
   **Rejected alternative:** only guard `POST /pay-items` — nested path would drift if create ever accepted a client-supplied status.

4. **Tests**  
   E7: use seed draft cycle `4` (E5 only approves `2`). New: `POST /pay-items` on seed approved cycle `1` → `409`. Paid: no HTTP setter; assert the helper treats `paid` as locked (unit test next to validation) and/or a focused HTTP test that is not required if the helper is the single gate. Keep E3 nested-items `201`. Do not reset the DB.

## Risks / Trade-offs

- **[Risk] E7 order dependence (H-04)** → Mitigation: stop using cycle `2` for inserts.
- **[Trade-off] `404` on unknown `payrollCycleId`** → Slightly beyond C-04 text; required once we select before insert; aligns with C-03. Not a full H-03 validation layer.
- **[Trade-off] `paid` only locked in the helper until H-01 exists** → HTTP coverage for `paid` is optional; approved seed cycle covers the live path.

## Migration Plan

- Deploy handler + helper; no schema migration.
- Clients adding items to approved runs must stop or will see `409`.
- Rollback: revert the guard (reopens C-04).

## Open Questions

- None that block implementation.
