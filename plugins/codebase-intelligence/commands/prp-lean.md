---
name: prp-lean
model: opus
description: >
  Lean planning front door for new or changed behaviour: the smallest complete plan, decisions made,
  at most 3 questions, then a binary GREEN / DOUBT gate. GREEN runs /prp-implement; DOUBT stops with
  the questions. Defects go to /prp-fix. Pass a goal, a JIRA-TICKET, or path/to/prd.md.
argument-hint: <goal | JIRA-TICKET | path/to/prd.md>
---

# /prp-lean — the smallest complete plan, then a go / no-go gate

**Input**: $ARGUMENTS

Tier semantics and the PRP invariant set: `../shared/model-tier.md`. Mandatory here at every tier: the
gate verdict before any code · write-before-stop (the plan and session note reach the vault even on
DOUBT) · no "it was small" exemption.

This command plans and gates; it writes no code and never fans out. A parallel agent team is
`/prp-orchestrate`, and the user chooses it.

## 1. Kind

- A defect (a bug, a QA fail, or a UAT fail where the build contradicts the AC) → STOP, use `/prp-fix`.
- New or changed behaviour, including a UAT round where the build matches the AC and the business now
  wants something else → continue.

## 2. Context — cheap, once

`Skill(codebase-intelligence:session-memory)` SESSION START. Ticket AC via the Jira MCP when an ID and
the MCP exist, else the input is the AC; copy it verbatim. A plan for this ticket already in the vault
→ load it and resume at §4 (the user's new input is the answer). One
`codebase-intelligence:codebase-explorer` pass for what already exists to reuse. Context7
(`context7-research`) only for an external API a task will call; `ask-kb` only for an open pattern
choice. No vault sweep, no panel.

## 3. Plan — the smallest version

Per requirement, take the first rung that works: does it need to exist → already in this codebase →
platform / stdlib → an installed dependency → minimum new code. A requirement the stated need does not
justify is pushed back on and goes to Hard boundaries (NOT in scope), one line each.

Shape: `prp-plan` Phase 6, only the sections `prp-implement` Phase 1 reads: Summary · Intelligence
Context (AC verbatim, Assumptions, Decisions, Hard boundaries) · Patterns to Mirror · Files to Change ·
Step-by-Step Tasks · AC Traceability · Validation Commands. Per task: `id, title, story, files, why,
ac_mapping, mirror, expected_gate, steps`. Written per `../shared/vault-persistence.md` to
`02-Notes/Plans/{YYYY-MM}/{slug}.plan.md`. Gate commands resolve per
`../shared/gate-command-resolution.md`.

## 4. Decide or ask — every open point is exactly one of these

- **Decide** — reversible, has a recommended default, does not change what gets built. Record it under
  Decisions: choice · why (AC + `file:line`).
- **Look up** — library / API → Context7; "how do we do X here" → the codebase, `ask-kb`. Never ask the
  user what the repo or the docs can answer.
- **Ask** — a requirement-type unknown, or a red blast radius (auth / payments / deploy /
  db-migration). **Max 3**, one at a time, `AskUserQuestion`, 2-4 pick options, the recommendation
  first with its reason. Each answer goes straight into the plan. A 4th question is not asked: it is
  DOUBT.

## 5. Gate — GREEN or DOUBT

GREEN only if all hold. Evidence is a `file:line` or a command, never an opinion:

1. Every AC maps to ≥1 task and every task to ≥1 AC (AC Traceability).
2. Every task has an `expected_gate` that resolves and fails while that task is undone.
3. No open requirement question; each remaining Assumption is reversible and logged.
4. No unapproved red blast radius; no ratified-constitution MUST violated (`.claude/constitution.md`,
   when present).
5. Hard boundaries names what was skipped.

- **GREEN** → SESSION END, then `Skill(codebase-intelligence:prp-implement)` on the plan path. One
  writer; `prp-implement` re-grades coverage independently at its Step 1.5.
- **DOUBT** → STOP: no worktree, no code. SESSION END. Print each failed condition with the question
  that closes it. Rerun the command to resume from the saved plan.

Close with one or two lines: what was skipped, what was not checked.
