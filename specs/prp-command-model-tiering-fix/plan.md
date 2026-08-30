---
title: prp-command-model-tiering-fix
type: plan
created: 2026-08-30
schema_version: 1
source: Planning session (vault-native)
project: claude-code-toolkit
up: "[[claude-code-toolkit]]"
tags:
  - prp
  - claude-code-toolkit
  - plan
  - meta-plugin
---

> **Execution environment**: implementation runs inside a fresh git worktree on a new branch off
> `main` (via `Skill(codebase-intelligence:worktree-lifecycle)` → ENTER), torn down on user
> satisfaction (EXIT: save-before-delete, confirm-before-remove). Falls back to an in-place branch
> if worktree support is unavailable.

## Summary

Fix two independent, previously-audited defects in the codebase-intelligence plugin's own
`prp-plan` / `prp-implement` commands: (1) no command ever pins a model, so the user's desired
"Opus plans, Sonnet implements" split has no mechanism; (2) `prp-implement` Phase 3 runs every
task in one continuous main-thread context with zero subagent delegation, which is a textbook
attention-dilution setup — later tasks get shallower or silently dropped, which is exactly the QA
failure the user reported. This plan fixes both with the smallest structural change that actually
closes the gap, not just a model swap.

## Intelligence Context

**Ticket**: claude-code-toolkit (no Jira ticket — project-root fallback)
**Branch**: main
**Memory sessions loaded**: 1 (this session's own audit — `claude-code-toolkit-prp-command-model-tiering-fix.md`)

### Acceptance Criteria (authoritative — do not deviate from these)
1. `prp-plan.md` frontmatter carries `model: opus`.
2. `prp-implement.md` frontmatter carries `model: sonnet`.
3. `prp-implement.md` Phase 3 delegates each task to its own fresh subagent (model: sonnet,
   single-writer per file) fed only that task's own block + relevant Context7/KB/drift context —
   not the accumulated context of prior tasks — and Step 3.7b is promoted to a cross-item
   integration pass run once at the end over ALL tasks.
4. `prp-implement.md` Phase 4 gains a mechanical gate that parses task checkboxes and hard-fails on
   any unchecked box.

### QA Context (prior failures)
User-reported (this session, not Jira): Opus-driven `/prp-implement` runs take 30+ minutes and QA
finds acceptance-criteria items silently dropped/discarded/forgotten mid-run.

### Hard boundaries (NOT in scope)
- `prp-orchestrate.md`, `prp-loop.md`, `mediator/SKILL.md`, any `agents/*.md` file — untouched.
  They already isolate per-lane/per-specialist context correctly; only `prp-implement`'s single-writer
  Phase 3 loop is broken.
- `shared/model-tier.md` — untouched. `CI_MODEL_TIER` stays a narration-verbosity switch; the new
  command-level `model:` frontmatter is a separate, orthogonal mechanism and the two coexist without
  conflict (confirmed: no file reads `CI_MODEL_TIER` to select a model id).
- No new MCP servers, no new skills, no CI/workflow changes, no `plugin.json` version bump required
  by these four ACs alone (bump only if repo convention requires it per commit — checked in T004).

### Assumptions (unresolved unknowns)
- none — all four ACs are self-contained edits to two known files, verified to exist and to lack
  the target content (Phase 2 below).

### KB Principles applied
- "Agent processes too many items in a single pass → inconsistent depth... early items get
  disproportionate attention. Fix: per-item local pass + one cross-item integration pass — NOT a
  bigger model/context window." — *Source: claude-certification-guide/1-6-task-decomposition.md*
- "If agent output quality degrades over a long session, check context composition before
  increasing model capability." — *Source: agent-patterns specialist, 04_heuristics.md:H10*
- "Persistent artifacts... a progress file... survive across sessions where in-context memory does
  not." — *Source: claude-code/building-long-running-coding-agents-harness-patterns/01_core_principles.md:P04*
- Sonnet-executor + stronger-advisor-at-decision-points ≈ 92% of frontier score at ≈63% cost —
  *Source: 02-Notes/Telegram-Inbox/x-intel-ai-engineering-moc.md (SWE-bench Pro note)*

### Context7 Library Facts
N/A — this change edits plugin command markdown (agent-instruction prose), no external library
API is called. Context7 phase is a no-op for this plan.

### Prior session decisions
none (first session on this ticket)

### Discovery source summary
| Category | File:Line | Source |
|---|---|---|
| NO-MODEL-PIN | `commands/prp-plan.md:1-7` | explorer (grep) |
| NO-MODEL-PIN | `commands/prp-implement.md:1-7` | explorer (grep) |
| NO-DELEGATION | `commands/prp-implement.md:232-378` | explorer (grep "Agent(" → 0) |
| PRECEDENT | `commands/prp-loop.md:227-232` | explorer — existing `Agent(general-purpose)` per-attempt pattern to mirror |
| NO-CHECKLIST-GATE | `commands/prp-implement.md:381-529` | explorer |
| AGENTS-ALREADY-PINNED | `agents/*.md` (12 files) | explorer (grep `model: sonnet` → 12/12) |
| KB | claude-certification-guide/1-6-task-decomposition.md | ask-kb |
| KB | agent-patterns/04_heuristics.md:H10 | ask-specialist |

## User Story

As the toolkit's user
I want `/prp-plan` to run on a stronger model and `/prp-implement` to run each task in an isolated,
right-sized context
So that plans get frontier-quality design decisions, implementation runs faster and cheaper, and no
acceptance-criteria item is silently dropped because of context rot over a long task list.

## Problem Statement

`prp-plan.md` and `prp-implement.md` carry no `model:` frontmatter, so there is no mechanism binding
"Opus plans, Sonnet implements" — today both commands simply run on whatever model the session
happens to be on. Separately, `prp-implement.md` Phase 3 executes every task of a plan serially in
one continuous main-thread context (confirmed: zero `Agent(`/Task-tool calls in the whole file), with
progress tracked only as narrative text — a documented attention-dilution failure shape where later
items in a long single-pass list get shallower treatment or are dropped outright. That second defect
is the actual cause of both the 30-minute Opus runs (heavy per-task overhead compounding in one
window) and the QA failures (dropped AC coverage); pinning a model alone does not fix it.

## Solution Statement

1. Add `model: opus` / `model: sonnet` to the two commands' frontmatter — mechanical, zero-risk,
   confirmed-supported by the harness (skills.md / sub-agents.md frontmatter reference).
2. Restructure `prp-implement.md` Phase 3 so each task is dispatched to its own fresh
   `Agent(general-purpose, model: sonnet)` subagent carrying only that task's own brief (mirroring
   the isolation `prp-loop.md`'s ATTEMPT delegation and `/prp-orchestrate`'s per-specialist
   worktrees already use elsewhere in this same plugin) — main thread stays a thin
   dispatch/collect/record loop. Promote the existing one-shot mid-run `doubt-driven` check (Step
   3.7b) into a full cross-item integration pass run once, after all tasks, over the complete set.
