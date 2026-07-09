---
name: loop-contract
description: >
  Defines and validates a Loop Contract (objective, boundaries, executable gate, stop rule,
  evidence standard, human gate) before any autonomous loop runs. Refuses to loop without an
  executable binary gate. Auto-invoked by prp-loop Pre-Phase II; invoke manually on
  "define a loop", "loop contract", "can this be looped?".
version: 1.0.0
---

# loop-contract

**One job**: no loop runs without a contract — a precise objective, an executable binary gate, and hard stop rules.

## Model capability (read first)

This skill is model-agnostic. Read `CI_MODEL_TIER` (values: `frontier` | `standard` | `light`; default `standard` when unset or unknown).
- `frontier`: treat numbered sub-steps as intent; skip redundant per-step narration.
- `standard` / `light`: follow every numbered step verbatim.
Invariants are mandatory at EVERY tier and never skipped: executable gates, the AC anchor, drift checks, write-before-stop, the independent blind verifier, and blast-radius routing.

Why this exists: loops fail through vague stop conditions ("done when it looks good"), self-graded completion, and unbounded iteration. The contract makes termination objective before the first attempt, the same way `drift-guard`'s anchor makes scope fixed before the first task.

Design grounded in the 2026-06-10 loop-engineering corpus (`02-Notes/Telegram-Inbox/`): the Workflow Contract (*claude-code-dynamic-workflows-for-ai-agent-coordination.md*), objective-gates-only rule and 4-condition test (*loop-engineering-roadmap.md*), and KB principle P15 Cyclic Workflows — cycles fail "when termination conditions are poorly defined".

---

## Step 0 — The 4-condition pre-check

Before writing a contract, confirm the task is loop-shaped at all
(*loop-engineering-roadmap.md*: "Miss one and the loop costs more than it returns"):

```
1. REPEATS      — Will this run more than once (retry-until-green counts)?
2. VERIFIABLE   — Can a command verify the outcome with a binary exit code?
3. BUDGETED     — Can the token budget absorb 5 failed attempts?
4. EQUIPPED     — Does the agent have the tools to act on failures
                  (logs, repro environment, ability to run the code)?
```

