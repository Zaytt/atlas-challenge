## Context

See `proposal.md` for motivation and `specs/global-summary/spec.md` for observable behavior. The current route calls a zero-argument reporting function that loads every cycle, then every cycle's items, and totals all item currencies together in application code. The schema already provides the required join path: pay items → payroll cycles → pay groups → countries. Dates are currently stored as ISO text except `pay_date`, which is an integer Unix timestamp.

## Goals / Non-Goals

**Goals:**

- Validate and normalize all report query parameters before querying.
- Express all supplied filters as one composable database predicate.
- Compute totals in one grouped query and return a typed, deterministic response.
- Group on the pay item's currency so inconsistent data cannot silently mix monetary units.
- Keep resource-existence errors distinct from a valid filter combination with no matching payroll data.

**Non-Goals:**

- Currency conversion, exchange-rate lookup, or a cross-currency grand total.
- Changing date storage or migrating `pay_date` to ISO text (M-04).
- Implementing the full payroll-cycle lifecycle (H-01); this change accepts only currently supported statuses.
- Adding pagination, caching, or new database indexes before query measurements justify them.
- Changing payroll-cycle or pay-item creation rules.

## Decisions

### 1. Keep HTTP parsing separate from report aggregation

Add a focused query-parser in the shared validation module that returns either validated `GlobalSummaryFilters` or a validation error. The route will:

1. Parse and normalize query values, splitting `country` into a deduplicated array.
2. Check existence of every supplied country and the pay group independently.
3. Return `400` or `404` where required.
4. Pass only validated filters to `buildGlobalSummary`.

`buildGlobalSummary(filters)` will own query construction and aggregation, not HTTP response decisions. This keeps it callable and testable without a Hono context.

**Alternative considered:** pass raw query strings into `buildGlobalSummary`. Rejected because it mixes transport validation with data access and weakens the function's type boundary.

### 2. Aggregate with one joined SQL query

Build one Drizzle query starting from `pay_items`, inner-joining `payroll_cycles`, `pay_groups`, and `countries`. Select country code/name and pay-item currency, then calculate the three totals with `ROUND(SUM(CASE WHEN type = ... THEN amount ELSE 0 END), 2)`. Group by country code, country name, and pay-item currency; order by country code and currency.

Grouping by `pay_items.currency` is deliberate: it reflects the monetary unit attached to each amount and remains safe even if a pay item disagrees with its pay group's configured currency. Country attribution comes from the cycle's pay group, not from the employee, so the unused employee lookup and all current N+1 queries disappear.

**Alternative considered:** load rows and reduce them in TypeScript. Rejected because it transfers unnecessary data, preserves avoidable query loops, and makes currency isolation easier to regress.

### 3. Compose optional predicates with AND semantics

Create a condition list and append predicates only for supplied filters:

- `country`: membership in the normalized country-code array.
- `payGroupId`: equality on cycle pay-group id.
- `periodStart`: cycle period end is greater than or equal to the requested lower bound.
- `periodEnd`: cycle period start is less than or equal to the requested upper bound.
- `cutoffDate`, `payDate`, `status`: exact equality.

Combine the list with Drizzle's `and(...)`; omit the `WHERE` clause when no filters are supplied. ISO date text is chronologically sortable because every accepted date has canonical `YYYY-MM-DD` form.

**Alternative considered:** exact matching for period start/end. Rejected because finance requested range filtering and inclusive overlap preserves cycles that partially intersect the requested reporting period.

### 4. Validate references before running the aggregate

A syntactically valid but unknown country or pay-group id returns `404`; one country lookup retrieves all supplied codes and the route verifies that every deduplicated code exists. If all resources exist but the pay group belongs to none of the supplied countries, the existence checks pass and the aggregate naturally returns an empty array under AND semantics. The route will not infer a conflict error.

**Alternative considered:** use an empty aggregate result for unknown references. Rejected because it makes a mistyped resource indistinguishable from a known resource with no matching payroll data.

### 5. Return a direct array of explicit summary rows

The endpoint returns:

`Array<{ countryCode, countryName, currency, totalEarnings, totalDeductions, totalEmployerCost }>`

There is no grand-total object. SQL rounds monetary aggregates to two decimal places before numeric results are mapped to JavaScript numbers at the report boundary, and empty aggregate results remain `[]`. Because JSON numbers do not preserve display scale, whole or single-decimal totals remain numbers such as `585` or `7000.1`, not padded strings.

**Alternative considered:** an object keyed by country and currency. Rejected because a flat array is easier to type, iterate, order, and evolve without dynamic response keys.

## Risks / Trade-offs

- **[Breaking response contract]** Existing clients expecting scalar totals will fail → document the break, update route tests and JSDoc, and coordinate consumer migration; rollback is a code-only revert.
- **[Floating-point monetary arithmetic]** Existing amounts use SQLite `REAL`, so aggregation can produce binary floating-point artifacts → round aggregate results to two decimal places in SQL and test the formerly imprecise totals; changing storage to integer minor units is separate schema work.
- **[Status scope becomes stale]** The filter allows only `draft` and `approved` while H-01 remains open → centralize the allowed values so the list can be expanded with the lifecycle change.
- **[Unindexed filtering]** Date/status filters may scan tables as data grows → keep the single grouped query now and add indexes only after observing production query plans and volume.
- **[Currency mismatch becomes visible]** A country may produce multiple rows if item currencies differ from configuration → this is intentional safety behavior and exposes integrity problems instead of mixing money.

## Migration Plan

1. Land validation, grouped query, route integration, and tests together.
2. Update endpoint JSDoc and `FINDINGS.md` for C-01, M-01, and M-02 after acceptance criteria pass.
3. Notify any endpoint consumers that the response changes from one scalar object to an array of country-and-currency rows.
4. Roll back by reverting the code and documentation change; no data migration is involved.
