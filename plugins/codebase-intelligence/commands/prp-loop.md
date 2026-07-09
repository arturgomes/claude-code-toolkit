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

## Model capability (read first)

This skill is model-agnostic. Read `CI_MODEL_TIER` (values: `frontier` | `standard` | `light`; default `standard` when unset or unknown).
- `frontier`: treat numbered sub-steps as intent; skip redundant per-step narration.
- `standard` / `light`: follow every numbered step verbatim.
Invariants are mandatory at EVERY tier and never skipped: executable gates, the AC anchor, drift checks, write-before-stop, the independent blind verifier, and blast-radius routing.

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

**Reasoning-effort match (capability-gated).** If the runtime exposes a reasoning-effort
control, match it to plan complexity once here and carry it into L.3: a multi-file / high-risk
plan warrants higher effort; a one-line fix warrants low. Do **not** hardcode any specific
effort value (e.g. `xhigh`) as required — it is an optional dial. **If the runtime exposes no
reasoning-effort control, this is a no-op** and the loop runs identically at the default effort.

**PRE-PHASE-IV CHECKPOINT:**
- [ ] `Subagent ATTEMPT:` line present in the contract (asked, or restored on resume)
- [ ] Reasoning-effort matched to complexity if the runtime exposes one (else no-op)

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
Blast radius: green|yellow|red
```

Classify the **Blast radius** of what attempt `n` is about to do, using the literal field
`Blast radius: green|yellow|red`:
- **green** — reversible, local, test/impl edits inside Boundaries; auto-exit eligible.
- **yellow** — wider surface (shared modules, schema-adjacent, config); proceed but flag in the ledger.
- **red** — merge/deploy/dependency/irreversible/security-sensitive next action. A red
  action can NEVER auto-exit ✅ SUCCESS (enforced at L.7 — routes to ⏸ HUMAN_GATE).

Carry the classification into the L.6 ledger row and into L.7.

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

**Re-verify prior invariants (regression guard).** Re-run the predicates recorded under the
session-memory `## Verified Invariants` section (goals proven green in earlier attempts/runs).
Each is an executable predicate (a shell/grep command with a binary exit), not an adjective.
Any one that now goes **red** is a regression: it makes THIS attempt's gate **FAIL** for
attempt `n` regardless of the L.4 gate result, and the failing predicate is recorded in the
L.6 ledger row as the failure reason. A loop that greens the new gate while breaking a
`## Verified Invariants` predicate has not made progress — it has traded one failure for another.

**Prior-incident check (S6).** Query `mcp__ultimate-obsidian__search_sessions` for prior
incidents on the files attempt `n` is about to touch. On a hit, print `⚠️ prior incident`
with the file and a one-line summary, and carry it into L.3 as context (do not silently
repeat a past mistake). No hit → proceed. Missing search backend → skip (no-op), state it.

### L.3 — ATTEMPT

- Plan input → execute the next incomplete task(s) per prp-implement Phase 3 conventions
  (MIRROR patterns, Context7 verification via `Skill(codebase-intelligence:context7-research)`
  for external APIs, KB check via `Skill(codebase-intelligence:ask-kb)` for pattern decisions)
- Free-form goal → implement the smallest change that could make the gate pass
- On attempt n>1: read the ledger rows for attempts 1..n-1 first. State in one line what
  this attempt does **differently**. Identical retry of a failed approach = no-progress.

**Briefing contract (passed to whoever runs the attempt — this context or the L.3 delegate).**
The briefing always carries:

- **Change budget: one logical change per iteration.** Each attempt makes exactly one
  logical change aimed at the gate. Bundling several changes hides which one moved the gate
  and inflates the verifier's diff — split them across iterations.
- the re-injected TASK ANCHOR (verbatim AC + NOT-in-scope) from Pre-Phase III, and the
  reasoning-effort dial resolved in Pre-Phase IV (no-op if the runtime exposes none).

**Opt-in "re-feed full spec" mode (default off).** By default the briefing carries only the
task(s) + prior-failure lines (lean context). When a loop is expected to run long — tie the
trigger to **iteration-count or context-budget**, not a fixed turn number; **recommend on for
loops expected to exceed ~5 iterations** — switch to **re-feed** mode: the fresh-context
delegate receives the **full plan/spec verbatim each iteration** plus the re-injected AC
anchor, so a blank-context delegate never drifts from a spec it never fully saw. State when
you enable it and why (which trigger fired).

**Advisor tier consult (S3, capability-gated).** At decision points inside the attempt, L.3
MAY consult a stronger advisor tier if `CI_MODEL_TIER` and the runtime expose more than one.
**In single-tier mode this is a no-op** — the attempt proceeds on the only tier available.

