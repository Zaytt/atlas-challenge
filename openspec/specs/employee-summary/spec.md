## Purpose

Provides finance with currency-safe earnings, deduction, and employer-cost totals for each employee across payroll cycles selected by the same filters as the global summary.

## Requirements

### Requirement: Employee- and currency-separated totals
`GET /reports/employee-summary` SHALL return a JSON array containing one row for each employee and pay-item-currency pair represented by matching pay items. Each row SHALL contain `employeeId`, `employeeName`, `countryCode`, `currency`, `totalEarnings`, `totalDeductions`, and `totalEmployerCost`. `countryCode` SHALL identify the employee's home country. Monetary totals SHALL be JSON numbers rounded to at most two decimal places. The system MUST NOT combine amounts from different employees or currencies. Rows SHALL be ordered by `employeeId` and then `currency` in ascending order.

#### Scenario: Unfiltered employee summary
- **WHEN** a client requests `GET /reports/employee-summary` without filters
- **THEN** the response is `200` and contains separate rows for every employee-and-currency pair represented by matching pay items
- **AND** every row contains numeric earnings, deduction, and employer-cost totals

#### Scenario: One employee has pay items in multiple currencies
- **WHEN** matching pay items for one employee contain more than one currency
- **THEN** the response contains one row per currency for that employee
- **AND** no total combines amounts from different currencies

#### Scenario: Employee country attribution
- **WHEN** an employee has matching pay items
- **THEN** each row for that employee contains the employee's home `countryCode`

#### Scenario: Deterministic order and rounding
- **WHEN** the report contains multiple rows or an aggregate produces more than two fractional decimal places
- **THEN** rows are ordered by `employeeId` and `currency`
- **AND** every monetary total is rounded to at most two decimal places

### Requirement: Global-summary-compatible cycle filters
The endpoint SHALL accept optional `country`, `payGroupId`, `periodStart`, `periodEnd`, `cutoffDate`, `payDate`, and `status` query parameters with the same validation and matching semantics as `GET /reports/global-summary`. The `country` filter SHALL select the payroll/pay-group country, independently of the employee home country returned in each row. All supplied filters SHALL be combined using AND semantics.

#### Scenario: Country and pay-group filters
- **WHEN** a client supplies valid `country` or `payGroupId` filters
- **THEN** the response includes only pay items from payroll cycles belonging to matching pay groups

#### Scenario: Payroll-cycle date and status filters
- **WHEN** a client supplies valid period-overlap, exact cutoff-date, exact pay-date, or status filters
- **THEN** the response includes only pay items whose payroll cycles satisfy every supplied filter

#### Scenario: Invalid shared filter
- **WHEN** any shared filter is malformed or unsupported
- **THEN** the response is `400` with a JSON error

#### Scenario: Unknown shared reference
- **WHEN** a valid `country` code or `payGroupId` identifies no resource
- **THEN** the response is `404` with a JSON error

#### Scenario: Existing shared references do not match
- **WHEN** all referenced countries and pay groups exist but the complete filter set matches no pay items
- **THEN** the response is `200` with an empty array

### Requirement: Optional employee filter
The endpoint SHALL accept an optional `employeeId` query parameter containing one positive integer. When supplied, the response SHALL include only pay items belonging to that employee.

#### Scenario: Existing employee is selected
- **WHEN** a client supplies an `employeeId` identifying an existing employee
- **THEN** the response is `200` and every row has that `employeeId`

#### Scenario: Invalid employee id
- **WHEN** a client supplies an `employeeId` that is not a positive integer
- **THEN** the response is `400` with a JSON error

#### Scenario: Unknown employee
- **WHEN** a client supplies a valid positive `employeeId` that identifies no employee
- **THEN** the response is `404` with a JSON error

#### Scenario: Existing employee has no matching pay items
- **WHEN** the employee exists but no pay items satisfy the complete filter set
- **THEN** the response is `200` with an empty array
