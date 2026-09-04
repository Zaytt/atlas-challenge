## Purpose

Provides finance with country- and currency-safe payroll totals across matching payroll cycles, with optional filters for the payroll population, cycle dates, and cycle status.

## ADDED Requirements

### Requirement: Country- and currency-separated totals
`GET /reports/global-summary` SHALL return a JSON array containing one row for each country-code and pay-item-currency pair represented by matching pay items. Each row SHALL contain `countryCode`, `countryName`, `currency`, `totalEarnings`, `totalDeductions`, and `totalEmployerCost`. Monetary totals SHALL be numeric values rounded to at most two decimal places. The system MUST NOT combine amounts with different currencies into the same totals. Rows SHALL be ordered by `countryCode` and then `currency`.

#### Scenario: Unfiltered multi-country summary
- **WHEN** a client requests `GET /reports/global-summary` without filters
- **THEN** the response is `200` and contains separate rows for each country-and-currency pair represented by all payroll cycles
- **AND** every row contains numeric earnings, deductions, and employer-cost totals
- **AND** no total combines amounts from different currencies

#### Scenario: One country has pay items in multiple currencies
- **WHEN** matching pay items attributed to one country contain more than one currency
- **THEN** the response contains a separate row for each currency for that country

#### Scenario: Deterministic row order
- **WHEN** a summary contains multiple rows
- **THEN** rows are ordered by `countryCode` and then `currency` in ascending order

#### Scenario: Floating-point aggregation is rounded
- **WHEN** aggregating monetary values produces more than two fractional decimal places
- **THEN** each returned monetary total is rounded to at most two decimal places

### Requirement: Optional country and pay-group filters
The endpoint SHALL accept optional `country` and `payGroupId` query parameters. `country` SHALL be a comma-separated list containing one or more case-insensitive ISO 3166-1 alpha-2 country codes; the system SHALL normalize codes to uppercase and ignore duplicate codes. `payGroupId` SHALL be a positive integer. When supplied together, all filters SHALL be combined using AND semantics.

#### Scenario: Country filter limits pay groups
- **WHEN** a client requests the summary with one or more valid comma-separated `country` codes, such as `country=DE,US`
- **THEN** the response is `200` and includes only pay items from payroll cycles belonging to pay groups for those countries

#### Scenario: Country codes are normalized and deduplicated
- **WHEN** a client supplies lowercase or duplicate country codes
- **THEN** the codes are matched case-insensitively and each country appears only through its normal summary rows

#### Scenario: Pay-group filter limits cycles
- **WHEN** a client requests the summary with a valid `payGroupId`
- **THEN** the response is `200` and includes only pay items from payroll cycles belonging to that pay group

#### Scenario: Country and pay group do not correspond
- **WHEN** every `country` code and `payGroupId` identifies an existing resource but the pay group does not belong to any listed country
- **THEN** the response is `200` with an empty array

#### Scenario: Invalid country code
- **WHEN** any comma-separated `country` entry is empty or is not a two-letter country code
- **THEN** the response is `400` with a JSON error

#### Scenario: Unknown country
- **WHEN** any valid country code in the comma-separated list identifies no country
- **THEN** the response is `404` with a JSON error

#### Scenario: Invalid pay-group id
- **WHEN** a client supplies a `payGroupId` that is not a positive integer
- **THEN** the response is `400` with a JSON error

#### Scenario: Unknown pay group
- **WHEN** a client supplies a valid positive `payGroupId` that identifies no pay group
- **THEN** the response is `404` with a JSON error

### Requirement: Payroll-period overlap filters
The endpoint SHALL accept optional ISO `YYYY-MM-DD` `periodStart` and `periodEnd` query parameters as lower and upper bounds of a requested period. A payroll cycle SHALL match when its period overlaps the requested bounds: its `periodEnd` is on or after `periodStart`, when provided, and its `periodStart` is on or before `periodEnd`, when provided. If both bounds are supplied, `periodStart` MUST be on or before `periodEnd`.

#### Scenario: Both period bounds select overlapping cycles
- **WHEN** a client supplies valid `periodStart` and `periodEnd` filters
- **THEN** the response includes pay items only from cycles whose periods overlap the inclusive requested range

#### Scenario: Only lower period bound is supplied
- **WHEN** a client supplies only `periodStart`
- **THEN** the response includes pay items only from cycles ending on or after that date

#### Scenario: Only upper period bound is supplied
- **WHEN** a client supplies only `periodEnd`
- **THEN** the response includes pay items only from cycles starting on or before that date

#### Scenario: Invalid period date
- **WHEN** a client supplies a period bound that is not a real ISO `YYYY-MM-DD` date
- **THEN** the response is `400` with a JSON error

#### Scenario: Reversed period range
- **WHEN** a client supplies a `periodStart` later than `periodEnd`
- **THEN** the response is `400` with a JSON error

### Requirement: Exact cutoff and pay-date filters
The endpoint SHALL accept optional `cutoffDate` and `payDate` query parameters. `cutoffDate` SHALL be a real ISO `YYYY-MM-DD` date and SHALL match a cycle's cutoff date exactly. `payDate` SHALL be a non-negative integer Unix timestamp in seconds and SHALL match a cycle's pay date exactly.

#### Scenario: Exact cutoff date
- **WHEN** a client supplies a valid `cutoffDate`
- **THEN** the response includes pay items only from cycles whose cutoff date equals that value

#### Scenario: Exact pay date
- **WHEN** a client supplies a valid `payDate`
- **THEN** the response includes pay items only from cycles whose pay date equals that value

#### Scenario: Invalid cutoff date
- **WHEN** a client supplies a `cutoffDate` that is not a real ISO `YYYY-MM-DD` date
- **THEN** the response is `400` with a JSON error

#### Scenario: Invalid pay date
- **WHEN** a client supplies a `payDate` that is not a non-negative integer
- **THEN** the response is `400` with a JSON error

### Requirement: Current-status filter
The endpoint SHALL accept an optional `status` query parameter whose value is either `draft` or `approved`. The response SHALL include pay items only from cycles with the supplied status.

#### Scenario: Supported status filter
- **WHEN** a client supplies `status=draft` or `status=approved`
- **THEN** the response is `200` and includes pay items only from cycles with that status

#### Scenario: Unsupported status filter
- **WHEN** a client supplies any other `status`, including `processing` or `paid`
- **THEN** the response is `400` with a JSON error

### Requirement: Combined filters and empty results
The endpoint SHALL combine all supplied filters using AND semantics. Valid filters that match no cycles or no pay items SHALL return `200` with an empty array.

#### Scenario: Multiple matching filters
- **WHEN** a client supplies multiple valid filters
- **THEN** every amount included in the response comes only from pay items whose payroll cycle satisfies every supplied filter

#### Scenario: Valid filters match no data
- **WHEN** all supplied filters are valid and refer to existing country and pay-group resources but no pay items satisfy the complete filter set
- **THEN** the response is `200` with an empty array
