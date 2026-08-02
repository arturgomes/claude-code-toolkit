---
name: constitution
description: >
  Creates and enforces the project constitution — the versioned, non-negotiable architectural
  principles that outrank any single plan, diff, or deadline. Supplies the three Phase -1 gates
  (Simplicity / Anti-Abstraction / Integration-First) and the Complexity Tracking table that forces
  every violation to be justified in writing. A constitution MUST violation is CRITICAL everywhere it
  is read: refinement, prp-plan, the mediator's round verdict, spec-analyze, and pre-pr-gate.
  Auto-invoked by prp-orchestrate (Step C) and prp-plan (Phase 5); invoke manually on
  "write our constitution", "what are our architectural non-negotiables", "justify this complexity".
version: 1.0.0
---

# constitution — the principles that outrank the plan

Every other rule source in this plugin is *style-scoped*: `.claude/`, `CLAUDE.md`, and
`.github/instructions/*.instructions.md` say how a file should be written, `applyTo`-scoped to globs.
None of them can say **"this design is more machine than the problem deserves."**

That is this skill's job. The constitution is a small set of **architectural** non-negotiables that a
plan must pass *before* it is allowed to become tasks, plus a ledger that makes every deliberate
violation visible and argued instead of silent.

## Model capability (read first)

Read `CI_MODEL_TIER` (`frontier | standard | light`, default `standard`). `frontier`: the gate
questions are intent. `standard`/`light`: run them verbatim. Mandatory at every tier: **a MUST
violation is CRITICAL**, the **Complexity Tracking row is required for every violation carried
forward**, and the **no-in-flight-amendment rule**.

---

## Where it lives

| | |
|---|---|
| Default path | `<repo>/.claude/constitution.md` |
| Preset override | `presets/<name>.yaml → constitution: <path>` (monorepos may point all repos at one file) |
| Read by | `refinement` (DoR), `prp-plan` (Phase 5 gate + Complexity Tracking), `spec-analyze` (CRITICAL pass), `mediator` (round verdict), `pre-pr-gate` (L9), `pr-reviewer` |
| Written by | **only** this skill, and only as an explicit, user-ratified amendment |

## Status semantics (this is what keeps it adoptable)

```yaml
Status: draft        # scaffolded by this skill, not yet ratified by a human
Status: ratified     # the user accepted it
```

- **`ratified`** — a MUST violation is 🔴 CRITICAL and blocks: no fan-out, no merge, no PR.
- **`draft`** — every finding is ⚠️ advisory and blocks nothing. It still appears in reports and in
  the Complexity Tracking table, so the first real run *shows* the user what ratifying would cost.
- **No file at all** — every constitution check is a silent no-op. The flow never fails because a repo
  has not adopted this yet.

A draft is never silently promoted. Ratification is a user action.

---

## Structure of the document

Template: `references/constitution-template.md`. Three fixed parts:

### 1. Core Principles (project-authored, stable IDs)

Each principle carries an **ID that never gets reused**, a name, and normative statements written in
MUST / MUST NOT / SHOULD / SHOULD NOT — the same vocabulary the rules rubric already classifies:

```markdown
### P-3. Test-First (NON-NEGOTIABLE)
- MUST: a failing test exists before the implementation that satisfies it.
- MUST NOT: a behavioral change ships without a test that fails on the pre-change code.
- Rationale: {why this project pays this cost}
```

A principle with no normative statement is decoration — reject it at authoring time. A principle
nobody would ever enforce is worse than no principle: it teaches the team the document is theatre.

### 2. The three Phase -1 gates (always present, project-parameterized)

These are the gates the plan must pass **before** design is finalized. Defaults in braces are
overridable per project in the document itself.

| Gate | Question | Default threshold |
|---|---|---|
| **G-SIMPLICITY** | Does this add more moving parts than the problem requires? | ≤ **3** new top-level components/packages/services; no speculative future-proofing; no abstraction whose second consumer is hypothetical |
| **G-ANTI-ABSTRACTION** | Are we wrapping what we could use directly? | Use framework/library features directly; **one** representation per domain concept; a wrapper needs a *named, existing* second consumer or a documented seam requirement |
| **G-INTEGRATION-FIRST** | Is the contract defined and failing before the code exists? | Cross-boundary contracts (API shape, shared types, DB schema) are written and their **contract tests fail** before any implementation lands; real dependencies at the boundary over mocks |

`G-INTEGRATION-FIRST` is the gate that pays for itself in this plugin: it is the same discipline the
mediator's contract-freeze phase enforces, stated as a principle so a plan cannot skip it.

