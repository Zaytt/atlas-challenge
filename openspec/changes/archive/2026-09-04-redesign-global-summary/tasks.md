## 1. Filter Validation

- [x] 1.1 Define typed global-summary filters and parse optional `country`, `payGroupId`, `periodStart`, `periodEnd`, `cutoffDate`, `payDate`, and `status` query values in `src/utils/validation.ts`; verify unit tests cover normalization, omitted values, malformed dates/ids, reversed periods, non-negative integer pay dates, and unsupported statuses.
- [x] 1.2 Add route-level country and pay-group existence checks that distinguish `404` unknown resources from valid combinations with no matches; verify API tests cover unknown resources and an existing country/pay-group mismatch.
- [x] 1.3 Accept `country` as a normalized, deduplicated comma-separated list and filter by all listed countries; verify `country=DE,US`, malformed list entries, and a list containing an unknown country through unit and API tests.

## 2. Summary Aggregation

- [x] 2.1 Replace the cycle/item query loops in `buildGlobalSummary` with one joined, conditionally filtered Drizzle aggregate grouped and ordered by country code and pay-item currency; verify report tests assert exact per-country/per-currency numeric totals and deterministic ordering for the seed data.
- [x] 2.2 Apply inclusive period-overlap predicates and exact country, pay-group, cutoff-date, pay-date, and status predicates with AND semantics; verify focused tests cover every filter individually, partial period bounds, combined filters, and valid empty results.
- [x] 2.3 Verify a country with pay items in two currencies yields two rows and no amount is combined across currencies, using a targeted report test fixture or transaction-scoped test data.
- [x] 2.4 Round every aggregate monetary total to at most two decimal places while retaining JSON number types; verify the US employer-cost total is exactly `697.58` and all totals contain no additional fractional precision.

## 3. HTTP Contract

- [x] 3.1 Update `GET /reports/global-summary` to parse query parameters, return JSON `400`/`404` errors, call `buildGlobalSummary` with validated filters, and return the direct summary-row array; verify API tests cover success, validation failures, reference failures, and empty results.
- [x] 3.2 Update the route JSDoc to document all query parameters, the breaking country-and-currency row shape, and status codes; verify it matches the implemented endpoint contract.

## 4. Completion

- [x] 4.1 Remove the resolved summary TODO comments and mark C-01, M-01, and M-02 `[FIXED]` in `FINDINGS.md` only after their acceptance tests pass; verify the endpoint checklist and recommended fix order are consistent.
- [x] 4.2 Run `pnpm run test` and `pnpm run typecheck` under Node 22 and verify both commands pass without regressions.