3. Add a mechanical Phase 4 gate that greps the plan's / `tasks.md`'s task checkboxes and fails hard
   on any `[ ]` that should be `[x]`, closing the narrative-only completeness gap.

## Metadata

- **Feature type**: BUG_FIX
- **Complexity**: MEDIUM (prose/workflow restructure across one file; two 1-line frontmatter edits)
- **Affected systems**: `plugins/codebase-intelligence/commands/prp-plan.md`,
  `plugins/codebase-intelligence/commands/prp-implement.md`
- **External dependencies**: none

## UX Design (workflow before/after — no UI)

```
BEFORE (Phase 3, current):

  main thread ── T1(drift+ctx7+kb+impl+validate+save) ─┐
                 T2(...)                                 │  ALL in one continuous
                 T3(...)                                 │  context window;
                 ...                                     │  attention dilutes as
                 doubt-driven check @ task ⌈N/2⌉ only    │  the window fills;
                 TN(...)                                 │  progress = narrative
                 ─────────────────────────────────────────┘  text only

AFTER (Phase 3, this plan):

  main thread (thin dispatcher)
    │
    ├─ dispatch T1 → Agent(sonnet, fresh ctx: T1 brief only) → result ──▶ session-memory
    ├─ dispatch T2 → Agent(sonnet, fresh ctx: T2 brief only) → result ──▶ session-memory
    ├─ ...                                                                        │
    ├─ dispatch TN → Agent(sonnet, fresh ctx: TN brief only) → result ──▶ session-memory
    │
    └─ cross-item integration pass (doubt-driven, ALL tasks) → single verdict

  Location: prp-implement.md Phase 3, Step 3.1-3.9 region
  Before: single window, N tasks compete for attention
  After: N isolated windows (one per task) + 1 integration pass; main thread's own
         context stays small regardless of plan size
  User impact: fewer dropped AC items (each task gets full attention), and per-task
         cost/latency is now Sonnet-priced instead of accumulating in one Opus-priced window
```