**Optional: delegate the attempt** (only if the contract's `Subagent ATTEMPT:` line is
`enabled`). Spawn **one** `Agent(general-purpose)` subagent for this attempt — a single
delegate for context isolation, never a fan-out (this is not fleet mode). Rationale: each
subagent works in its own bounded context window, so the orchestrator's window does not fill
with attempt reasoning and tool output across iterations (*kimi-k2-6-self-improving-loop.md*,
step 3). The subagent receives **only**:

- the LOOP CONTRACT + the `## Loop Constraints` block
- the next incomplete task(s) and their MIRROR patterns
- the ledger's one-line "what failed before" for attempts 1..n-1
- **plus the full plan/spec + re-injected AC anchor when re-feed mode is on** (see above) — re-feed is the one documented exception to this "only" list

and returns **only** the diff summary + the gate-relevant output (not its full reasoning).
If `disabled` (default), run the attempt in this context as above.

### L.3b — No-op guard

The no-op guard runs immediately after the ATTEMPT: run `git diff --stat`. If the diff is
**empty**, OR the attempt response is **refusal-shaped / empty** (the delegate declined or
produced nothing), the attempt changed nothing — there is nothing to gate:

- **Skip L.4 and L.5** (no gate, no verifier — running them on an empty diff wastes budget).
- Record a ledger row with `gate: not-run, reason: no-change/refusal`.
- This does **NOT** increment `no_progress_limit` — a no-op is not a distinct failed approach,
  so it must not be counted toward NO_PROGRESS (that counter is for identical *failing* attempts).
- **Reroute to a fallback model only if one is configured** (a different `CI_MODEL_TIER` is
  available); otherwise count it as an **ordinary failed attempt** (`n += 1`, go to L.7).

**Raw-API refusal branch (gated).** Only when running against the raw API and the response
carries `stop_reason: "refusal"` do you treat it as a hard refusal signal; in harness/tool
mode there is no such field, so detect refusal by the empty/refusal-shaped diff above. Never
require the `stop_reason` field to exist.

### L.4 — GATE

Run the contract's gate command(s). Capture exit code + output tail (verbatim, ≤20 lines).

**Redaction pre-write step (S4).** Before recording the captured output tail into the ledger
or session-memory, scan it for secrets (API keys, tokens, passwords, connection strings) and
third-party / customer names, and replace each with the marker `[REDACTED]`. Never transmit
captured output externally. The ledger stores the redacted tail only.

