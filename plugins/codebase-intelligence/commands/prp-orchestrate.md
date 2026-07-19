---
name: prp-orchestrate
description: >
  Ticket/goal/PRD → done, autonomously. FIRST plans with the full prp-plan rigor (session-memory +
  Jira injection + codebase agents + ask-kb + Context7 before web + drift-guard) into a durable
  plan.md, THEN hands that plan.md to a mediator that fans work to 2-5 specialists each in their OWN
  git worktree (no two ever touch the same code), judges every diff each round against the target
  repo's .claude/ rules, gates merges on a 🔴 verdict, and merges passing worktrees serially. No
  mandatory Y/N gates — stops for a human ONLY on a requirement fork or a red blast-radius action
  (auth/payments/deploy/db-migration).
argument-hint: <goal | JIRA-TICKET | path/to/prd.md> [--preset <name>] [--plan <path>] [--base <branch>]
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

Take the input from `ticket/goal/PRD → done` with **no mandatory interactive Y/N gates**. One
planning phase (the full, unchanged prp-plan) feeds six mediator phases:

0. **Plan (full prp-plan rigor)** — run the existing `/prp-plan` on the input to produce a durable
   `plan.md` with Intelligence Context (verbatim AC), AC Traceability, Files-to-Change owner-lanes,
   and per-task `expected_gate`s. This is **not** replaced by the mediator — it is the source of truth
   the mediator decomposes from. See "Step 0" below.
1. **Decompose** — `project-manager` **consumes the plan.md** (not a raw goal): it maps the plan's AC
   Traceability + tasks + `expected_gate`s → the testable on-disk contract, and the plan's
   single-writer owner-lanes / Files-to-Change → the disjoint territory map (activate 2-5 roles, never 7).
2. **Activate** — one git **worktree** per active specialist off the base branch; assert territories
   are pairwise-disjoint (AC-4) — abort if they intersect.
3. **Round-judge** — each round: monitor → JUDGE every diff vs the target repo's `.claude/`
   MUST/SHOULD/MUST-NOT/SHOULD-NOT rules (drift-guard Q1-8 + rules rubric) → 🔴 blocks that merge.
4. **Verify** — `qa-analyst` runs the plan's `expected_gate`s / behavioral gates; `pr-reviewer` does
   fresh-context adversarial review.
5. **Merge** — serial merge of passing worktrees only; `ux-specialist` taste check on UI merges.
6. **Shutdown** — clean handshake, specialists save work as files, `session-memory` SESSION END.

## Step 0 — Plan with the full prp-plan rigor (do NOT skip, do NOT reinvent)

The planning phase **is** the existing `/prp-plan` command, invoked as a building block — its rigor
is inherited wholesale, nothing is discarded:

1. **Reuse-or-plan (idempotent):** if `--plan <path>` is given and the file exists, **reuse that
   plan.md** and skip to Phase 1. Otherwise invoke `/prp-plan "<input>"`.
2. `/prp-plan` runs its full pipeline on the input (a `JIRA-TICKET` like `SEATHQ-9999`, a free-text
   goal, or a `path/to/prd.md`):
   - **session-memory** — load `02-Notes/Sessions/<TICKET>-<SUFFIX>.md` from the Obsidian vault first.
   - **Jira injection** — Atlassian MCP pulls the ticket, its AC, and QA-failure comments (when the
     input is a ticket id).
   - **drift-guard anchor** — TASK ANCHOR with the verbatim AC (gate if AC missing).
   - **codebase agents** — `codebase-explorer` + `codebase-analyst` (Serena LSP), `codebase-search`.
   - **research precedence (as prp-plan already enforces):** **ask-kb (personal KB) and Context7 run
     BEFORE any web search** — `web-researcher` only fills gaps the KB + Context7 did not cover.
   - **consult-kb** — architecture reviewed against KB principles (🔴/🟡/🟢/💡).
   - Emits `plan.md` with Intelligence Context (AC verbatim, KB findings, Context7 facts, assumptions),
     AC Traceability, Files-to-Change owner-lanes, and per-task `expected_gate`s.
3. The produced `plan.md` is retained in `02-Notes/Plans/` — it is the durable planning artifact and
   the mediator's decomposition input. Never bypass it with an ad-hoc goal decomposition.
4. If `/prp-plan` surfaces a genuine **requirement fork** or refuses on a **blocking unknown**, that is
   exactly the sanctioned AC-1 human stop — surface it and wait; do not fan out on an unresolved plan.

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
- **Preset resolution (in order):** (a) explicit `--preset <name>`; else (b) **infer from the ticket
  prefix** — a `SEATHQ-9999` input resolves to `presets/seathq.yaml` when that file exists (lowercase
  the prefix before the dash); else (c) roles bind to `self` (current repo). Agents contain **no** org
  specifics — all binding is in the preset.
- `--base <branch>` overrides the auto-detected base branch every worktree forks from.
- `--plan <path>` reuses an existing `plan.md` and skips Step 0's planning (idempotent re-runs).

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