## Mandatory Reading

- `plugins/codebase-intelligence/commands/prp-implement.md` — file being restructured
- `plugins/codebase-intelligence/commands/prp-plan.md` — file getting the frontmatter pin
- `plugins/codebase-intelligence/commands/prp-loop.md:222-260` — the `Agent(general-purpose)`
  per-attempt delegation pattern this plan mirrors (S3, capability-gated, single delegate, never
  fan-out)
- `plugins/codebase-intelligence/shared/model-tier.md` — confirms `CI_MODEL_TIER` is narration-only,
  so the new `model:` pin does not collide with it
- `plugins/codebase-intelligence/scripts/validate.sh` (C3 frontmatter check) — confirms extra
  frontmatter keys are accepted, not just the known set

## Patterns to Mirror

- `commands/prp-loop.md:227-232` — "Spawn **one** `Agent(general-purpose)` subagent for this
  attempt — a single delegate for context isolation, never a fan-out... The subagent receives
  **only**: [scoped brief]." — same shape, reused per-task instead of per-attempt.
- `agents/*.md` frontmatter (e.g. `agents/backend-specialist.md:8`) — `model: sonnet` as the
  literal frontmatter key/value to copy for both the command pins and the new per-task
  `Agent(..., model: sonnet)` calls.

## Constitution Check

`.claude/constitution.md` — **ABSENT** in this repo. Per `shared/model-tier.md` / prp-plan's own
Constitution step: absent ⇒ this whole subsection is a silent no-op. (Note made once, not a
blocker: `Skill(constitution)` could draft one from what the repo already does — not scaffolded
here, unasked.)

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| — | — | — |

(Empty — the healthy state. No new package, no new abstraction layer; this reuses the existing
`Agent(general-purpose)` delegation pattern already present in `prp-loop.md`.)

## Contracts

N/A — single-repo, single-file-pair prose edit. No shared type, endpoint, schema, or event payload
crosses a service boundary. (The "per-task subagent brief" is an internal prompt-construction detail
inside Phase 3, not a cross-boundary interface a sibling lane consumes — this plan has one lane.)

## Files to Change

| File | Change |
|---|---|
| `plugins/codebase-intelligence/commands/prp-plan.md` | CREATE→UPDATE: add `model: opus` to frontmatter (T001) |
| `plugins/codebase-intelligence/commands/prp-implement.md` | UPDATE: add `model: sonnet` to frontmatter (T002); restructure Phase 3 Steps 3.1-3.9 for per-task delegation + promote 3.7b (T003); add Phase 4 checkbox gate (T004) |

## NOT Building

- No new agent file (`agents/task-executor.md` or similar) — reuse `general-purpose`, matching
  `prp-loop.md`'s own choice for the same problem.
- No change to how `/prp-orchestrate` or `/prp-loop` already delegate — both are out of scope and
  already correct.
- No enforcement mechanism beyond the two edited files (e.g. no new CI check) — `validate.sh`'s
  existing C3/C4 checks already cover frontmatter/fence integrity for the edited files.
- No retry/backoff logic for a failed per-task subagent beyond what Phase 3's existing "fix before
  moving on" golden rule already implies — not requested, would be scope creep.

## Step-by-Step Tasks

See `tasks.md` in this directory (standalone, checkbox-tracked copy of the same task set).

## AC Traceability

Every requirement must have ≥1 task. Every task must map to ≥1 requirement.

