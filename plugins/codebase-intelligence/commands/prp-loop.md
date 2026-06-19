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

Design sources (`02-Notes/Telegram-Inbox/`, 2026-06-10): closed-loop skeleton + maker-checker — *loop-engineering-in-ai.md*; stop rules + state file — *loop-engineering-roadmap.md*; verifier-over-self-critique — *designing-loops-with-fable-5.md*; contract reread + no-progress detection — *loops-in-ai-coding.md*; evidence standard — *claude-code-dynamic-workflows-for-ai-agent-coordination.md*. Extended 2026-06-18: subagent context isolation + verify-feedback-to-permanent-rule — *kimi-k2-6-self-improving-loop.md* (steps 3, 8); escalating out-of-sample scrutiny — *loop-engineering-for-trading-strategies.md*.

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

## Pre-Phase IV: SUBAGENT MODE — Ask once per session

The ATTEMPT (L.3) can run in this orchestrator's own context (default) or be delegated to a
fresh-context subagent. Delegation keeps the orchestrator lean so the loop survives more
iterations before `CONTEXT_CAP` — *"a single agent on a long task fills its window until it
drowns and starts lossy summarization"* (*kimi-k2-6-self-improving-loop.md*, step 3). It is
**optional** because for short loops the spawn overhead and the round-trip of patterns into a
blank context is not worth it.

**On resume** (the restored LOOP CONTRACT already has a `Subagent ATTEMPT:` line): read it,
do NOT re-prompt.

**On a fresh loop**: ask the user exactly once —

```
Delegate each ATTEMPT to a fresh-context subagent this session? [enable / disable]
  enable  → L.3 spawns one Agent(general-purpose) per attempt (better context budget,
            slower per attempt, maker reasoning stays out of this orchestrator)
  disable → L.3 runs in this context (default; simpler, fewer tokens for short loops)
```

Persist the answer by appending one line to the LOOP CONTRACT in session-memory (so L.2's
reread carries it forward, drift-proof):

```
Subagent ATTEMPT: enabled | disabled
```

No answer / unclear → default **disabled** and state that you defaulted.

**PRE-PHASE-IV CHECKPOINT:**
- [ ] `Subagent ATTEMPT:` line present in the contract (asked, or restored on resume)

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

Also re-read the `## Loop Constraints` block (if present) — the durable rules promoted by
earlier attempts (L.6b). These are binding for attempt `n`: a failure the loop already
learned must not be repeated. The reread includes the `Subagent ATTEMPT:` line so L.3 knows
this session's mode.

### L.3 — ATTEMPT

- Plan input → execute the next incomplete task(s) per prp-implement Phase 3 conventions
  (MIRROR patterns, Context7 verification via `Skill(codebase-intelligence:context7-research)`
  for external APIs, KB check via `Skill(codebase-intelligence:ask-kb)` for pattern decisions)
- Free-form goal → implement the smallest change that could make the gate pass
- On attempt n>1: read the ledger rows for attempts 1..n-1 first. State in one line what
  this attempt does **differently**. Identical retry of a failed approach = no-progress.

**Optional: delegate the attempt** (only if the contract's `Subagent ATTEMPT:` line is
`enabled`). Spawn **one** `Agent(general-purpose)` subagent for this attempt — a single
delegate for context isolation, never a fan-out (this is not fleet mode). Rationale: each
subagent works in its own bounded context window, so the orchestrator's window does not fill
with attempt reasoning and tool output across iterations (*kimi-k2-6-self-improving-loop.md*,
step 3). The subagent receives **only**:

- the LOOP CONTRACT + the `## Loop Constraints` block
- the next incomplete task(s) and their MIRROR patterns
- the ledger's one-line "what failed before" for attempts 1..n-1

and returns **only** the diff summary + the gate-relevant output (not its full reasoning).
If `disabled` (default), run the attempt in this context as above.

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
Inputs: a Loop Contract, a gate command with its captured output, a diff, and the
attempt number.

Judge ONLY:
1. Does the gate output genuinely demonstrate the contract Objective is met —
   or does it pass vacuously (skipped tests, empty test set, gate command
   weaker than the objective)?
2. Does the diff stay inside the contract Boundaries?
3. Does the diff contain changes that game the gate (deleted/skipped tests,
   loosened assertions, hardcoded expected values)?
