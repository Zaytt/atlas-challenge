# OpenSpec quick guide

A one-page loop for spec-driven work with an AI coding assistant. Specs live next to the code; chat context does not.

Official docs: [openspec.dev](https://openspec.dev) · [Getting started](https://openspec.dev/docs/getting-started) · [Quickstart](https://openspec.dev/docs/quickstart)

---

## What it is

You agree on **behavior** before code. Each piece of work is a **change proposal**: a folder of Markdown (why, requirements, design, tasks). When the work ships, those requirements merge into `openspec/specs/` — the source of truth for what the system does today.

On a brownfield repo like this one, `specs/` starts nearly empty. It fills up as you archive real changes. Do not convert `FINDINGS.md` wholesale; point at one finding and let a **delta** capture only that behavior.

---

## Setup (once)

Needs Node **20.19.0+**. In a terminal:

```bash
npm install -g @fission-ai/openspec@latest
cd /Users/ivan/Documents/Developer/challenges/payroll-api
openspec init --tools cursor
```

`init` writes `openspec/`, Cursor skills, and `/opsx-*` commands. Refresh generated files after a CLI upgrade with `openspec update`.

**Two places, two prefixes — mixing them up is the usual first mistake:**

| Where | What you type |
| --- | --- |
| Terminal | `openspec init`, `openspec list`, `openspec validate …` |
| Cursor chat | `/opsx-explore`, `/opsx-propose`, `/opsx-apply`, `/opsx-archive` |

Docs use `/opsx:propose`. In **Cursor** the palette registers **hyphens**: `/opsx-propose`. A plain sentence also works: *propose a change to lock pay items after approval*.

---

## The loop

```text
explore  →  propose  →  you review  →  apply  →  archive
 (optional)   (plan)    (still cheap)   (code)   (specs catch up)
```

| Step | In Cursor chat | What happens |
| --- | --- | --- |
| 1. Explore | `/opsx-explore how payroll cycle status should work` | Reads the code, asks questions, sketches options. **No files, no code.** |
| 2. Propose | `/opsx-propose add-cycle-lifecycle` | Writes the change folder. Stops at the plan. |
| 3. Review | (you, or `/opsx-update` to revise) | Fix the plan while it is still words. |
| 4. Apply | `/opsx-apply` (fresh chat is better) | Walks `tasks.md`, checks boxes as it lands. Resume = apply again. |
| 5. Archive | `/opsx-archive` | Merges deltas into `openspec/specs/`, moves the folder to `changes/archive/YYYY-MM-DD-…`. |

**Skip explore** when the intent is already a sentence. **Never skip review** of the specs.

Core profile also has `/opsx-update` (revise artifacts) and `/opsx-sync` (merge specs without archiving). Archive will offer sync if needed.

---

## Layout

```text
openspec/
├── specs/                      # main specs — behavior as built
│   └── <capability>/spec.md
├── changes/
│   ├── <change-name>/          # active work
│   │   ├── proposal.md         # why / what / out of scope
│   │   ├── design.md           # how (only if the change needs it)
│   │   ├── tasks.md            # implementation checklist
│   │   └── specs/<cap>/spec.md # delta vs current specs
│   └── archive/                # history; nothing is deleted
└── config.yaml
```

A **capability** is one behavior area (`payroll-cycles`, `pay-items`, `global-summary`). A **change** is one unit of work, not a git commit.

Artifacts stack: `proposal → specs → design → tasks → code`. If implementation teaches you something, edit the earlier file and keep going. Progress lives in `tasks.md` checkboxes — there is no hidden state.

---

## Writing a delta (the part that matters)

Deltas describe **what is changing**, not the whole system.

```markdown
# Delta for Payroll Cycles

## Purpose
Lifecycle and write-lock for payroll cycles.   <!-- new capability only -->

## ADDED Requirements

### Requirement: Legal status transitions
The system SHALL allow only `draft → processing → approved → paid`.

#### Scenario: Legal step succeeds
- GIVEN a cycle in `draft`
- WHEN a client requests transition to `processing`
- THEN the cycle status is `processing` and the response is success

#### Scenario: Illegal jump is rejected
- GIVEN a cycle in `draft`
- WHEN a client requests transition to `paid`
- THEN the response is `409`, and status is unchanged
```

**Format rules the validator cares about:**

- Requirements: `### Requirement: <name>` plus one observable `SHALL` / `MUST`.
- Scenarios: **exactly** `#### Scenario:` (four hashes). Three hashes fail silently.
- Every requirement needs at least one scenario (GIVEN / WHEN / THEN).
- New capability: start with `## Purpose` (two sentences). Skip it and archive leaves a TBD placeholder.

| Section | Use when | On archive |
| --- | --- | --- |
| `## ADDED Requirements` | Behavior that does not exist yet | Appended |
| `## MODIFIED Requirements` | Existing requirement changing — paste the **entire** block, then edit | Replaces the old one |
| `## REMOVED Requirements` | Behavior going away — include why | Deleted from main spec |
| `## RENAMED Requirements` | Name-only: `FROM:` / `TO:` | Renamed |

Wrong section = duplicate or missing behavior after archive. If unsure, open `openspec/specs/<cap>/spec.md` and see whether that requirement already exists.

Keep **how** (Drizzle, Hono, table columns) in `design.md`. Specs stay testable from outside the code.

---

## Review the plan before `/opsx-apply`

Read in this order:

1. **`proposal.md`** — one intent, right size, clear out-of-scope.
2. **`specs/`** — would you accept *exactly* this as done? Look for missing error cases.
3. **`tasks.md`** — covers the specs, nothing extra.

Red flags: vague SHALL ("handle errors gracefully"), no scenario for the case you care about most, three features in one change, implementation leaking into requirements.

Fix by editing the Markdown or telling the agent what is wrong. Then apply.

---

## CLI you will actually use

```bash
openspec list                         # active changes
openspec show add-cycle-lifecycle     # inspect a change
openspec validate add-cycle-lifecycle --strict
openspec view                         # dashboard
openspec archive add-cycle-lifecycle  # same as /opsx-archive, from the shell
```

---

## Using this on payroll-api

`FINDINGS.md` is source material, not an OpenSpec spec. One finding → one change, named for the intent:

| Finding | Change name (example) | Capability |
| --- | --- | --- |
| C-02 | `allowlist-pay-item-sort` | `pay-items` |
| C-04 + H-01 | `add-cycle-lifecycle` | `payroll-cycles` |
| C-01 | `summarize-by-currency` | `global-summary` |

Point the agent at the finding and the acceptance criteria. Example prompt:

> `/opsx-explore` Option B from `CANDIDATE_BRIEF.md` and findings `C-03`, `C-04`, `H-01` in `FINDINGS.md`. Then `/opsx-propose add-cycle-lifecycle` — legal transitions `draft → processing → approved → paid`, pay items read-only once approved, 409 on illegal writes/jumps, 404 on missing cycle.

Keep Part 2 to **one intent**. Lifecycle + currency totals is two changes.

After apply: `npm test` and `npm run typecheck`. Archive when the boxes are checked and the tests match the scenarios.

---

## Pitfalls

- **Ceremony vs stakes.** A one-line fix does not need a design doc. A money or lifecycle change does need scenarios for the unhappy path.
- **Too-big changes.** If the proposal needs "and also," split it.
- **MODIFIED with a partial paste** drops the rest of the requirement on archive. Copy the whole block.
- **Apply in a stale chat.** Implementation is cleaner in a new session; it resumes from the first unchecked task.
- **Git is separate.** Commit the change folder with the code. When to archive vs when to open a PR is a team convention.

---

## Spec checklist (before you trust apply)

- [ ] One sentence of intent
- [ ] Each requirement is one observable `SHALL` / `MUST`
- [ ] No implementation details in requirements
- [ ] Every requirement has a real scenario (including the failure you would hate to miss)
- [ ] ADDED / MODIFIED / REMOVED match the current main spec
- [ ] `openspec validate <change> --strict` is clean
