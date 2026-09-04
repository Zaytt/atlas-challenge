## 1. Filter Validation

- [x] 1.1 Add `EmployeeSummaryFilters`/query types and `parseEmployeeSummaryFilters` in `src/utils/validation.ts`, delegating all shared fields to `parseGlobalSummaryFilters` and parsing optional `employeeId` as a positive integer; verify unit tests cover omitted filters, a complete valid query, malformed `employeeId`, and propagation of shared-filter errors.

## 2. Employee Aggregation

- [x] 2.1 Extract the seven global-summary SQL filter conditions into a private reusable helper in `src/report.ts` without changing `buildGlobalSummary`; verify all existing global-summary report tests remain green.
- [x] 2.2 Add `EmployeeSummaryRow` and `buildEmployeeSummary`, joining employees and grouping rounded conditional totals by employee identity/home country and pay-item currency in employee-id/currency order; verify report tests assert the complete exact seeded result and numeric two-decimal totals.
- [x] 2.3 Apply all shared cycle filters plus optional `employeeId` with AND semantics; verify focused report tests cover every shared filter, employee-only filtering, combined matching filters, and valid empty results.
- [x] 2.4 Add transaction-scoped fixtures proving one employee receives separate currency rows and that response `countryCode` remains the employee home country while `country` filters payroll/pay-group country; verify no employee or currency amounts are combined.

## 3. HTTP Endpoint

- [x] 3.1 Reuse or extract the global route's country/pay-group reference checks without changing its behavior, then add employee existence validation; verify unknown country, pay group, and employee each return the documented `404` JSON error.
- [x] 3.2 Add documented `GET /reports/employee-summary`, parse all eight filters, return `400` for malformed filters, and return the direct `buildEmployeeSummary` row array with `200`; verify the endpoint JSDoc and response shape match the spec.
- [x] 3.3 Add API tests for unfiltered output, all shared filters, `employeeId`, malformed filters, unknown references, incompatible existing references, and existing employees with no matching items; verify existing global-summary API tests still pass.

## 4. Verification

- [x] 4.1 Run `pnpm run test` and `pnpm run typecheck` under the project Node version and confirm the full suite passes without regressions.
