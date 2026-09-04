# Payroll API - Audit Findings

This is an internal document directed towards the engineering team owning the next release  
The purpose is to have a prioritized catalog of bugs, risks, and improvements from a full pass over the payroll flow (HTTP routes → DB → global summary).

---

## Summary

The service originally worked only for the happy path, but the highest-risk validation, write-lock, logging, and multi-currency reporting findings have now been addressed. The full payroll lifecycle remains incomplete.

**Main problems to fix first:**

1. **[FIXED] Wrong currencies** — Global summary previously added EUR, GBP, and USD into the same totals (`C-01`).
2. **[FIXED] Security** — `GET /pay-items` builds `ORDER BY` from unsanitized user input (`C-02`).
3. **[FIXED] Fragile approve path** — Approving a missing cycle can crash the request (`C-03`).
4. **[FIXED] Unlocked pay runs** — Items can still be added after a cycle is approved (`C-04`).
5. **No real lifecycle** — Status is free text; illegal transitions are allowed; `processing` / `paid` are not modeled (`H-01`).
6. **[FIXED] Weak data integrity** — Pay items can reference non-existent employees; almost no input validation or consistent HTTP status codes (`H-02`, `H-03`).
7. **Tests still share mutable state** — Route tests use one in-memory database and mutate it across cases (`H-04`).

Everything else (performance, response shape, docs, timestamps) is important for quality but should not block the items above.

**Cycle status today:** free-text field, effectively `draft` | `approved` in seed/API. Product intent is `draft → processing → approved → paid`, with pay items read-only once approved.

---



## Severity at a glance


| Severity     | Count | Meaning                                                               |
| ------------ | ----- | --------------------------------------------------------------------- |
| **Critical** | 4     | Severe malfunction, exploit, crash, or unlocked approved runs         |
| **High**     | 4     | Lifecycle / integrity / validation / test gaps that can corrupt a run |
| **Medium**   | 7     | API semantics, performance, reporting filters, ops                    |
| **Low**      | 6     | DX and optional schema polish — not blocking the next pay run         |



| ID   | Severity | Title                                                 |
| ---- | -------- | ----------------------------------------------------- |
| C-01 | Critical | [FIXED] Global summary mixes currencies               |
| C-02 | Critical | [FIXED] SQL injection via `sort` on `GET /pay-items`  |
| C-03 | Critical | [FIXED] Approve missing cycle crashes                 |
| C-04 | Critical | [FIXED] Approved cycles remain writable               |
| H-01 | High     | No real lifecycle / illegal transitions               |
| H-02 | High     | [FIXED] `pay_items.employee_id` has no foreign key    |
| H-03 | High     | [FIXED] No validation or consistent HTTP status codes |
| H-04 | High     | Shared test DB; route tests remain order-coupled      |
| M-01 | Medium   | [FIXED] Dead employee lookup in summary (N+1)         |
| M-02 | Medium   | [FIXED] Report has no filters                         |
| M-03 | Medium   | [FIXED] Inconsistent “not found” behavior             |
| M-04 | Medium   | `pay_date` type inconsistency                         |
| M-05 | Medium   | [FIXED] Partial response bodies on create             |
| M-06 | Medium   | N+1 on `GET /getPayItemsByCycle`                      |
| M-07 | Medium   | [FIXED] No logging / structured error handling        |
| L-01 | Low      | [FIXED] JSDoc / short route docs                      |
| L-02 | Low      | [FIXED] Rename `out` in getPayItemsByCycle            |
| L-03 | Low      | RPC path `/getPayItemsByCycle`                        |
| L-04 | Low      | `created_at` / `updated_at`                           |
| L-05 | Low      | Auto-increment vs UUID PKs (debate, not a bug)        |
| L-06 | Low      | [FIXED] Stale TODO on `employees.countryCode` FK      |


**How to use:** treat each ID as a spec ticket. Fix Critical → High → Medium → Low. After a fix, mark the item done and clear the matching `// TODO` in code.

---



## Critical



### [FIXED] C-01 — Global summary mixes currencies into one total


|                         |                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Where**               | `src/report.ts` (`buildGlobalSummary`), `GET /reports/global-summary`                                                                                                  |
| **Issue**               | Earnings, deductions, and employer costs are summed across EUR, GBP, and USD as if they share a unit.                                                                  |
| **Why it matters**      | Finance cannot use the report; this data feeds real multi-currency payouts.                                                                                            |
| **Suggested fix**       | Return totals **per currency**. Do not invent FX rates unless product supplies them. Optional filters later (`M-02`).                                                  |
| **Acceptance criteria** | Response is grouped by currency. Multi-currency seed data never collapses into one scalar total. Tests assert numeric per-currency values, not only property presence. |




