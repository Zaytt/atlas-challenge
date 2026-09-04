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
- Injecting input directly into SQL query
- No use of actual response code statuses
- No logging
- Endpoint could have better commenting, something like JSDoc



#### report.ts

- The buildGlobalSummary() function is mixing the currencies by adding them into the same totals
- Same function fetches the employee data, but never does anything with it. This slows down the report. It should be either removed or the employee data should be included in the final report.



#### schema.ts

- All tables could benefit from a created_at and updated_at field
- Autoincrement primary keys are technically not wrong, but depending on the system's goals (speed, distributed, safety) a UUID could be considered better

**Diagnose:** Overall, the implementation is very optimistic and built for the happy path: noerror handling, parameters are not sanitized nor validated, the test suite should be expanded

I then corroborated my findings with those of the AI agent that I run at the beginning, confirming many of my suspicions.

With all this information I then created an internal doc called [FINDINGS.md](FINDINGS.md) which works both as a deliverable for PART 1 of this challenge as well as the starting point for PART 2.

## PART 2

Now that we have a clear diagnose of the issues in the codebase, we can start implementing them.
The challenge asks to implement one of two features:

- Option A — Company-wide payroll summary 
- Option B — Cycle lifecycle

I went with option A, because I liked the idea of crafting a detailed company summary that allows for better filtering and that can be divided by currency.

Before tackling the Payroll Summary, I decided to implement some of the fixes to the issues that I described above; I see them some of them as easy wins and others as absolutely necessary before moving on with any other work: specifically those regarding security, validation and error handling.

I decided to use a spec-driven development approach for the critical issues, listed in [FINDINGS.md](FINDINGS.md):

- [C-01: Global Summary Currencies](FINDINGS.md#c-01--global-summary-mixes-currencies-into-one-total)
- [C-02: SQL injection issue](FINDINGS.md#c-02--sql-injection-via-sort-on-get-pay-items)
- [C-03: Potential cycle approve crash](FINDINGS.md#c-03--approve-missing-cycle-crashes)
- [C-04: Approved cycles still editable](FINDINGS.md#c-04--approved-cycles-remain-writable)

You will be able to find the specs, proposals & tasks of this process under the [openspec/changes/archive](openspec/changes/archive/) folder

For the next issues in priority, with the exception of H-01 because that would be option B part 2, I decided to use regular prompting to speed up my process. While spec driven development is perfect for documenting large changes, I prefer to use small surgical prompts for smaller issues.

In this case, I solved [H-02](FINDINGS.md#h-02--pay_itemsemployee_id-has-no-foreign-key) and [H-03](FINDINGS.md#h-03--no-validation-or-consistent-http-status-codes) as well as most of the Medium priority issues. Decided not to tackle the low priority issues at the moment, unless they were a side-effect of a larger fix.  

Finally, as a complimentary feature, I decided to implement a extra report: employee-summary. It complements the globalSummary by returning the earnings, deductions and employer cost by employee, same filters as the globalSummary.