## Context

See proposal.md — Why and `specs/employee-summary/spec.md` for the contract. `buildGlobalSummary` currently performs one Drizzle aggregate query over pay items, payroll cycles, pay groups, and countries. It builds optional conditions inline, groups by payroll country and pay-item currency, rounds SQL aggregates to two decimals, and orders deterministically. The HTTP route parses filters with `parseGlobalSummaryFilters` and separately verifies country and pay-group references before calling the report.

Pay items also reference employees. The schema enforces both references but does not enforce that an employee's home country matches the country of every payroll cycle containing that employee. Therefore the selected employee/currency row shape cannot safely use payroll country as a row dimension: the response `countryCode` must come from the employee, while the existing `country` query filter continues to select payroll/pay-group country.

## Goals / Non-Goals

**Goals:**

- Reuse the established global-summary filter validation and matching behavior.
- Produce all employee totals in one grouped database query without N+1 lookups.
- Keep employee and currency boundaries explicit and deterministic.
- Avoid changing the existing global-summary response or filter contract.

**Non-Goals:**

- Adding pagination, sorting parameters, or employee-name search.
- Returning employees with zero matching pay items as synthetic zero rows.
- Enforcing that employee country and payroll country match.
- Expanding supported cycle statuses beyond `draft` and `approved`.
- Refactoring reports into a new service or introducing a new dependency.

## Decisions

1. **New filter type extends the global filter contract**  
   Add `EmployeeSummaryFilters = GlobalSummaryFilters & { employeeId?: number }` and a corresponding query type. `parseEmployeeSummaryFilters` will delegate the seven shared fields to `parseGlobalSummaryFilters`, then parse `employeeId` with `parsePositiveIntParam`. This keeps normalization, real-date checks, period ordering, pay-date safety, and supported statuses identical.  
   **Alternative rejected:** Copy the global parser and add one field. Duplication would allow the two endpoints to drift.

2. **Share aggregate condition construction**  
   Extract the current global report's seven condition branches into a private helper that accepts `GlobalSummaryFilters`. `buildGlobalSummary` continues to use it unchanged. `buildEmployeeSummary` appends `payItems.employeeId = employeeId` when present.  
   **Alternative rejected:** Maintain a second condition list. The reports are intended to have the same cycle-filter semantics.

3. **One SQL aggregate grouped by employee and currency**  
   Join `payItems` to `employees`, `payrollCycles`, `payGroups`, and payroll `countries`. Select employee id, name, and `employees.countryCode`; group by those fields and `payItems.currency`; use the same rounded conditional sums as the global report; order by employee id then currency. Inner joins naturally omit employees without matching items.  
   **Alternative rejected:** Load items and aggregate in TypeScript. That transfers unnecessary rows, repeats monetary logic, and risks N+1 employee lookups.

4. **Employee country in rows; payroll country in filters**  
   `countryCode` is selected from `employees.countryCode`. The `country` filter remains a predicate on the country reached through payroll cycle → pay group, exactly as in the global report. This preserves one row per employee/currency even if inconsistent cross-country assignments exist.  
   **Alternative rejected:** Select payroll country without grouping by it. SQLite could return an arbitrary country when one employee/currency spans multiple payroll countries.

5. **Reference validation precedes aggregation**  
   The new route applies the same country and pay-group existence checks as the global route. A supplied `employeeId` is also checked independently: unknown → `404 Employee not found`. Existing references that are incompatible with one another or match no pay items return `200 []`. A small private route helper may centralize shared country/pay-group checks if it can preserve the existing global endpoint behavior exactly.  
   **Alternative rejected:** Treat an unknown employee as an empty result. The explicit filter names a resource, matching existing country/pay-group semantics.

6. **Focused tests plus global regression coverage**  
   Validation tests cover delegated shared behavior and employee-id parsing. Report tests assert exact seeded employee totals, deterministic ordering, each shared filter, employee filtering, combined AND semantics, rounding, and a transaction-scoped multi-currency fixture. Route tests cover shape, successful filters, malformed input, unknown references, and empty results. Existing global-summary tests remain the regression guard if condition or reference logic is shared.

## Risks / Trade-offs

- **[Risk] Shared helper refactoring changes global-summary behavior** → Keep its public types and query unchanged; run all existing report and route tests.
- **[Risk] Employee home country differs from filtered payroll country** → Document both meanings and test a transaction-scoped mismatch fixture.
- **[Risk] Large unpaginated result sets** → The grouped query bounds output to employee/currency pairs; pagination remains follow-up work if production volume requires it.
- **[Trade-off] Unknown employee costs one existence query before aggregation** → Consistent `404` semantics are worth the small indexed primary-key lookup.

## Migration Plan

- Deploy as an additive endpoint and function; no database migration is required.
- Existing clients and the global summary are unaffected.
- Rollback by removing the new endpoint/function/types and any private shared helpers, restoring the previous inline global conditions if necessary.

## Open Questions

- None that block implementation.