- Exit ≠ expected → gate FAIL. Skip L.5 (verifier runs only on green gates — "reserve
  self-consistency for high-stakes tasks and optimize the number of iterations").
- Exit = expected (+ output assertion matches) → gate PASS → L.4b.

### L.4b — Gate-gaming pre-scan (on git diff)

Before the green gate reaches the verifier, run an executable pre-scan over `git diff` for the
common ways a diff games the gate. Each is a grep/predicate, not a judgment call:

```
git diff | grep -nE '\.skip|\.only|xit\(|xdescribe\('        # skipped/focused tests
git diff --diff-filter=D --name-only | grep -E 'test|spec'    # deleted test/spec files
git diff | grep -nE '^\-.*(assert|expect|should)'             # removed/weakened assertions
git diff | grep -nE '^\+.*(assert|expect).*(==|===).*[0-9"'\'']'  # hardcoded literal expectations
```

Any hit → **automatic verifier FAIL** for this attempt (do not even spawn L.5); record the
matching `grep` line **as the evidence** in the ledger. This is a cheap deterministic floor
under the verifier, not a replacement for it — a clean pre-scan still goes to L.5.

### L.5 — VERIFY (independent, fresh context)

Spawn via `Agent(general-purpose)` — mirrors `doubt-driven` Step 3. The verifier gets
**only**: the LOOP CONTRACT, the gate command + captured output, and the diff
(`git diff --stat` + the full diff if ≤300 lines). **Never the maker's reasoning.**

**The fresh-context verifier is a hard floor at EVERY `CI_MODEL_TIER` — `frontier` included.**
"The model is smart enough to check itself" is **never** a valid reason to drop the
maker–checker split. A **self-critique / self-audit fallback is explicitly forbidden**: if no
second context can be spawned, the loop does not substitute self-review — it reports the
verifier as unavailable and stops rather than self-declaring done.

**Verifier model diversity (S3).** When more than one model tier is available, run the
verifier on a **different** model from the maker — an independent model is a stronger check.
**In single-tier mode** (only one model available) this is a no-op: keep the maker–checker
split but achieve independence through **instruction diversity** (the blind artifact-only
prompt below) rather than model diversity.

**Verifier worktree (S8, capability-gated).** Spawn the verifier in its **own git worktree**
(`EnterWorktree` / `--worktree`) so its checkout cannot collide with the maker's working tree.
Never parallelize lanes that touch the same files — a red action or same-file overlap must
run one lane at a time. **If worktree support is unavailable, run serial**: the verifier reads
the same working tree after the attempt settles (no concurrent lane), which preserves the
independence guarantee without worktrees.

**Large diffs (>300 lines, PL7).** When the diff exceeds the **300**-line threshold, do NOT
feed the verifier `git diff --stat` alone — a stat line hides added/removed logic and lets
gate-gaming slip through. Instead feed the diff **in chunks**, or a **hunk-level summary** that
preserves the actual added/removed logic per hunk (not just counts). State the token
trade-off explicitly: chunked/hunk review costs more tokens than `--stat` but is the only way
the verifier can judge concerns 3–4 (gaming/overfitting) on a large diff; `--stat` alone would
force a blind PASS, which is not allowed.

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

Report under 150 words, splitting the verdict into two axes:
  OUTCOME: PASS | FAIL      # does the gate output genuinely prove the Objective is met (concerns 1–2)?
  TRAJECTORY: PASS | FAIL   # was the Objective reached honestly, not by gaming/overfitting (concerns 3–4)?
  VERDICT: PASS | FAIL      # PASS only if BOTH OUTCOME and TRAJECTORY are PASS
  EVIDENCE: {file:line or output line for each concern; "none" if clean}

Default every axis to FAIL if uncertain.

CONTRACT: {paste}
ATTEMPT NUMBER: {n} of {max_iterations}
GATE: {command, exit code, output tail}
DIFF: {paste}
```

VERDICT: FAIL → treat as gate failure (record evidence in ledger, continue loop).
The maker never argues with the verifier; it addresses the evidence.

Record **both** axes (`OUTCOME` and `TRAJECTORY`) in the L.6 ledger. L.7 requires **both**
PASS for ✅ SUCCESS: a green gate with `TRAJECTORY: FAIL` (gamed/overfit) is a verifier FAIL,
not a success, no matter how clean the OUTCOME looks.

### L.6 — RECORD

`Skill(codebase-intelligence:session-memory)` → Loop Ledger append protocol. One row:

```
| {n} | {ISO timestamp} | {blast: green|yellow|red} | {gate: PASS/FAIL + exit code} | {OUTCOME: PASS/FAIL/—} | {TRAJECTORY: PASS/FAIL/—} | {accepted?: yes/no} | {diff summary, files +/-} | {next move} |
```

- **accepted?** = `yes` only when the verifier returned `VERDICT: PASS` (both OUTCOME and
  TRAJECTORY PASS) for this attempt; `no` otherwise (gate FAIL, verifier FAIL, no-op, drift).
- **Running accept-rate** = accepted rows ÷ attempts that reached the gate (exclude L.3b
  no-op/refusal rows, which are `gate: not-run`). Recompute and print it each iteration — it
  feeds the L.7 LOW_YIELD stop.

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
| Next action's `Blast radius` (`green\|yellow\|red`) is **red** (merge/deploy/deps/irreversible/security) | ⏸ HUMAN_GATE | surface to user, stop — **even if Gate PASS ∧ Verifier PASS**. A red action can NEVER auto-exit ✅ SUCCESS. |
| Gate PASS ∧ Verifier PASS (**both** OUTCOME ∧ TRAJECTORY) ∧ next action not red | ✅ SUCCESS | append gate to invariants file → Phase R |
| `elapsed > wall_clock_cap` | 🛑 TIME_CAP | → Phase R (honest failure) |
| `cumulative tokens/$ > budget` | 🛑 BUDGET_CAP | → Phase R (advisory only if no telemetry available) |
| `n ≥ 3 ∧ accept_rate < min_accept_rate` | 🛑 LOW_YIELD | → Phase R (honest failure) |
| `n ≥ max_iterations` (contract) | 🛑 MAX_ITER | → Phase R (honest failure) |
| `n ≥ 3` attempts reached a **green gate but failed the verifier** (ping-pong) | 🛑 VERIFIER_STALL | → Phase R (honest failure) |
| Last `no_progress_limit` gate failures identical | 🛑 NO_PROGRESS | escalation check below, else → Phase R (honest failure) |
| Context usage > 40% | 🛑 CONTEXT_CAP | ledger + session saved → report resume command, stop |
| Next action hits human_gate (merge/deploy/deps/irreversible) | ⏸ HUMAN_GATE | surface to user, stop |
| Otherwise | — | `n += 1`, → L.1 |

**TIME_CAP / BUDGET_CAP / LOW_YIELD are evaluated BEFORE MAX_ITER** — a loop that is burning
wall-clock, budget, or producing accepted changes below `min_accept_rate` should stop early
rather than grind to the iteration ceiling. `wall_clock_cap`, `budget`, and `min_accept_rate`
come from the LOOP CONTRACT; if a cap is absent it is skipped (that row simply never matches).
BUDGET_CAP is **advisory** when the runtime exposes no token/$ telemetry — report it as an
estimate, do not silently treat missing telemetry as "under budget" forever.

**VERIFIER_STALL (PL9)** is distinct from NO_PROGRESS: NO_PROGRESS is identical *gate* failures;
VERIFIER_STALL is the gate going **green** ≥3 times while the verifier keeps rejecting the
trajectory (the maker keeps gaming a different way each time). Route it to Phase R so a human
reads why the verifier will not accept.

**NO_PROGRESS escalation (S3).** Before declaring 🛑 NO_PROGRESS: if the last
`no_progress_limit` gate failures are **identical** AND a **stronger `CI_MODEL_TIER` exists**
AND this failure has **not yet been escalated**, then escalate the next attempt to the stronger
tier, record a ledger row noting the escalation, and **reset the identical-failure counter once**
(give the stronger tier a clean shot). Otherwise → 🛑 NO_PROGRESS. **In single-tier mode this
escalation is a no-op** — with no stronger tier available, identical repeated failures go
straight to 🛑 NO_PROGRESS.

**Never** widen the contract, weaken the gate, or raise max_iterations mid-loop to force
an exit. If the contract is wrong, stop and say so — that is a planning failure, not
iteration n+1.

**On ✅ SUCCESS — append to the project invariants file (PL14).** Append the passing gate
command to the project **invariants file** (the durable list of executable predicates future
runs re-check). This is what L.2's `## Verified Invariants` re-verification and `prp-implement`
read on later runs, so a goal proven green here becomes a regression guard everywhere. Record
it under the session-memory `## Verified Invariants` section as an executable predicate (the
gate command + expected exit), never as an adjective like "works".

**Determinism re-check before ✅ SUCCESS (flaky-gate guard).** A single green gate can be a
non-deterministic fluke. Before declaring SUCCESS, re-run the gate command once more; declare
✅ SUCCESS only if it is green **both** times (a known-flaky suite may set the contract to
require N consecutive greens). A pass that does not reproduce is a gate FAIL, not SUCCESS —
consistency is the edge, not a lucky single reading (*loop-engineering-for-trading-strategies.md*).
Model-agnostic and cheap: one extra gate run, on the final iteration only.

**Capture the workflow (offer `skillify`).** On ✅ SUCCESS, **offer**
`Skill(codebase-intelligence:skillify)` on the plan + report pair — a gate-verified loop is
exactly the reusable workflow worth caching as a skill (*kimi-k2-6-self-improving-loop.md*,
steps 6/9). Offer only; never auto-create, and never promote the loop to a scheduled/background
agent (step 10 stays rejected).

**PHASE_L_CHECKPOINT:**
- [ ] Every attempt has a ledger row (blast radius, gate, OUTCOME, TRAJECTORY, accepted?, accept-rate)
- [ ] Verifier ran on every green gate that passed the L.4b pre-scan (received attempt n)
- [ ] `## Verified Invariants` predicates re-run at L.2; any regression recorded as this attempt's gate FAIL
- [ ] Captured output redacted ([REDACTED]) before any write
- [ ] A **red** blast-radius next action routed to ⏸ HUMAN_GATE, never auto-SUCCESS
- [ ] Recurring/gamed failures promoted to `## Loop Constraints` (L.6b)
- [ ] Exit path taken matches the table — no improvised exits

---

## Phase R: REPORT

**HIERARCHY CHECK**: `mcp__ultimate-obsidian__list_vault({ path: "02-Notes/Reports" })`

**Redaction pre-write step (S4).** Before writing the diff (and any captured output) into the
report, scan it for secrets (keys, tokens, passwords, connection strings) and third-party /
customer names and replace each with `[REDACTED]`. Never transmit captured output externally —
the report stores redacted content only.

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

**Exit**: {SUCCESS | TIME_CAP | BUDGET_CAP | LOW_YIELD | MAX_ITER | VERIFIER_STALL | NO_PROGRESS | CONTEXT_CAP | HUMAN_GATE}
**Iterations**: {n} / {max_iterations}
**Accept-rate**: {accepted ÷ gated attempts} · **Cost per accepted change**: {tokens or $ ÷ accepted count; "advisory — no telemetry" if unavailable}

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

**The verifier is a hard floor at EVERY `CI_MODEL_TIER` — including `frontier`.** "The model
is smart enough to check itself" is **never** a valid reason to drop the maker–checker split,
and a self-critique / self-audit fallback is explicitly forbidden. If a second independent
context cannot be spawned, the loop reports the verifier as unavailable and stops — it does
not self-declare done. When only one model is available, keep the split via instruction
diversity (the blind artifact-only prompt), never by collapsing checker into maker.

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
