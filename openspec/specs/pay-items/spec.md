# pay-items Specification

## Purpose

Defines safe listing of pay items: clients may filter by a minimum amount and order results only by allowlisted columns, with invalid query parameters rejected.

## Requirements

### Requirement: Allowlisted sort for pay item listing
The system SHALL accept an optional `sort` query parameter on `GET /pay-items` only when its value is one of an allowlisted set of pay-item columns. When `sort` is omitted, the system SHALL order results by `id`. The system MUST NOT interpolate unvalidated client text into SQL identifiers or clauses.

#### Scenario: Default sort by id
- **WHEN** a client requests `GET /pay-items` without a `sort` parameter
- **THEN** the response is `200` and items are ordered by `id`

#### Scenario: Allowlisted sort succeeds
- **WHEN** a client requests `GET /pay-items?sort=amount`
- **THEN** the response is `200` and items are ordered by `amount`

#### Scenario: Unknown sort is rejected
- **WHEN** a client requests `GET /pay-items` with a `sort` value that is not allowlisted (including values that contain SQL fragments)
- **THEN** the response is `400` and no rows are returned from an injected query

### Requirement: Finite minAmount filter
The system SHALL apply a minimum-amount filter on `GET /pay-items` only when `minAmount` is present and is a finite number. When `minAmount` is absent, the system SHALL return items without an amount lower bound. When `minAmount` is present but not a finite number, the system SHALL respond with `400`.

#### Scenario: Valid minAmount filters results
- **WHEN** a client requests `GET /pay-items?minAmount=3000`
- **THEN** the response is `200` and every returned item has `amount` greater than or equal to `3000`

#### Scenario: Invalid minAmount is rejected
- **WHEN** a client requests `GET /pay-items` with `minAmount` set to a non-finite value (for example `abc` or `Infinity`)
- **THEN** the response is `400`

#### Scenario: Combined valid sort and minAmount
- **WHEN** a client requests `GET /pay-items?minAmount=3000&sort=amount`
- **THEN** the response is `200`, every returned item has `amount` greater than or equal to `3000`, and results are ordered by `amount`
