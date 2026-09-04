## Why

The global summary provides country-level payroll totals but cannot answer how earnings, deductions, and employer costs are distributed per employee. Finance needs a complementary, currency-safe employee report with the same payroll-cycle filters and direct employee lookup.

## What Changes

- Add `buildEmployeeSummary` in `src/report.ts`.
- Add `GET /reports/employee-summary` in `src/server.ts`.
- Return one row per employee and pay-item currency, containing `employeeId`, `employeeName`, the employee's home `countryCode`, `currency`, `totalEarnings`, `totalDeductions`, and `totalEmployerCost`.
- Support every existing global-summary filter: `country`, `payGroupId`, `periodStart`, `periodEnd`, `cutoffDate`, `payDate`, and `status`.
- Add an optional single `employeeId` filter. Malformed values return `400`; a valid but unknown employee returns `404`.
- Keep totals currency-separated, rounded to at most two decimal places, and deterministically ordered by employee id and currency.
- Add report, validation, and endpoint tests covering totals, filters, validation, reference checks, empty results, and multi-currency behavior.

## Capabilities

### New Capabilities

- `employee-summary`: Currency-safe per-employee payroll totals, global-summary-compatible filters, and optional employee filtering.

### Modified Capabilities

- (none)

## Impact

- **Code:** `src/report.ts`, `src/server.ts`, and `src/utils/validation.ts`.
- **API:** New read-only endpoint `GET /reports/employee-summary`; no existing endpoint changes.
- **Tests:** Extend report, validation, and server route coverage.
- **Data model/dependencies:** No migration or new dependency. Aggregation joins existing pay items, employees, payroll cycles, pay groups, and countries.
- **Compatibility:** The `country` query filter continues to mean the payroll/pay-group country, matching `GET /reports/global-summary`; response `countryCode` identifies the employee's home country so employee/currency grouping remains unambiguous. Existing resources whose combined filters match no pay items return `200 []`.
