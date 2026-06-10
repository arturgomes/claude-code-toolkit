---
name: prp-loop
description: >
  Runs a bounded, verifiable closed loop: ATTEMPT → GATE → VERIFY → RECORD → DECIDE until an
  executable objective gate passes (confirmed by an independent verifier sub-agent) or a hard
  stop fires. Requires a Loop Contract (loop-contract skill) — refuses to run without one.
  Pass path/to/plan.md (reuses its Validation Commands as the gate) or a goal + explicit gate.
argument-hint: <path/to/plan.md | "goal text" --gate "<command>"> [--max-iter <n>]
---

# Loop Runner (codebase-intelligence)

**Input**: $ARGUMENTS

Design sources (`02-Notes/Telegram-Inbox/`, 2026-06-10): closed-loop skeleton + maker-checker — *loop-engineering-in-ai.md*; stop rules + state file — *loop-engineering-roadmap.md*; verifier-over-self-critique — *designing-loops-with-fable-5.md*; contract reread + no-progress detection — *loops-in-ai-coding.md*; evidence standard — *claude-code-dynamic-workflows-for-ai-agent-coordination.md*.

---

## Your Mission

Run a **closed loop** — "a human designs the end-to-end path first" — that re-attempts a goal
until the objective gate passes and an independent verifier confirms it, or a hard stop fires.

**Golden Rule for loops**: done = gate passes (binary exit code) AND verifier confirms.
Never self-declared. *"A loop is only as trustworthy as its ability to check its own work."*

**Golden Rule for stops**: every exit path reports honestly — which AC is unmet, what was
tried, where to resume. A loop that fails loudly is a success; a loop that lies is the
Ralph Wiggum failure.

---

## Pre-Phase I: MEMORY — Restore context

`Skill(codebase-intelligence:session-memory)` → SESSION START protocol.
If a prior session has a `## LOOP CONTRACT` and `## Loop Ledger` for this goal:
restore them — the next attempt is iteration `last_n + 1`, not iteration 1.
Prior attempts' failures are context: do not retry what the ledger shows already failed.

**PRE-PHASE-I CHECKPOINT:**
- [ ] Session loaded or created
- [ ] Prior contract + ledger restored (if resuming)

---

## Pre-Phase II: CONTRACT — Establish or refuse

`Skill(codebase-intelligence:loop-contract)`:

1. Run the 4-condition pre-check (repeats · verifiable · budgeted · equipped)
2. Resolve the **objective gate**:
   - Plan input → use the plan's "Validation Commands" section (executable commands; the
     gate is ALL of them exiting 0, or the subset the plan marks as required)
   - Free-form goal → require explicit `--gate "<command>"`; none given → ask, do not invent
3. Write the LOOP CONTRACT block, append to session-memory
4. Emit Contract Verdict

**GATE**: 🔴 NO GATE → STOP. Report: "No executable objective gate. A loop without one
exits on a half-done job. Provide a command with a binary exit code." Do not run iteration 1.

Also STOP if the objective is on the bad-fit list (architecture, auth/payments, deploys,
judgment-call "done") — recommend manual `/prp-implement` instead.

**PRE-PHASE-II CHECKPOINT:**
- [ ] 4-condition pre-check passed
- [ ] Contract written to session-memory
- [ ] Verdict ✅ CONTRACT VALID (or ⚠️ tightened, then valid)

---

## Pre-Phase III: ANCHOR — Load AC

Plan input → extract TASK ANCHOR from the plan's Intelligence Context (verbatim AC + NOT-in-scope).
Free-form goal → the contract Objective is the single AC.

---

## Phase L: THE LOOP

```
iteration n = 1
WHILE true:
  L.1 DRIFT     L.2 REREAD    L.3 ATTEMPT
  L.4 GATE      L.5 VERIFY    L.6 RECORD    L.7 DECIDE
```

### L.1 — Drift check (per attempt)

`Skill(codebase-intelligence:drift-guard)` questions #1 + #4 against what attempt `n` is
about to do:

```
AC this attempt serves: {state it}
Files about to touch inside contract Boundaries? {yes/no}
Adding anything the AC doesn't require? {yes → strip it}
```

🔴 DRIFTING → this counts as a **failed attempt**: record a ledger row
(`gate: not-run`, `next move: re-anchor`), increment `n`, go to L.7.
Drift must consume budget — a drifting loop that iterates free never converges.

### L.2 — Contract reread

Re-read the LOOP CONTRACT verbatim from session-memory. Constraints decay across
iterations ("'don't do X' constraints disappear at turn 47") — the reread is mandatory,
not optional.

### L.3 — ATTEMPT

- Plan input → execute the next incomplete task(s) per prp-implement Phase 3 conventions
  (MIRROR patterns, Context7 verification via `Skill(codebase-intelligence:context7-research)`
  for external APIs, KB check via `Skill(codebase-intelligence:ask-kb)` for pattern decisions)
- Free-form goal → implement the smallest change that could make the gate pass
- On attempt n>1: read the ledger rows for attempts 1..n-1 first. State in one line what
  this attempt does **differently**. Identical retry of a failed approach = no-progress.

### L.4 — GATE

Run the contract's gate command(s). Capture exit code + output tail (verbatim, ≤20 lines).

