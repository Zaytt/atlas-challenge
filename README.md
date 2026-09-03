# payroll-api

Small payroll service: countries → pay groups → payroll cycles → pay items, with a global summary report.

## Stack
Node.js + TypeScript, [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team) over an in-memory SQLite database (better-sqlite3). The schema is created at startup from `drizzle/0000_init.sql` and seeded with sample data.

## Reviewing (Part 1)
You don't need to run anything — reading the code is the point. Start with `src/server.ts`, then `src/report.ts` and `src/db/`.

## Running (needed only for Part 2)
```bash
npm install
npm test        # run the test suite
npm run dev     # start the server on http://localhost:3000
```

## Layout
- `src/server.ts` — HTTP routes
- `src/report.ts` — global summary logic
- `src/db/schema.ts` — Drizzle schema + relations
- `src/db/index.ts` — DB bootstrap + seed
- `src/db/seed.ts` — sample data
- `drizzle/0000_init.sql` — schema as raw SQL
- `src/server.test.ts` — tests
