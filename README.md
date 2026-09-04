# payroll-api

Small payroll service: countries → pay groups → payroll cycles → pay items, with company-wide summary reports.

This repo is a take-home solution. The original brief asked for a **code review (Part 1)** and then **one product extension (Part 2)**. I audited the service first, then implemented Option A (company-wide payroll summary) plus the critical/high-priority fixes that reports and writes depend on.

## How to explore this solution

You do not need to run anything to review the work. Git history is split so each part of the challenge is easy to inspect:

| What you want | Where to look |
| --- | --- |
| Review / audit (Part 1) | `0d3a939` — `part 1 - initial findings` |
| Implemented solution (Part 2) | `ec6475c` — `part 2 - fixes` (`HEAD` on `main`) |

```bash
# Part 1 — findings writeup and first-pass audit artifacts
git show 0d3a939813b3a1a0740d38cc6467d722f4c646b5

# Part 2 — the working tree as submitted (fixes + reports)
git show ec6475c6d7dbe00f87609d8a9ef5037b2cff2fd3
```

**Start here for the written review:** [`FINDINGS.md`](FINDINGS.md) (prioritized catalog from Part 1; items marked `[FIXED]` were addressed in Part 2).

**Start here for how I worked:** [`MY_APPROACH.md`](MY_APPROACH.md).

OpenSpec proposals for the critical fixes live under [`openspec/changes/archive/`](openspec/changes/archive/).

Suggested code path: `src/server.ts` → `src/report.ts` → `src/db/` → `src/utils/validation.ts`.

## Challenge in short

The API was a fast country-launch service: countries, pay groups, payroll cycles, and pay items (earnings, deductions, employer costs) in several currencies. The original code was happy-path only.

**Part 1** was a first-pass audit before the next pay run: what is broken, why it matters, and what to do about it — triaging critical vs noise.

**Part 2** asked for one of:

- **Option A** — company-wide payroll summary (earnings, deductions, employer cost)
- **Option B** — cycle lifecycle (`draft → processing → approved → paid`)

I chose **Option A**, and also shipped the security, validation, and reporting bugs that would make a summary unsafe or meaningless.

## What was implemented

**Reports**

- `GET /reports/global-summary` — totals **per currency** (not mixed EUR/GBP/USD), with optional filters (`country`, `payGroupId`, period overlap, cutoff/pay dates, status).
- `GET /reports/employee-summary` — same filters, broken down by employee (earnings, deductions, employer cost).

**Critical / high fixes (before or alongside the reports)**

- Allowlisted `sort` on `GET /pay-items` (no user text in `ORDER BY`).
- Approve missing / invalid cycle ids return `400` / `404` instead of crashing.
- Pay items cannot be written once a cycle is `approved` (or `paid`) — `409`.
- `pay_items.employee_id` foreign key; shared request validation and consistent HTTP statuses.
- Structured 4xx/5xx logging and a Hono `onError` handler.

**Left for later (called out in FINDINGS)**

- Full cycle lifecycle and legal transitions (**Option B** / `H-01`).
- Isolated route-test DB (`H-04`), `pay_date` type consistency, N+1 on `GET /getPayItemsByCycle`.

## Stack

Node.js + TypeScript, [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team) over an in-memory SQLite database (better-sqlite3). The schema is created at startup from `drizzle/0000_init.sql` and seeded with sample data.

## Running

```bash
npm install
npm test        # run the test suite
npm run dev     # start the server on http://localhost:3000
```

## Layout

- `src/server.ts` — HTTP routes
- `src/report.ts` — global and employee summary logic
- `src/utils/validation.ts` — shared param/body validation
- `src/db/schema.ts` — Drizzle schema + relations
- `src/db/index.ts` — DB bootstrap + seed
- `src/db/seed.ts` — sample data
- `drizzle/0000_init.sql` — schema as raw SQL
- `src/server.test.ts` / `src/report.test.ts` — tests
- `FINDINGS.md` — Part 1 audit
- `MY_APPROACH.md` — process notes
- `ORIGINAL_README.md` — original challenge README