4. Does the diff satisfy the Objective generally, or only on the exact inputs the
   gate happens to check? A change that passes the gate but would fail on an
   equivalent untested input is overfitting the gate, not meeting the Objective
   ("a loop that optimizes on the same data finds prettier noise faster").

ATTEMPT NUMBER matters: scrutiny rises with n. On later attempts the maker has had
more chances to shape the diff toward the gate — treat a late green gate with more
suspicion, not less, and look harder at concern 4.

Report under 150 words:
  VERDICT: PASS | FAIL
  EVIDENCE: {file:line or output line for each concern; "none" if clean}

Default to FAIL if uncertain.

CONTRACT: {paste}
ATTEMPT NUMBER: {n} of {max_iterations}
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

### L.6b — PROMOTE (self-improving rule)

Promote a lesson to a durable constraint when EITHER:

- the gate failure this attempt is **identical to a prior ledger row** (a recurring
  failure — the ledger alone clearly is not stopping it), OR
- the verifier (L.5) flagged **gate-gaming** or **overfitting** (concerns 3–4).

Append one rule via `Skill(codebase-intelligence:session-memory)` → Loop Constraints
append protocol — a single imperative line, deduped against existing rules, e.g.
`- Do not satisfy the gate by hardcoding expected values (attempt 3 did this).`

This is the loop learning from its own failures: the rule is re-read at L.2 every
later iteration, so the mistake is bounded once, not re-litigated every attempt
(*kimi-k2-6-self-improving-loop.md*, step 8: "turn the verify feedback into a
permanent rule"). Constraints **inform** attempts only — they never widen the
contract Boundaries or weaken the gate.

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
- [ ] Verifier ran on every green gate (received attempt n)
- [ ] Recurring/gamed failures promoted to `## Loop Constraints` (L.6b)
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

## Subagents in the loop

This loop uses subagents for **context isolation**, never for scale. Two roles, and the
hard rule that separates them:

| Subagent | When | Gets | Returns | Why |
|---|---|---|---|---|
| **Verifier** (L.5) | **Mandatory**, on every green gate | contract + `## Loop Constraints` + gate output + diff + attempt n | `VERDICT` + `EVIDENCE` | independent check; *"a loop is only as trustworthy as its ability to check its own work"* |
| **Attempt delegate** (L.3) | **Optional** (`Subagent ATTEMPT: enabled`) | contract + constraints + next task(s) + MIRROR patterns + ledger's prior-failure lines | diff summary + gate-relevant output | bounded context window so the orchestrator does not drown in accumulated attempt reasoning |

**The invariant — never pass the maker's reasoning to the verifier.** The verifier sees
artifacts (contract, gate output, diff), never how the attempt thought. Sharing reasoning
collapses the maker-checker split into self-review, which is exactly the failure the verifier
exists to prevent. The attempt delegate is the maker; the verifier is the checker; they never
share a context.

Both are spawned with `Agent(general-purpose)`. Each attempt is **one** delegate — there is
no parallel fan-out. Scale (many agents per task) is out of scope; see below.

## What prp-loop does NOT do

- Run without a contract (loop-contract 🔴 = hard refusal)
- Schedule itself — cadence/cron is out of scope; run manually until the loop earns trust
  ("get one manual run reliable first... Then schedule it"). The "promote to a background
  agent" end-state (*kimi-k2-6-self-improving-loop.md*, step 10) is deliberately not built —
  earn trust with manual runs first.
- Merge, deploy, or change dependencies — human gate, always
- Fleet orchestration — one loop, one goal, one contract. The optional L.3 delegate is a
  **single** subagent for context budget, not a swarm. The 300-agent self-improving swarm
  (*kimi-k2-6-self-improving-loop.md*) contributed its *principles* (context isolation,
  verify gate, rule promotion) — its **scale is intentionally rejected here**.
- Replace prp-implement — plans without retry-until-green needs run faster there

## Success Criteria

- **CONTRACT_FIRST**: no iteration before ✅ CONTRACT VALID
- **GATE_OBJECTIVE**: done decided by exit codes + independent verifier, never self-declared
- **LEDGER_COMPLETE**: one row per attempt, durable in vault
- **STOPS_HONORED**: max_iterations / no_progress / context_cap / human_gate enforced
- **HONEST_EXIT**: failure exits name the unmet AC and the resume path
