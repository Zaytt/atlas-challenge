# How I approached this challenge

## PART 1

First thing I did was to scan the repo for any malicious code, obfuscated code or anything that could be flagged as suspecious.
Second thing was to read the instructions and the ask AI to help me generate a summary of the codebase: architecture, file structure, critical flows and tech stack.

While the AI is working I took a look at the suggested files in the README file: server.ts, report.ts and the files under src/db.

I've marked my initial human-based findings under //TODO comments for each endpoint

### First initial findings in general

#### server.ts

- No error handling or validation in the server.ts endpoints
- No input sanitation
- No use of actual response code statuses
- No logging
- Endpoint could have better commenting, something like JSDoc

#### report.ts

- The buildGlobalSummary() function is mixing the currencies by adding them into the same totals
- Same function fetches the employee data, but never does anything with it. This slows down the report. It should be either removed or the employee data should be included in the final report.

#### schema.ts

- All tables could benefit from a created_at and updated_at field
- Autoincrement primary keys are technically not wrong, but depending on the system's goals (speed, distributed, safety) a UUID could be considered better

**Overall, the implementation is very optimistic: no DB failures, parameters are always expected to be the right type thus no validation or input sanitation**
