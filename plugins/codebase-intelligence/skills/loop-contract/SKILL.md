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

## The Loop Contract

Establish before iteration 1. Append to the active session-memory file
(`mcp__ultimate-obsidian__create_or_update_note(mode: 'append')`) so every
iteration can re-read it.

```markdown
## LOOP CONTRACT
Objective:   {specific outcome — "all tests in test/auth pass", never "improve X"}
Boundaries:  {files/dirs the loop MAY touch; everything else is off-limits}

Objective Gate (binary, executable — the ONLY definition of done):
  command:        {exact shell command}
  expected exit:  {0 | non-zero}
  expected output (optional): {grep-able assertion on stdout}

Stop Rule (ALL mandatory):
  max_iterations:    {default 5}
  no_progress_limit: {default 2 — consecutive attempts with identical gate failure}
  context_cap:       40% of context window → save ledger + hand off
  human_gate:        merge, deploy, dependency changes, anything irreversible → STOP and ask

Evidence Standard:
  every attempt records: file:line refs, command output (verbatim tail), diff summary

Verifier:
  fresh-context sub-agent; inputs = this contract + gate output + diff ONLY
  (never the maker's reasoning)
```

This contract is **FIXED** for the loop's lifetime. Changing the objective or
gate mid-loop is a new loop, not iteration N+1.

---

## Contract Verdict

```
✅ CONTRACT VALID  — gate is executable + binary, all stop rules set. Loop may run.
⚠️  CONTRACT WEAK  — gate exists but output assertion is fuzzy, or boundaries
                     undefined. State the weakness; tighten before running.
🔴 NO GATE         — objective gate missing, non-executable, or judgment-based
                     ("looks good", "is clean", "feels right"). REFUSE to loop.
                     Tell the user what executable check would unblock it.
```

**The 🔴 verdict is non-negotiable.** A loop without an executable gate is the
Ralph Wiggum failure mode by construction: the maker declares done and the loop
exits on a half-done job.

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

## Dependencies

- `session-memory` skill — contract persisted to the active session file.
- MCP `ultimate-obsidian` — `create_or_update_note` (append).

---

## Source patterns mirrored

- `drift-guard/SKILL.md` — fixed anchor block + verdict levels → adapted to contract + contract verdict.
- Workflow Contract — objective/boundaries/role map/evidence standard/stop rule (`02-Notes/Telegram-Inbox/2026-06-10-claude-code-dynamic-workflows-for-ai-agent-coordination.md`).
- 4-condition test + objective-gates-only (`02-Notes/Telegram-Inbox/2026-06-10-loop-engineering-roadmap.md`).
