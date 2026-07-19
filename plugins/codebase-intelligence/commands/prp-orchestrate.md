---
name: prp-orchestrate
description: >
  Goal → done, autonomously. Hands a feature goal to a mediator that decomposes it, fans work to 2-5
  specialists each in their OWN git worktree (no two ever touch the same code), judges every
  specialist diff each round against the target repo's .claude/ rules, gates merges on a 🔴 verdict,
  and merges passing worktrees serially. No mandatory Y/N gates — stops for a human ONLY on a
  requirement fork or a red blast-radius action (auth/payments/deploy/db-migration).
argument-hint: <goal> [--preset <name>] [--base <branch>]
---

# /prp-orchestrate — mediator-judged parallel agent teams

Autonomous, parallel, collision-proof alternative to running `prp-plan → prp-implement → prp-loop` by
hand. This command is **thin**: it does the preflight + interaction policy and delegates all
coordination to `Skill(mediator)` (progressive disclosure — KB: `claude-code` / Agent-Decomposition
P01/P02). The three existing commands stay unchanged and remain callable building blocks.

## Model capability (read first)

Read `CI_MODEL_TIER` (`frontier | standard | light`, default `standard`). `frontier`: sub-steps are
intent. `standard`/`light`: follow verbatim. Invariants mandatory at every tier: the disjoint-territory
assertion, the per-round rules verdict, 🔴-blocks-merge, serial merge, clean shutdown, and the
requirement-fork / red-blast-radius human gate.

## Your Mission

Take `<goal>` from `goal → done` with **no mandatory interactive Y/N gates**. The six mediator phases:

1. **Decompose** — `project-manager` turns the goal into a testable on-disk contract + a disjoint
   territory map (activate 2-5 roles, never all 7).
2. **Activate** — one git **worktree** per active specialist off the base branch; assert territories
   are pairwise-disjoint (AC-4) — abort if they intersect.
3. **Round-judge** — each round: monitor → JUDGE every diff vs the target repo's `.claude/`
   MUST/SHOULD/MUST-NOT/SHOULD-NOT rules (drift-guard Q1-8 + rules rubric) → 🔴 blocks that merge.
4. **Verify** — `qa-analyst` runs behavioral gates; `pr-reviewer` does fresh-context adversarial review.
5. **Merge** — serial merge of passing worktrees only; `ux-specialist` taste check on UI merges.
6. **Shutdown** — clean handshake, specialists save work as files, `session-memory` SESSION END.

## Step 1 — Capability preflight (U-1 / U-2)

Detect the agent-teams runtime and choose a mode:

- **Enable key (U-1 — CONFIRMED at implement time from official docs,
  https://code.claude.com/docs/en/agent-teams.md):** agent teams are on iff env
  **`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`** is set under `settings.json → "env"`.
  > Provenance: this was tracked during planning as the placeholder
  > `<AGENT_TEAMS_ENABLE_KEY — confirm at implement time>` (U-1); it is now resolved to the real key
  > above. Do not invent alternatives.
- **Team tools (U-2):** teammates are spawned in **natural language** (there is no `TeamCreate` tool
  since Claude Code v2.1.178) and message each other with the **`SendMessage`** tool. Detect whether
  this build exposes `SendMessage` + teammate spawn.

Fallback table (a fallback is never a failure — every AC still holds serially):

| Capability | Present | Absent (fallback) |
|---|---|---|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `SendMessage` | parallel: worktree-per-specialist fan-out | serial: one specialist worktree at a time, single writer, no parallelism |
| Model tiers | planner/generator/evaluator in separate contexts | single-tier: all roles on one model (no-op) |

## Step 2 — Interaction policy (AC-1)

- **No Y/N gates.** Run goal → done without per-step approval prompts.
- **STOP and ask a human ONLY on:**
  1. a genuine **requirement fork** (the goal is ambiguous in a way that changes what gets built), or
  2. a **red blast-radius** action — **auth / payments / deploy / db-migration**.
- Everything else proceeds autonomously; surface invariants **silently unless they fail** (AC-5) —
  no `PHASE_N_CHECKPOINT` narration.

## Step 3 — Load the mediator + preset

- `Skill(mediator)` owns territory allocation, the per-round `.claude/`-rules verdict, the merge gate,
  the message graph, and capability fallback.
- If `--preset <name>` is given, the mediator loads `presets/<name>.yaml` to bind the generic roles to
  repos/stacks; otherwise roles bind to `self` (current repo). Agents contain **no** org specifics.
- `--base <branch>` overrides the auto-detected base branch every worktree forks from.

## Step 4 — Auto-invoked skills (AC-5)

Inside the flow — no manual calls required — the mediator auto-invokes `drift-guard` (per-round
judging), `ask-kb` (pattern decisions), `context7-research` (any external API a specialist introduces),
`session-memory` (start/end), and `worktree-lifecycle` (ENTER/EXIT per specialist).

## Step 5 — Pre-approval note (avoid permission stalls — KB: Agent Teams P05/X01)

Teammates inherit the main session's permissions; unapproved tools stall them. Before spawning,
pre-approve the tools the specialists need (edit/write/bash/test runner + `SendMessage`). Point the
user at their `settings.json` allow-list if a specialist would otherwise block.

## What this command does NOT do

- Does not modify `prp-plan` / `prp-implement` / `prp-loop` or the 4 existing agents (they remain
  callable building blocks).
- No Workflow-tool / Task-subagent implementation — agent-teams (tmux + worktree) model only.
- No cron/scheduling, no new MCP, no auto-invocation from `prp-implement`.
- Never auto-merges a red action; never invents the enable key.