| Requirement | Story | Tasks | Gate |
|---|---|---|---|
| AC-1 `prp-plan.md` has `model: opus` | foundational | T001 | `grep -n '^model:' plugins/codebase-intelligence/commands/prp-plan.md` |
| AC-2 `prp-implement.md` has `model: sonnet` | foundational | T002 | `grep -n '^model:' plugins/codebase-intelligence/commands/prp-implement.md` |
| AC-3 per-task subagent delegation + promoted integration pass | foundational | T003 | `grep -c "Agent(" plugins/codebase-intelligence/commands/prp-implement.md` (≥1) + `grep -n "cross-item integration pass" plugins/codebase-intelligence/commands/prp-implement.md` |
| AC-4 mechanical checkbox gate in Phase 4 | foundational | T004 | `grep -n "Task-completeness gate" plugins/codebase-intelligence/commands/prp-implement.md` |

## Testing Strategy

This is a prose/workflow-instruction change to two markdown command files, not application code —
there is no unit-test framework for agent-instruction files in this repo. Verification is: (a) the
plugin's own `validate.sh` (C1-C8, especially C3 frontmatter and C4 fence-balance) still passes on
both edited files, and (b) each AC's grep-based gate (above) confirms the required text landed. No
new test files are created; none are needed for a markdown-prose edit.

## Validation Commands

1. **Syntax/structure**: `bash plugins/codebase-intelligence/scripts/validate.sh` (or its C1/C3/C4
   sections at minimum) — expect no new C3 (frontmatter) or C4 (fence-balance) failures on
   `prp-plan.md` / `prp-implement.md`.
2. **AC-1**: `grep -n '^model:' plugins/codebase-intelligence/commands/prp-plan.md` → `model: opus`
3. **AC-2**: `grep -n '^model:' plugins/codebase-intelligence/commands/prp-implement.md` → `model: sonnet`
4. **AC-3a**: `grep -c "Agent(" plugins/codebase-intelligence/commands/prp-implement.md` → ≥ 1
5. **AC-3b**: `grep -n "cross-item integration pass" plugins/codebase-intelligence/commands/prp-implement.md` → 1 match
6. **AC-4**: `grep -n "Task-completeness gate" plugins/codebase-intelligence/commands/prp-implement.md` → 1 match

## Acceptance Criteria checklist

- [ ] AC-1: `prp-plan.md` frontmatter carries `model: opus`
- [ ] AC-2: `prp-implement.md` frontmatter carries `model: sonnet`
- [ ] AC-3: Phase 3 dispatches each task to an isolated subagent; 3.7b promoted to a full
      cross-item integration pass over all tasks
- [ ] AC-4: Phase 4 has a mechanical, grep-able task-checkbox completeness gate

## Completion Checklist

- [ ] All four tasks (T001-T004) implemented
- [ ] `validate.sh` shows no new failures on the two edited files
- [ ] All six Validation Commands pass
- [ ] Every existing Phase 3 invariant (drift-guard, Context7, KB, behavioral gate PI2, S6, PI4,
      3.8b lessons, context guard 3.10) still present — relocated into the per-task subagent brief
      where applicable, not deleted
- [ ] `PHASE_3_CHECKPOINT` and `PHASE_4_CHECKPOINT` bullet lists updated to match the new steps
- [ ] Report + session-memory saved

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| T003's rewrite is large enough that a single pass could itself drop one of the ~10 existing Phase 3 invariants (S6, PI2, PI4, 3.8b, etc.) while relocating them — the exact failure mode this plan is fixing, applied recursively to the plan's own execution | T003's gotchas explicitly list every invariant that must survive relocation; Phase 4's own new task-completeness gate (T004) plus `validate.sh` C4 (fence balance) will catch a truncated/malformed edit |
| `model: opus` on `prp-plan.md` increases per-plan cost | Accepted trade — user explicitly requested it; planning-phase cost is bounded (one plan per feature, not per task) |
| Per-task subagent dispatch in T003 adds Task-tool round-trip overhead per task | Net expected win per the SWE-bench Pro KB finding (~63% of cost, ~92% of capability) and per H10 (context composition, not model strength, is the actual lever) — accepted |

## Blast radius

All four tasks: **green** — isolated edits to two prompt/workflow files in this plugin's own repo;
no auth/payments/deploy/db-migration path touched; no size exemption needed since none of L 5.5's
concerns (build/test/CI) apply to markdown-prose files.