### [FIXED] C-02 — SQL injection via `sort` on `GET /pay-items`


|                         |                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **Where**               | `src/server.ts` — `GET /pay-items`                                                                        |
| **Issue**               | `ORDER BY ${sql.raw(sort)}` injects the query string into SQL. `minAmount` is weakly validated.           |
| **Why it matters**      | Attacker-controlled SQL against payroll data.                                                             |
| **Suggested fix**       | Allowlist sort columns via Drizzle `orderBy`. Require a finite number for `minAmount` or omit the filter. |
| **Acceptance criteria** | Non-allowlisted `sort` → `400`. No user text reaches `sql.raw`. Valid `minAmount` filtering still works.  |




### [FIXED] C-03 — Approve missing cycle crashes


|                         |                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **Where**               | `src/server.ts` — `POST /payroll-cycles/:id/approve`                                                      |
| **Issue**               | Update runs even when no row exists; response uses `row!` and can throw. Non-numeric `id` is not handled. |
| **Why it matters**      | Core lifecycle action can 500 instead of returning a controlled error.                                    |
| **Suggested fix**       | Validate id; load cycle first; missing → `404`; then apply transition rules.                              |
| **Acceptance criteria** | Unknown id → `404`, no throw. Non-numeric id → `400`. Existing cycle still returns a clear success body.  |




### [FIXED] C-04 — Approved cycles remain writable


|                         |                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Where**               | `src/server.ts` — `POST /pay-items`; nested items on `POST /payroll-cycles`                                                     |
| **Issue**               | Pay items can be added after `approved`. No status check.                                                                       |
| **Why it matters**      | Line items and totals can change after a run is supposedly locked.                                                              |
| **Suggested fix**       | Reject inserts when status is `approved` or `paid` with `409`.                                                                  |
| **Acceptance criteria** | Insert on approved/paid → `409`, no row written. Draft (and `processing`, if introduced) still allow inserts. Tests cover both. |


---



## High



### H-01 — No real lifecycle / illegal transitions allowed


|                         |                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Where**               | Approve handler; `payroll_cycles.status` in schema + `drizzle/0000_init.sql`                                             |
| **Issue**               | Status is free text. Approve always forces `approved`. No `processing` or `paid` path. Re-approve is a silent overwrite. |
| **Why it matters**      | Product needs `draft → processing → approved → paid` with only legal transitions.                                        |
| **Suggested fix**       | Encode allowed edges; reject illegal jumps with `409`.                                                                   |
| **Acceptance criteria** | Only legal transitions succeed. Illegal ones leave status unchanged and return `409`. Unknown cycle → `404`.             |




### [FIXED] H-02 — `pay_items.employee_id` has no foreign key


|                         |                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| **Where**               | `drizzle/0000_init.sql`, `src/db/schema.ts` (`payItems.employeeId`)                                      |
| **Issue**               | Orphan line items can be stored; list-by-cycle returns `employee_name: null`.                            |
| **Note**                | `employees.country_code` already has an FK. A schema `// TODO` claiming otherwise is stale — see `L-06`. |
| **Suggested fix**       | Add `REFERENCES employees(id)` in SQL + Drizzle; reject unknown employees.                               |
| **Acceptance criteria** | Unknown `employeeId` fails (FK / `400`). Seed still loads.                                               |




### [FIXED] H-03 — No validation or consistent HTTP status codes


|                         |                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Where**               | All routes in `src/server.ts`                                                                                                   |
| **Issue**               | Bodies/params are assumed valid. Missing resources often return `200` + empty/`null`. Failures are unhandled.                   |
| **Why it matters**      | Bad data enters cycles and reports; clients cannot tell “empty” from “not found.”                                               |
| **Suggested fix**       | Shared validation (ids, required fields, amount ≥ 0, allowed item types, country exists). Map to `400` / `404` / `409` / `500`. |
| **Acceptance criteria** | Invalid body → `400`. Missing country/cycle where applicable → `404`. See endpoint checklist below.                             |




### H-04 — Shared test DB; route tests remain order-coupled