- Exit ≠ expected → gate FAIL. Skip L.5 (verifier runs only on green gates — "reserve
  self-consistency for high-stakes tasks and optimize the number of iterations").
- Exit = expected (+ output assertion matches) → gate PASS → L.5.

### L.5 — VERIFY (independent, fresh context)

Spawn via `Agent(general-purpose)` — mirrors `doubt-driven` Step 3. The verifier gets
**only**: the LOOP CONTRACT, the gate command + captured output, and the diff
(`git diff --stat` + the full diff if <300 lines). **Never the maker's reasoning.**

Verifier prompt template:

```
You are an independent verifier. You have NOT seen the implementation reasoning.
Inputs: a Loop Contract, a gate command with its captured output, and a diff.

Judge ONLY:
1. Does the gate output genuinely demonstrate the contract Objective is met —
   or does it pass vacuously (skipped tests, empty test set, gate command
   weaker than the objective)?
2. Does the diff stay inside the contract Boundaries?
3. Does the diff contain changes that game the gate (deleted/skipped tests,
   loosened assertions, hardcoded expected values)?

Report under 150 words:
  VERDICT: PASS | FAIL
  EVIDENCE: {file:line or output line for each concern; "none" if clean}

Default to FAIL if uncertain.

CONTRACT: {paste}
GATE: {command, exit code, output tail}
DIFF: {paste}
```

VERDICT: FAIL → treat as gate failure (record evidence in ledger, continue loop).
The maker never argues with the verifier; it addresses the evidence.

### L.6 — RECORD

`Skill(codebase-intelligence:session-memory)` → Loop Ledger append protocol. One row:

```
| {n} | {ISO timestamp} | {gate: PASS/FAIL + exit code} | {verifier: PASS/FAIL/— } | {diff summary, files +/-} | {next move} |
```

The ledger is the loop's spine: attempt n+1 reads it so the loop never re-derives
what attempts 1..n already tried.

### L.7 — DECIDE

Evaluate in order — first match wins:

| Condition | Exit | Action |
|---|---|---|
| Gate PASS ∧ Verifier PASS | ✅ SUCCESS | → Phase R |
| `n ≥ max_iterations` (contract) | 🛑 MAX_ITER | → Phase R (honest failure) |
| Last `no_progress_limit` gate failures identical | 🛑 NO_PROGRESS | → Phase R (honest failure) |
| Context usage > 40% | 🛑 CONTEXT_CAP | ledger + session saved → report resume command, stop |
| Next action hits human_gate (merge/deploy/deps/irreversible) | ⏸ HUMAN_GATE | surface to user, stop |
| Otherwise | — | `n += 1`, → L.1 |

**Never** widen the contract, weaken the gate, or raise max_iterations mid-loop to force
an exit. If the contract is wrong, stop and say so — that is a planning failure, not
iteration n+1.

**PHASE_L_CHECKPOINT:**
- [ ] Every attempt has a ledger row
- [ ] Verifier ran on every green gate
- [ ] Exit path taken matches the table — no improvised exits

---

## Phase R: REPORT

**HIERARCHY CHECK**: `mcp__ultimate-obsidian__list_vault({ path: "02-Notes/Reports" })`

Save via Obsidian MCP (never Write/bash):

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Reports/{goal-or-plan-slug}-loop-report.md",
  mode: "overwrite",
  content: ...
})
```

Report sections:

```markdown
---
title: {slug}-loop-report
created: {YYYY-MM-DD}
source: Loop session
project: {project-root-name}
tags: [prp, {project-root-name}, report, loop]
---

# Loop Report: {objective one-liner}

**Exit**: {SUCCESS | MAX_ITER | NO_PROGRESS | CONTEXT_CAP | HUMAN_GATE}
**Iterations**: {n} / {max_iterations}

## Contract (as run)
{verbatim LOOP CONTRACT}

## Ledger
{full Loop Ledger table}

## Outcome
- SUCCESS: gate output proving objective + verifier evidence
- FAILURE: which AC unmet, failure pattern across attempts, recommended next step
  (fix the approach? fix the contract? this isn't loop-shaped?)

## Read the diff
Files changed: {list}. A loop you don't read is comprehension debt at compound
interest — review before merging. Human gate still applies to merge/deploy.

## Resume
/codebase-intelligence:prp-loop {original args}   ← ledger restores automatically
```

Then `Skill(codebase-intelligence:session-memory)` → SESSION END: ledger summary,
contract, exit status, decisions, resume point.

**PHASE_R_CHECKPOINT:**
- [ ] Report saved with full ledger
- [ ] Session saved
- [ ] Exit status reported honestly to user (failures are failures)

---

## What prp-loop does NOT do

- Run without a contract (loop-contract 🔴 = hard refusal)
- Schedule itself — cadence/cron is out of scope; run manually until the loop earns trust
  ("get one manual run reliable first... Then schedule it")
- Merge, deploy, or change dependencies — human gate, always
- Fleet orchestration — one loop, one goal, one contract
- Replace prp-implement — plans without retry-until-green needs run faster there

## Success Criteria

- **CONTRACT_FIRST**: no iteration before ✅ CONTRACT VALID
- **GATE_OBJECTIVE**: done decided by exit codes + independent verifier, never self-declared
- **LEDGER_COMPLETE**: one row per attempt, durable in vault
- **STOPS_HONORED**: max_iterations / no_progress / context_cap / human_gate enforced
- **HONEST_EXIT**: failure exits name the unmet AC and the resume path
