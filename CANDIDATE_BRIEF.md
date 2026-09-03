# Atlas HXM — Software Engineer Take-Home Exercise (`payroll-api`)

**Time budget:** 2–3 hours
**AI tools:** Permitted — we'll ask how you used them in the review session
**Submission:** Reply to this email with a short writeup (see below) + any modified files as a zip or GitHub link
**Confidentiality:** Please keep these materials to yourself — we rotate exercises and sharing them disadvantages future candidates.

---

## Context

You're picking up the `payroll-api` — a small Node.js/TypeScript service that powers Atlas HXM's multi-country payroll runs. Countries have pay groups, pay groups have payroll cycles, and each cycle holds the pay items (earnings, deductions, employer costs) that feed the actual pay run. The data this service produces turns into money paid to real people in several currencies.

It was written quickly during a country-launch push by an engineer who has since left. You're the first engineer to give it a real read before the next pay run.

The repo contains:

- `src/server.ts` — the Hono API (countries, pay groups, payroll cycles, pay items, a global summary report)
- `src/report.ts` — the reporting logic behind the global summary
- `src/db/` — the Drizzle schema, the committed SQL migration, and seed data
- `drizzle/0000_init.sql` — the schema as raw SQL
- `src/server.test.ts` — a small test suite

See `README.md` to run it. You don't need to run anything to do the review — reading the code is the point.

---

## What We're Asking

### Part 1 — Review (written, ~1 hr)

Review the code as if you were the new owner doing a first-pass audit before the next release. Write your findings in whatever format feels natural — a Slack message, an internal doc, inline PR comments.

For each finding:

- What the issue is
- Why it matters (what actually breaks, for whom, or what risk it creates)
- What you'd do about it, concretely

Not everything is wrong. Part of what we're evaluating is whether you can distinguish a critical issue from a non-issue, and whether you can tell correct-but-unusual code from an actual bug. You don't need to find everything — we're more interested in how you triage than in total count.

### Part 2 — Extend (hands-on, ~1 hr)

Pick **one** of the following and implement it. Include tests.

**Option A — Company-wide payroll summary**
Finance wants a single company-wide summary across all payroll cycles: the total earnings, deductions, and employer cost for the business. Implement it (you may extend the existing summary or add a new endpoint) and include a short note on any decisions or edge cases you ran into while consolidating the numbers.

**Option B — Cycle lifecycle**
Product wants payroll cycles to move through a lifecycle — `draft → processing → approved → paid` — with only legal transitions allowed, and pay items becoming read-only once a cycle is approved. Implement the lifecycle and the transition rules, and note any edge cases you considered.

You don't need a real database or deploy — code that's correct-by-inspection with tests is fine.

---

## What to Submit

1. **Your review writeup** (any format)
2. **The modified file(s)** for Part 2
3. **A short note** (3–5 sentences) on how you approached it — what you looked at first, any time trade-offs you made, where you used AI and how

---

## Live Review Session (~35 min)

We'll schedule a follow-up to walk through your work together. Expect questions like:

- Walk us through what you prioritized and why
- What would you fix first if you owned this service starting Monday?
- We'll point at a few specific choices — including things you may not have flagged — and ask for your read

The live session is where most of the signal lives for us. The take-home is the starting point for that conversation.

---

Questions? Reply to this email.
