## ADDED Requirements

### Requirement: Reject pay items on locked cycles
The system SHALL reject creating a pay item when the target payroll cycle's status is `approved` or `paid`. The system SHALL respond `409` and MUST NOT persist a new pay-item row.

#### Scenario: Insert on approved cycle is rejected
- **WHEN** a client requests `POST /pay-items` for a cycle whose status is `approved`
- **THEN** the response is `409` and no new pay-item row is stored

#### Scenario: Insert on paid cycle is rejected
- **WHEN** a client requests `POST /pay-items` for a cycle whose status is `paid`
- **THEN** the response is `409` and no new pay-item row is stored

### Requirement: Allow pay items on unlocked cycles
The system SHALL accept creating a pay item when the target payroll cycle exists and its status is not `approved` or `paid` (including `draft` and `processing`). Nested pay items on `POST /payroll-cycles` SHALL still be stored because a newly created cycle has status `draft`.

#### Scenario: Insert on draft cycle succeeds
- **WHEN** a client requests `POST /pay-items` for a cycle whose status is `draft`
- **THEN** the response is successful and a pay-item row is stored

#### Scenario: Nested items on create remain allowed
- **WHEN** a client requests `POST /payroll-cycles` with valid nested `items`
- **THEN** the cycle is created as `draft` and the nested items are stored