`src/db/index.ts` exports one seeded in-memory database for the process. Report fixtures now use transactions and exact numeric assertions, but `src/server.test.ts` still creates cycles, approves cycles, and inserts pay items without resetting the database between tests. Some later endpoint assertions therefore account for earlier mutations instead of testing from an isolated seed state.

**Suggested fix:** expose a database/app factory or reset and reseed the database before each route test. Keep exact per-currency and per-employee report assertions in isolated report tests.

**Acceptance criteria:** route tests pass in any order from identical database state; one test's writes cannot affect another; currency-separated numeric report tests continue to fail if currencies are mixed.

---



## Medium



### [FIXED] M-01 — Dead employee lookup in `buildGlobalSummary` (N+1)

The unused per-item employee lookup and cycle/item query loops were removed. `buildGlobalSummary` now uses one joined, grouped aggregate query.

### [FIXED] M-02 — Report has no filters

`GET /reports/global-summary` now supports optional `country`, `payGroupId`, period overlap, exact cutoff/pay dates, and status filters with validation and tests.

### [FIXED] M-03 — Inconsistent “not found” behavior


| Route                             | Now                        |
| --------------------------------- | -------------------------- |
| `GET /payroll-cycles/:id`         | `404` when missing         |
| `GET /countries/:code/pay-groups` | `404` when country missing |
| Approve missing cycle             | `404`                      |


Prefer `404` when the parent resource does not exist; empty list only when the parent exists but has no children.

### M-04 — `pay_date` type inconsistency

`pay_date` is an integer (unix in seed) while period fields are ISO text. Standardize on one format (prefer ISO text) across schema, SQL, and seed.

### [FIXED] M-05 — Partial response bodies on create

`POST /payroll-cycles` and `POST /pay-items` now return the full inserted row with `201`.

### M-06 — N+1 on `GET /getPayItemsByCycle`

One employee query per item. Join or batch-load; keep the same response shape.

### [FIXED] M-07 — No logging / structured error handling

Hono `onError` returns JSON `500` for uncaught errors. Middleware logs every response with status ≥ 400 (`method`, `path`, `status`, `error`).

---



## Low / improvements


| ID   | Item                                             | Guidance                                                            |
| ---- | ------------------------------------------------ | ------------------------------------------------------------------- |
| L-01 | [FIXED] JSDoc / short route docs                 | JSDoc on each route in `src/server.ts` (params, body, status codes) |
| L-02 | [FIXED] Rename `out` in getPayItemsByCycle       | Renamed to `responseItems`                                          |
| L-03 | RPC path `/getPayItemsByCycle`                   | Prefer REST if product accepts a breaking change                    |
| L-04 | `created_at` / `updated_at`                      | Optional auditability                                               |
| L-05 | Auto-increment vs UUID PKs                       | Design debate, **not a bug** — do not block Critical/High           |
| L-06 | [FIXED] Stale TODO on `employees.countryCode` FK | Stale FK TODO removed; remaining schema TODOs are L-04 / L-05       |


---



## Endpoint checklist

Current gaps marked ✗. Fixed items marked ✓.


| Route                              | Validate params/body           | Meaningful status codes | Tied to          |
| ---------------------------------- | ------------------------------ | ----------------------- | ---------------- |
| `GET /countries`                   | ✓ n/a                          | ✓ 200 / 500             | H-03             |
| `GET /countries/:code/pay-groups`  | ✓ code                         | ✓ 400 / 404 / 200       | H-03, M-03       |
| `POST /payroll-cycles`             | ✓ body / items                 | ✓ 400 / 404 / 201       | H-03, C-04       |
| `GET /payroll-cycles/:id`          | ✓ id                           | ✓ 400 / 404 / 200       | H-03, M-03       |
| `POST /payroll-cycles/:id/approve` | ✓ id / existence; ✗ transition | ✓ 400 / 404 / 200       | C-03, H-01       |
| `GET /getPayItemsByCycle`          | ✓ cycleId                      | ✓ 400 / 404 / 200       | H-03, M-06       |
| `POST /pay-items`                  | ✓ body / cycle status          | ✓ 400 / 404 / 409 / 201 | C-04, H-02, H-03 |
| `GET /pay-items`                   | ✓ sort / minAmount             | ✓ 400 / 200             | **C-02**         |
| `GET /reports/global-summary`      | ✓ all optional filters         | ✓ 400 / 404 / 200       | C-01, M-01, M-02 |
| `GET /reports/employee-summary`    | ✓ all optional filters         | ✓ 400 / 404 / 200       | Additive report  |


---

