---
name: prp-fix
model: sonnet
description: >
  Triage a defect as BUG, QA_FAIL or UAT_FAIL and fix it on the short path: no spec, plan or team.
  New or changed behaviour goes to /prp-plan instead. Pass a JIRA-TICKET, a failure report, or a symptom.
argument-hint: <JIRA-TICKET | failure report | symptom>
---

# /prp-fix — the short path for defects

**Input**: $ARGUMENTS

Tier semantics and the PRP invariant set: `../shared/model-tier.md`.

New behaviour is not this command: `/prp-plan` → `/prp-implement` (or `/prp-orchestrate`).

## 1. Classify — exactly one, first match wins

| Kind | Signal | The defect lives in |
|---|---|---|
| `uat-fail` | A stakeholder / acceptance round rejected built work | the requirement or the build |
| `qa-fail` | A tester says the ticket's AC is not met | the build |
| `bug` | Behaviour contradicts expectation; no AC or plan covers it | the build |

`uat-fail` has one extra test: compare the rejected behaviour to the AC **verbatim**.
- Build contradicts the AC → it is a `qa-fail`.
- Build matches the AC and the business wants something else → the requirement changed. That is a
  feature: STOP and run `/prp-plan` with the new AC. Do not patch it here.
- No AC to compare against → ask the user once.

Record it once: `mcp__ultimate-obsidian__manage_frontmatter` sets `kind: bug|qa-fail|uat-fail` on the
session note. A note with no `kind` is feature work.

## 2. The short path (every kind)

1. **Load** — `Skill(codebase-intelligence:session-memory)`. For `qa-fail` / `uat-fail` use its
   "QA FAILURE resume protocol" (prior session, Open Failures, Jira QA comments). A `bug` with no
   ticket is keyed by the repo root folder name.
2. **Anchor** — three lines, no more: kind · the failing AC verbatim (`bug`: observed vs expected) ·
   what is out of scope. The anchor is the scope. Touch nothing it does not name.
3. **Repro first** — a failing test or an exact repro command, run and seen red BEFORE any fix. Cannot
   reproduce → STOP and report; never fix on a guess.
4. **Fix** — grep every caller of what you touch, fix the root cause once in the shared code, smallest
   diff. Branch per `../shared/branch-rule.md`, base per `../shared/git-base-detection.md`.
5. **Gate** — the repro is green, then the repo's gate (`../shared/gate-command-resolution.md`), then
   `Skill(codebase-intelligence:pre-pr-gate)`. No receipt, no PR. A small diff is not an exemption.
6. **Close** — SESSION END (write-before-stop): the root cause, the repro, and for `qa-fail` /
   `uat-fail` which AC now passes. Shipping is `Skill(codebase-intelligence:ship)`.

## 3. Escalate to `/prp-plan` — STOP, do not stretch this path

- The fix needs a new or changed AC.
- Blast radius is red: auth, payments, deploy, db-migration (`../shared/model-tier.md`).
- The root cause is a design flaw spanning more than one module's territory.
