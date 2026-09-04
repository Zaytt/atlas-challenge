## Purpose

Defines safe approval of a payroll cycle by id: the client can approve an existing cycle, and invalid or unknown ids are rejected with controlled HTTP errors instead of an unhandled failure.

## ADDED Requirements

### Requirement: Approve existing payroll cycle
The system SHALL accept `POST /payroll-cycles/:id/approve` when `:id` identifies an existing payroll cycle. On success the system SHALL set that cycle's status to `approved` and respond `200` with a JSON body containing the cycle `id` and `status`.

#### Scenario: Existing cycle is approved
- **WHEN** a client requests `POST /payroll-cycles/:id/approve` for an existing cycle
- **THEN** the response is `200` and the body includes that cycle's `id` and `status` equal to `approved`

### Requirement: Reject invalid approve id
The system SHALL reject `POST /payroll-cycles/:id/approve` with `400` when `:id` is not a positive integer (including non-numeric values). The system MUST NOT throw an unhandled error for such requests.

#### Scenario: Non-numeric id is rejected
- **WHEN** a client requests `POST /payroll-cycles/:id/approve` with a non-numeric `:id` (for example `abc`)
- **THEN** the response is `400`

### Requirement: Missing cycle on approve is not found
The system SHALL reject `POST /payroll-cycles/:id/approve` with `404` when `:id` is a valid positive integer but no payroll cycle with that id exists. The system MUST NOT throw an unhandled error for such requests.

#### Scenario: Unknown id is not found
- **WHEN** a client requests `POST /payroll-cycles/:id/approve` with a numeric id that matches no cycle
- **THEN** the response is `404`
