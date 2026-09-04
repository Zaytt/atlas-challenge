## 1. Lock helper and handlers

- [x] 1.1 Add `isCycleLocked` in `src/utils/validation.ts` (`approved` and `paid` only) — verify with a small unit test that `paid`/`approved` are locked and `draft`/`processing` are not
- [x] 1.2 Guard `POST /pay-items`: load cycle by `payrollCycleId`, `409` when locked with no insert, `404` when missing — verify with `POST` against seed cycle `1` (`approved`)
- [x] 1.3 Call `isCycleLocked` on the new cycle before nested inserts in `POST /payroll-cycles` — verify E3 nested-items still returns `201`

## 2. Tests

- [x] 2.1 Retarget E7 to seed draft cycle `4` and keep a successful insert — verify in `src/server.test.ts`
- [x] 2.2 Add test: `POST /pay-items` on approved cycle `1` returns `409` — verify in `src/server.test.ts`
- [x] 2.3 Run `npm test` and `npm run typecheck` and confirm both pass