Any NO → do not loop. Report which condition failed and recommend a single
well-aimed manual run instead ("for anything where 'done' is a judgment call,
a single well-aimed prompt still wins").

---

## Step 0b — Five-failure screen

The 4-condition test above proves the task is loop-*shaped*; this screen proves the
loop *harness* is not structurally rigged to fail. Run it alongside Step 0. Each of
the five failure modes maps to a mitigation; three of them are hard refusals.

```
Blind    — no fresh-context verifier (maker grades its own work with its own context).
           Mitigation: assign the fresh-context blind Verifier (see contract).  REFUSE if absent.
Tangled  — parallel writers to one file (two attempts/agents mutate the same path).
           Mitigation: serialize writers — one logical change per iteration (Change budget);
           run serial when isolation is unavailable.                            (mitigate, may proceed)
Nodding  — verifier self-grades (verifier receives the maker's reasoning and rubber-stamps it).
           Mitigation: verifier inputs = contract + gate output + diff ONLY, never the
           maker's reasoning; scrutiny rises with n.                            REFUSE if verifier can nod.
Amnesiac — no ledger (attempts leave no durable record, so no-progress can't be detected).
           Mitigation: session-memory Loop Ledger append every attempt.         REFUSE if absent.
Manual   — no trigger (loop only ever runs when a human starts it). ACCEPTABLE — a
           human-triggered loop is the safe default, not a defect. No mitigation required.
```

Refuse to loop on **Blind**, **Nodding**, or **Amnesiac** (same severity class as 🔴 NO GATE):
these break the independent-verification and progress-detection invariants by construction.
**Tangled** may proceed once writers are serialized. **Manual** is always fine.
Fallback when tiering/isolation is absent: **run serial**, single writer, single verifier delegate.

---

## The Loop Contract

Establish before iteration 1. Append to the active session-memory file
(`mcp__ultimate-obsidian__create_or_update_note(mode: 'append')`) so every
iteration can re-read it.

```markdown
## LOOP CONTRACT
Objective:   {specific outcome — "all tests in test/auth pass", never "improve X"}
Boundaries:  {files/dirs the loop MAY touch; everything else is off-limits}
Blast radius: green|yellow|red
  (green = reversible/local; yellow = shared state → route to human review;
   red = money/prod/outbound/auth/payments/irreversible → STOP, do not loop)
Change budget: one logical change per iteration
  (no batching unrelated edits; keeps each attempt reviewable and revertible)

Architectural scope: execution|task|product|system
  (execution = one command/edit; task = a bounded unit of work; product = a
   user-facing capability; system = cross-cutting. Two taxonomies, orthogonal to
   the delegation type below.)
Delegation type: turn|goal|time|proactive
  (turn = one exchange; goal = until gate passes; time = until wall_clock_cap;
   proactive = host re-triggers on an event — host must be non-blocking.)
Autonomy dial: 0–3
  (0 = suggest only; 1 = act then wait for approval; 2 = act, report, continue;
   3 = act until gate or stop rule. Higher dial demands a tighter Blast radius.)
Exit-signal expectation (derived from Architectural scope):
  execution/task → gate exit code is the exit signal; product/system → gate PLUS
  a human acceptance checkpoint before the loop is considered complete.

Objective Gate (binary, executable — the ONLY definition of done):
  command:        {exact shell command}
  expected exit:  {0 | non-zero}
  expected output (optional): {grep-able assertion on stdout}

Stop Rule (ALL mandatory):
  max_iterations:    {default 5}
  no_progress_limit: {default 2 — consecutive attempts with identical gate failure}
  wall_clock_cap:    {default 30m — elapsed wall-clock ceiling; hit it → save ledger + STOP}
  budget:            {tokens and/or turns — e.g. "60k tokens" or "12 turns"; $ optional,
                      quote a cost ceiling ONLY when the run is metered/billed}
  min_accept_rate:   {default 0.5 — if the verifier accepts < half of attempts over the
                      window, the loop is thrashing → STOP and hand off}
  context_cap:       40% of context window → save ledger + hand off
  human_gate:        merge, deploy, dependency changes, anything irreversible → STOP and ask

Evidence Standard:
  every attempt records: file:line refs, command output (verbatim tail), diff summary
  secrets/tokens/PII in captured output MUST be masked as [REDACTED] before it is
  written to the ledger or handed to the verifier

Verifier:
  fresh-context sub-agent; inputs = this contract + gate output + diff + attempt n ONLY
  (never the maker's reasoning); scrutiny rises with n (anti gate-overfit)

Subagent ATTEMPT: enabled | disabled
  (set once at prp-loop Pre-Phase IV; enabled → each L.3 attempt runs in a fresh-context
   sub-agent for context isolation. A single delegate, never a fan-out. Default disabled.)
```

This contract is **FIXED** for the loop's lifetime. Changing the objective or
gate mid-loop is a new loop, not iteration N+1.

---

## Contract Verdict

```
✅ CONTRACT VALID  — gate is executable + binary, AND a budget (tokens/turns) is set,
                     AND all stop rules present (max_iterations, no_progress_limit,
                     wall_clock_cap, budget, min_accept_rate, context_cap, human_gate).
                     Loop may run.
⚠️  CONTRACT WEAK  — gate exists but output assertion is fuzzy, or boundaries
                     undefined. State the weakness; tighten before running.
🔴 NO GATE         — objective gate missing, non-executable, or judgment-based
                     ("looks good", "is clean", "feels right"). REFUSE to loop.
                     Tell the user what executable check would unblock it.
                     Goal predicates MUST be shell commands — adjectives
                     (clean/good/done/robust) are banned as gate definitions.
🔴 NO BUDGET       — budget (tokens/turns) absent from the Stop Rule. REFUSE to loop —
                     an unbounded loop is unbounded spend. Same severity class as 🔴 NO GATE.
```

**The 🔴 verdicts are non-negotiable.** A loop without an executable gate is the
Ralph Wiggum failure mode by construction: the maker declares done and the loop
exits on a half-done job.

---

## Cadence eligibility (before any scheduled/recurring run)

A loop is a manual tool until it has earned automation. Two hard preconditions:

1. **Manual proof-of-gate**: the objective gate MUST have been run manually and
   passed at least once, and that run's verbatim command + exit code is pasted
   into the contract/ledger as proof. No proof → no cadence.
2. **Track record**: a loop is eligible for cadence only after **≥3**
   ledger-recorded SUCCESS runs with zero gate-gaming/overfit flags.

Additional invariants for any recurring host:
- The loop **never self-schedules** — a human or an external host arms the cadence.
- The host **must be non-blocking** (fire-and-observe; it does not hold a turn open
  waiting on the loop).

Fallback: when no scheduler/host is available, this is a **no-op** — the loop simply
stays manual-trigger only (the safe **Manual** mode from the Five-failure screen).

---

## Bad-fit list — never loop these

Keep a human in the chair for (*agentic-loops-in-ai-development.md*,
*loop-engineering-roadmap.md*):

- Architecture rewrites and design decisions
- Auth, payments, security-sensitive code
- Production deploys
- Vague product work / anything where "done" is a judgment call
- Work whose diff a human will not read afterward

---

## Integration with prp-loop

- **Pre-Phase II** → run Step 0 + write the contract + emit verdict. 🔴 → command exits before iteration 1.
- **Every iteration step 3.2** → re-read the contract verbatim from session-memory before acting (anti-drift reread: "'don't do X' constraints disappear at turn 47", *loops-in-ai-coding.md*).
- **DECIDE step** → stop-rule values come from this contract, never improvised.

---

## What this skill does NOT do

- Does not run the loop — `prp-loop` owns iteration.
- Does not write the gate command for you — it validates that one exists and is binary.
- Does not replace drift-guard — the contract bounds the loop; drift-guard bounds each attempt's scope.
- Does not permit "soft" gates as a fallback. No gate, no loop.

---

## Verified Invariants

Re-confirm these before emitting any verdict (they hold at every `CI_MODEL_TIER`):

- Executable binary gate exists — adjectives (clean/good/done/robust) are never a gate.
- Budget (tokens/turns) is present — no budget, no loop (🔴 NO BUDGET).
- `wall_clock_cap` and `min_accept_rate` are set in the Stop Rule.
- The verifier is fresh-context and blind to the maker's reasoning (anti-Nodding).
- A Loop Ledger records every attempt (anti-Amnesiac); write-before-stop is honored.
- `Blast radius: green|yellow|red` is declared and routes red → STOP.
- One logical change per iteration (Change budget) with a single writer (anti-Tangled).

---

## Dependencies

- `session-memory` skill — contract persisted to the active session file.
- MCP `ultimate-obsidian` — `create_or_update_note` (append).

---

## Source patterns mirrored

- `drift-guard/SKILL.md` — fixed anchor block + verdict levels → adapted to contract + contract verdict.
- Workflow Contract — objective/boundaries/role map/evidence standard/stop rule (`02-Notes/Telegram-Inbox/2026-06-10-claude-code-dynamic-workflows-for-ai-agent-coordination.md`).
- 4-condition test + objective-gates-only (`02-Notes/Telegram-Inbox/2026-06-10-loop-engineering-roadmap.md`).
- Subagent ATTEMPT toggle (context isolation) + escalating verifier scrutiny (`02-Notes/Telegram-Inbox/2026-06-18-kimi-k2-6-self-improving-loop.md`, `2026-06-18-loop-engineering-for-trading-strategies.md`).