### 3. Governance

- The constitution **supersedes** the plan, the ticket, and convenience.
- **Amendment is a separate, explicit act**: bump the version, date it, state the migration
  consequence for existing code. Never amend inside the run whose gate you are trying to pass.
- Version is semver: **MAJOR** = a principle removed or its meaning reversed; **MINOR** = a principle
  added; **PATCH** = wording/clarification with no normative change.

---

## Running the gates (invoked from prp-plan Phase 5, before the plan is generated)

For each gate, produce a verdict with evidence — the proposed component/abstraction/contract, not an
adjective:

```
G-SIMPLICITY      : ✅ | ⚠️ | 🔴  — {new components: 2 (api-client, cache-adapter)}
G-ANTI-ABSTRACTION: ✅ | ⚠️ | 🔴  — {wrapper `RepoGateway` over Prisma; second consumer: none named}
G-INTEGRATION-FIRST: ✅ | ⚠️ | 🔴 — {contracts: 1 (LastLoginPayload); contract test: absent}
```

**A 🔴 has exactly two legal resolutions:**

1. **Change the design** so the gate passes (preferred, and the whole point), or
2. **Carry the violation forward with a Complexity Tracking row** — which is a *record*, not an
   escape hatch: it is reviewed in the PR and re-read by `spec-analyze` and `pre-pr-gate`.

There is no third option. Deleting the principle, widening the threshold, or reclassifying a MUST as
a SHOULD *in order to pass* is itself a 🔴 and a drift-guard Q5 failure — the same rule that forbids
loosening a lint severity to clear the pre-PR gate.

## The Complexity Tracking table (lives in `plan.md`)

> Fill ONLY if a gate has a violation being carried forward. An empty table is the healthy state.

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| 4th package `sync-worker` | back-pressure needs its own lifecycle | in-process queue loses jobs on deploy; measured 3% loss in staging |

Rules that make the table honest:

- **All three columns are mandatory.** A row with an empty third column is 🔴 — "we needed it" is not
  an argument, it is the claim being tested.
- The "simpler alternative rejected because" must name **a specific alternative and a concrete reason**
  it fails (a measurement, a hard constraint, a named requirement). "Not flexible enough" is not a
  reason; "cannot express the per-tenant limit in AC-3" is.
- One row per violation. A row that survives into `pre-pr-gate` L9 is reported in the receipt, so the
  PR reviewer sees the argument next to the code that cost it.

---

## Bootstrap (`/prp-orchestrate` Step C, or manual)

When no constitution exists and the user asks for one:

1. **Observe, don't invent.** Derive candidate principles from what the repo already does: the
   existing `.claude/` + `.github/instructions/` rules, the test layout, the dependency graph shape,
   the CI gates. A principle the codebase already lives by is ratifiable; one imported from a blog is
   an argument nobody agreed to.
2. Draft **3-7 principles**. More than seven and none of them are non-negotiable.
3. Write the file with `Status: draft`, version `0.1.0`, `Ratified: —`.
4. Report what would have blocked on the current branch if it were ratified. That number is the
   honest cost of adoption, and it is the only argument for ratifying that is worth making.

Never scaffold a constitution silently as a side effect of another command — a document that claims
to outrank every plan does not get created without the user seeing it.

---

## Invariants (silent unless failed)

- [ ] A `ratified` MUST violation is CRITICAL/🔴 in every consumer; a `draft` one is ⚠️ only.
- [ ] No file ⇒ constitution checks are a no-op, never a failure.
- [ ] Every carried-forward violation has a complete 3-column Complexity Tracking row.
- [ ] The constitution was **not** edited during the run whose gate it blocks.
- [ ] Principle IDs are stable; amendments bump the version and state the migration consequence.

## What this skill does NOT do

- Does not replace `.claude/` / `CLAUDE.md` / `.github/instructions/*` — those stay the file-scoped
  style rulebook; this is the architecture-scoped one. Both are read; neither is a substitute.
- Does not amend itself, auto-ratify, or lower a threshold to let a run continue.
- Does not add CI jobs or edit application code.

## Dependencies

- `references/constitution-template.md` — the scaffold.
- Rule classification shared with `../mediator/references/rules-rubric.md` (MUST / SHOULD vocabulary).
- Consumed by: `refinement`, `prp-plan`, `spec-analyze`, `spec-converge`, `mediator`, `pre-pr-gate`,
  `pr-reviewer`.
