## Why

The global payroll summary currently combines amounts from different currencies into scalar totals, making the report financially invalid for a multi-country business. It also cannot be narrowed to the payroll population or cycle dates finance needs, while its implementation performs unnecessary per-item work.

## What Changes

- **BREAKING** Replace the scalar global-summary response with country-and-currency summary rows so unlike currencies are never combined.
- Add optional `country`, `payGroupId`, `periodStart`, `periodEnd`, `cutoffDate`, `payDate`, and `status` filters to `GET /reports/global-summary`; `country` accepts a comma-separated list such as `DE,US`.
- Treat `periodStart` and `periodEnd` as an optional overlap range; treat `cutoffDate` and `payDate` as exact-match filters.
- Restrict `status` to the statuses currently supported by the service: `draft` and `approved`.
- Return `404` when a valid country code or pay-group id identifies no resource, and `400` for malformed or unsupported filters.
- Return numeric earnings, deductions, and employer-cost totals for every matching country-and-currency pair; return an empty summaries collection when valid filters match no cycles or pay items.
- Remove the unused employee lookup and calculate the summary through grouped database aggregation.

## Capabilities

### New Capabilities

- `global-summary`: Country- and currency-safe payroll totals, optional report filters, validation, and empty-result behavior for the global summary endpoint.

### Modified Capabilities

None.

## Impact

- Changes the response contract and query parameters of `GET /reports/global-summary`.
- Changes the input and output contract of `buildGlobalSummary`.
- Affects `src/report.ts`, `src/server.ts`, shared query validation, and report/API tests.
- No schema migration or new dependency is required.
