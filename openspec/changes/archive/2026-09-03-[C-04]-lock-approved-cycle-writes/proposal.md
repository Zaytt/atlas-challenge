## Why

Pay items can still be inserted after a payroll cycle is `approved` (`POST /pay-items` never checks status; nested items on create share the same insert path). That leaves approved runs writable, so line items and totals can change after the run is supposed to be locked (FINDINGS C-04). This must be fixed before the next pay run.

## What Changes

- Reject new pay items when the target cycle status is `approved` or `paid`, with HTTP `409` and no row written.
- Allow inserts when the cycle is `draft` (and `processing`, if that status appears).
- **BREAKING:** `POST /pay-items` against an approved (or paid) cycle currently succeeds; it will return `409`.
- Point the existing E7 happy path at a cycle that remains draft after E5 (E5 approves seed cycle `2` on the shared test DB). Add tests for `409` on approved/paid and success on draft.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `payroll-cycles`: Approved and paid cycles MUST reject new pay-item writes; draft (and processing) cycles remain writable.

## Impact

- **Code:** `src/server.ts` (`POST /pay-items`; shared writable-status check used before nested inserts on `POST /payroll-cycles`). Possibly a small helper next to existing validation in `src/utils/validation.ts`.
- **API:** Same success shape for allowed inserts. Clients that added items to locked cycles get `409`.
- **Tests:** `src/server.test.ts` E7 plus new lock/unlock cases. Nested create-with-items (E3) stays valid because new cycles are always `draft`.
- **Out of scope:** Full lifecycle / illegal transitions (H-01), GET cycle `null` vs `404` (M-03), shared body validation for `POST /pay-items` (H-03), test-DB isolation beyond retargeting E7 (H-04).
