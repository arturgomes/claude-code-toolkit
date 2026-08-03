---
name: prp-orchestrate
description: >
  Ticket/goal/PRD → done, autonomously. Grooms the input into a spec (prioritized, independently
  testable stories + FR/SC + a bounded clarify loop), plans it with the full prp-plan rigor
  (session-memory + Jira injection + codebase agents + ask-kb + Context7 before web + drift-guard +
  the constitution's Phase -1 gates), independently analyzes the whole artifact chain for coverage
  gaps and scope creep BEFORE any code exists, freezes the cross-lane contracts with failing contract
  tests, then hands off to a mediator that builds one demoable checkpoint per story — fanning work to
  2-5 specialists each in their OWN git worktree (no two ever touch the same code), judging every diff
  each round against the constitution + the repo's rule sources, gating merges on a 🔴 verdict,
  merging serially, gating the integrated branch before any PR, and reconciling the result against the
  spec. Can ship the result as a GitHub stacked-PR chain — one PR per slice — with --stack, or by
  accepting the one-time offer made after decomposition. No mandatory Y/N gates — stops for a human ONLY on a requirement fork or a red blast-radius
  action (auth/payments/deploy/db-migration).
argument-hint: <goal | JIRA-TICKET | path/to/prd.md> [--jira-project <CODE>] [--preset <name>] [--plan <path>] [--spec <path>] [--base <branch>] [--stack | --no-stack] [--groom-autonomous] [--no-repo-specs]
---

# /prp-orchestrate — spec-driven, mediator-judged agent teams

Autonomous, parallel, collision-proof alternative to running `prp-plan → prp-implement → prp-loop` by
hand. This command is **thin**: it does the preflight + interaction policy and delegates all
coordination to `Skill(mediator)` (progressive disclosure — KB: `claude-code` / Agent-Decomposition
P01/P02). The three existing commands stay unchanged and remain callable building blocks.

## Model capability (read first)

Read `CI_MODEL_TIER` (`frontier | standard | light`, default `standard`). `frontier`: sub-steps are
intent. `standard`/`light`: follow verbatim. Invariants mandatory at every tier: **the Phase 0.5
analyze gate before any worktree exists**, **the Phase 1.5 contract freeze before any lane forks**,
the disjoint-territory assertion, **the never-on-`main` branch assertion per specialist per repo**,
the per-round rules + constitution verdict, 🔴-blocks-merge, serial merge, **the Phase 5.5 integration
gate before any PR exists**, **Phase 5.75 convergence**, clean shutdown, and the requirement-fork /
red-blast-radius human gate.

## Your Mission

Take the input from `ticket/goal/PRD → done` with **no mandatory interactive Y/N gates**:

V. **Discover related vault work** — resolve the Jira project code (`--jira-project` or a ticket
   prefix) and search the Obsidian vault for related tasks/sessions/plans/reports; feed them as prior
   context into refinement + planning. See "Step V".
C. **Constitution (read, or offer to draft)** — load `.claude/constitution.md` (or the preset path).
   It is the architectural authority every later phase is graded against. See "Step C".
R. **Refine (Definition-of-Ready gate)** — convene the grooming panel via `Skill(refinement)`. It
   produces `spec.md`: **prioritized user stories that are each independently testable**, numbered
   `FR-###`, measurable technology-agnostic `SC-###`, scenarios, a Definition of Done derived from the
   FRs, and a **bounded clarify loop** (max 5 questions, one at a time, each answerable by picking,
   answers written back into the spec). Verdict is binary: **READY** → continue; **NOT READY** →
   **STOP** (no planning, no code) and return the clarifying questions. See "Step R".
0. **Plan (full prp-plan rigor)** — run `/prp-plan` on the READY spec to produce `plan.md` with
   Intelligence Context, the **constitution's Phase -1 gates + Complexity Tracking**, `contracts/`,
   and tasks tagged `[P]` / `[US#]` / `files:`. See "Step 0".
0.5 **Analyze (artifact-chain gate — before any worktree exists)** — `Skill(spec-analyze)` in a fresh
   context grades spec → plan → tasks → territory → contracts → constitution. **CRITICAL ⇒ no
   fan-out.** See "Phase 0.5".
1. **Decompose into slices + lanes** — `project-manager` maps the plan into `S0 Foundational` plus one
   slice per story in priority order, a contract of testable criteria with executable gates, and a
   territory map **derived from the tasks' own `files:`**.
1.5 **Freeze the contracts** — publish the cross-lane interface on the base branch with **failing**
   contract tests before any worktree forks. See "Phase 1.5".
1.9 **Decide the shipping shape** — one PR for the run, or a **GitHub stacked PR per slice**. Opt-in
   via `--stack`; otherwise offered once when the decomposition produced ≥2 slices. Default is the
   single PR. See "Phase 1.9".
2. **Activate** — one git **worktree** per active specialist off the slice's base, each on its **own
   new feature branch**; assert territories are pairwise-disjoint (AC-4) — abort if they intersect —
   and assert no specialist's HEAD is `main`/`master`/the base branch (see "The branch rule").
3. **Round-judge** — each round: monitor → JUDGE every diff vs the **constitution** and the repo's rule
   sources (`.claude/` + `CLAUDE.md` + `.github/copilot-instructions.md` +
   `.github/instructions/*.instructions.md`, each `applyTo`-scoped) as MUST/SHOULD/MUST-NOT/SHOULD-NOT
   (drift-guard Q1-8 + rules rubric) → 🔴 blocks that merge.
4. **Verify** — `qa-analyst` runs the slice's gates, its story's **Independent Test**, and any
   buildable `SC-###`; `pr-reviewer` does fresh-context adversarial review.
5. **Merge → checkpoint** — serial merge of passing worktrees only; `ux-specialist` taste check on UI
   merges; declare the checkpoint (demoable) and start the next slice from that sha.
5.5 **Integration gate (mandatory — `pre-pr-gate`)** — on the **merged** HEAD of every repo with diffs,
   before any PR exists: CI-parity install/typecheck/build/full-test, a dangling+unused-import sweep,
   a hygiene sweep, an `applyTo`-scoped replay of the repo's own `.github` rulebook, and the
   constitution + frozen-contract check. 🔴 ⇒ **no PR**. See "Phase 5.5".
5.75 **Converge** — `Skill(spec-converge)` reconciles the gated branch against the spec and appends
   whatever is `missing | partial | contradicts | unrequested`. See "Phase 5.75".
5.9 **Submit the stack** — only when Phase 1.9 enabled stacking: adopt the slice branches with
   `gh stack init` / `push` / `submit`, then verify the on-GitHub topology with `gh stack view --json`.
   Skipped entirely otherwise. See "Phase 5.9".
6. **Shutdown** — clean handshake, specialists save work as files, `session-memory` SESSION END.
7. **Finish (post-merge)** — once the PR(s) actually merge: worktrees removed, branches deleted local
   + remote, session closed with a conclusion. Deferred to `/prp-checkup` when the PRs are still open
   at shutdown, which is the normal case. See "Phase 7".

## Slices and lanes (the shape of the work)

Work is cut on two axes, and confusing them is the expensive mistake:

- **Slice = when.** A vertical, demoable increment: the **Foundational** slice (only the shared
  groundwork every story needs) then **one slice per user story**, in priority order. Each ends in a
  **checkpoint**: merged, gated, and passing its own Independent Test.
- **Lane = who.** A specialist's disjoint file territory *inside* a slice.

Lanes alone meant nothing was demoable until every layer landed and one bad lane held the whole
ticket. With slices, P1 merges and is demoable while P2 is still being written, and a run stopped at
any checkpoint leaves a working feature rather than three-fifths of one. Territories are disjoint
**within** a slice; two slices may touch the same file because the checkpoint separates them in time.

## The branch rule — never implement on `main`/`master`

**Every specialist writes on its own dedicated feature branch, inside its own worktree, forked from
the up-to-date base of the repo it is bound to. Never `main`, never `master`, never the detected base
branch under any other name, never another task's branch.** This holds for every repo a run touches —
including this toolkit itself — and has **no diff-size exemption**.

Asserted mechanically, per specialist, per repo, **after** the worktree is created (not only before):

```bash
CUR=$(git branch --show-current)
case "$CUR" in main|master|"$BASE"|"") echo "🔴 STOP: on '$CUR' — no writes until branched"; exit 1 ;; esac
```

A specialist writing while its HEAD is the base branch is a **🔴 on its first round** and its work
does not merge. The three ways this actually happens: the **serial fallback** silently leaving HEAD
where it was when `git switch -c` fails; a repo **already parked on an unrelated branch** (which is
not permission to build there — fork from the detected base); and **multi-repo runs**, where one clean
repo says nothing about the other two. The fallback costs isolation, never the branch.

`pre-pr-gate` L8 backs this up at the other end: a commit on the base branch itself is a 🔴 that
blocks the PR.

## Step V — Related vault-task discovery (by Jira project code)

Before refining, gather related prior work from the Obsidian vault so the team **reuses decisions and
avoids re-investigation**. This is read-only.

1. **Resolve the project code** — from `--jira-project <CODE>` (e.g. `SEATHQ`), or the project prefix
   of a ticket argument (`SEATHQ-9999` → `SEATHQ`). If neither is present, derive keywords from the
   goal and skip the project-scoped search.
2. **Search the vault** (`ultimate-obsidian` MCP) for related notes across `02-Notes/`:
   - `search_sessions` (BM25) on the project code + ticket id + goal keywords → prior sessions,
     decisions, and **documented pitfalls** (`## General Rules`) / `## Open Failures`.
   - `search_vault` / `grep_note` across `02-Notes/{Tasks, Wiki, Plans, Reports, Sessions}` (and any
     org subfolder) for the project code and ticket ids → related task/wiki entries, plans, reports.
3. **Collect + rank** the hits as `[[wikilinks]]`, dedupe, order by recency/relevance, and present a
   short **"Related work"** list (top ~5) with a one-line why-relevant each.
4. **Feed it forward** into Phase R and Phase 0: related ACs, decisions, pitfalls, and open failures
   from sibling tickets inform the spec and the plan — they do NOT silently become scope (drift-guard
   still applies; anything reused is stated explicitly).
5. If `--jira-project` is set and the Jira MCP is available, optionally list the project's related open
   tickets for cross-reference (read-only).

Nothing is written in this step — the mediator's session-memory writes (Step 4) own persistence.

## Step C — Constitution (the authority that outranks the plan)

Load the project constitution: `.claude/constitution.md`, or the active preset's `constitution:` path.

- **Present and `ratified`** → a MUST violation is 🔴 CRITICAL in refinement, analyze, every round
  verdict, and the integration gate. It is resolved by changing the spec/plan/code — **never** by
  editing the constitution mid-run.
- **Present and `draft`** → every constitution finding is ⚠️ advisory. It shows up in reports and
  costs nothing.
- **Absent** → all constitution checks are a silent no-op. The run never fails because a repo hasn't
  adopted one. Mention once that `Skill(constitution)` can draft one from what the repo already does,
  and move on — do not stop, and do not scaffold it unasked.

Everything the constitution adds that the existing rule sources cannot: `.claude/` and
`.github/instructions/*` are file-scoped style rules; only the constitution can say *"this design has
more moving parts than the problem deserves"* and force the justification into a Complexity Tracking
row that the PR reviewer will read.

## Step R — Refine first: the Definition-of-Ready gate (hard stop)

Nothing plans or builds until the assignment is a contract. Run `Skill(refinement)` on the input FIRST:

1. It convenes the grooming panel — `product-owner` (business intent, stories, FR/SC), `lead-engineer`
   (feasibility, edge cases, technical DoD), `project-manager` (scope, story independence), and a
   **QA lens** (`qa-analyst`: can QA fully verify and accept this?) — each in a fresh context.
2. It produces `spec.md`: **prioritized stories, each with an Independent Test**, `FR-###`,
   **measurable technology-agnostic `SC-###`** tagged `buildable` or `outcome`, scenarios
   (happy/edge/failure), edge cases, out-of-scope, a DoD derived from the FRs, and an assumption
   ledger driven to zero open rows.
3. **Ambiguity is closed by a bounded clarify loop, not a question dump**: max **5** questions per
   session, asked **one at a time**, each answerable by picking from 2-4 options (or ≤5 words), each
   led by a **recommendation with its reason** and one plain "why it matters" line — via
   `AskUserQuestion` when available. Every answer is written straight back into the owning section and
   logged under `## Clarifications / ### Session YYYY-MM-DD`.
4. It generates and scores `checklists/requirements.md` — *unit tests for the requirements* — and
   re-scores it after each clarification, reporting before/after counts and any regressions.
5. It grades against the DoR rubric and returns a **binary verdict**:
   - **READY** → persist `specs/<slug>/spec.md` (repo) + `02-Notes/Plans/<slug>.refinement.md` (vault)
     and continue to Step 0.
   - **NOT READY** → **STOP the entire flow.** Do NOT invoke `/prp-plan`, do NOT create worktrees, do
     NOT write code. Return the clarifying questions and wait.
6. **Who answers:** by **default the USER answers**. Only on explicit delegation ("answer on my
   behalf", or `--groom-autonomous`) does the panel propose answers **with rationale as ratifiable
   decisions** (flagged for confirmation) — never silent assumptions. Re-run until READY.

## Step 0 — Plan with the full prp-plan rigor (do NOT skip, do NOT reinvent)

The planning phase **is** the existing `/prp-plan` command, invoked as a building block — its rigor
is inherited wholesale, nothing is discarded:

1. **Reuse-or-plan (idempotent):** if `--plan <path>` is given and the file exists, **reuse that
   plan.md** and skip to Phase 0.5. Otherwise invoke `/prp-plan` on the **READY spec** from Step R
   (its FR/SC/stories are the authoritative requirement set).
2. `/prp-plan` runs its full pipeline: **session-memory** → **Jira injection** → **drift-guard anchor**
   (verbatim requirements + the spec's Out of Scope as hard boundaries) → **codebase agents**
   (`codebase-explorer` + `codebase-analyst` via Serena) → **ask-kb + Context7 BEFORE any web search**
   → **consult-kb** → **the constitution's Phase -1 gates** (Simplicity / Anti-Abstraction /
   Integration-First) with a **Complexity Tracking** row for every violation carried forward.
3. It emits `plan.md` (Intelligence Context, traceability, Files-to-Change owner-lanes, per-task
   `expected_gate`s), the `contracts/` set, and tasks tagged `[P]` (parallel-safe), `[US#]` (owning
   story), and `files:` (exact paths) — the fields Phase 1 derives territory from.
4. Artifacts are dual-written: `specs/<slug>/` in the repo (so intent ships in the PR) **and** the
   vault (so it stays searchable). `--no-repo-specs`, or preset `spec_artifacts: vault`, keeps the
   vault copy only.
5. If `/prp-plan` surfaces a genuine **requirement fork** or refuses on a **blocking unknown**, that is
   exactly the sanctioned AC-1 human stop — surface it and wait; do not fan out on an unresolved plan.

## Phase 0.5 — Analyze the artifact chain (before a single worktree exists)

Run `Skill(codebase-intelligence:spec-analyze)` in a **fresh context that authored none of these
artifacts** — the plan's own traceability table is written by the planner, and self-grading is exactly
what this gate exists to stop.

It grades `spec.md → plan.md → tasks → territory map → contracts → constitution` and returns a
coverage matrix plus severity-graded findings: a requirement with **zero tasks**, a task mapped to
**no requirement** (scope creep, caught before it is written), an unquantified SC, terminology drift,
a file claimed by **two lanes**, a lane with **no tasks**, a consumed symbol missing from the frozen
contracts, a constitution violation with no Complexity Tracking row.

- **CRITICAL > 0 ⇒ no fan-out.** Route each finding to the phase that *owns* it — requirement → Step
  R, design → Step 0, coverage/territory → Phase 1, contract → Phase 1.5 — and re-analyze. Bounded at
  **3** cycles, then STOP and surface the survivors.
- Fixing a coverage finding by bolting a task onto an ambiguous requirement is the failure this
  routing prevents. Fix it at the source.

This is the cheapest gate in the flow, and it catches the most expensive defect class at the one
moment when the fix costs a paragraph instead of five worktrees.

## Phase 1.5 — Contract freeze (the fix for cross-lane breakage, not the cure)

Phase 5.5 exists because lanes that never agreed on an interface do not compile together. This phase
removes the cause.

Before any worktree forks for a slice:

1. **Publish the cross-boundary interface** every lane consumes or provides — shared types, endpoint
   request/response shapes, DB schema deltas, event payloads — as real code on the base branch, so
   every worktree forks from a base that already contains the agreed shape.
2. **Write the contract tests and confirm they FAIL** against the pre-change code. A contract test
   that passes before the feature exists is testing nothing. (This is the constitution's
   `G-INTEGRATION-FIRST`, enforced mechanically.)
3. **A frozen contract is immutable for the slice.** A specialist needing a change messages
   `project-manager`, which amends and re-freezes (notifying every consumer) or rejects. A lane
   editing a frozen contract inside its own worktree is a **🔴** — that silent divergence is precisely
   what breaks the integrated branch.
4. A contract with **no consumer** is speculative: drop it.

## Phase 1.9 — Stacked PRs: one PR per slice, or one PR for the run

A slice is already what GitHub defines a **stack layer** as: merged, gated, independently testable, in
priority order. Shipping N of them as a single PR throws away the increment boundary the decomposition
just paid for. Shipping them as a stack keeps it — the bottom PR targets the trunk, each next PR
targets the branch below it, and reviewers get one focused diff per layer while the layers above are
still being written. GitHub's own docs give this as the motivating case for AI-generated changes:
each task maps to one PR rather than combining unrelated changes.

**It is opt-in, sized by the implementation, and decided once — here, after slice count is known and
before any branch is named.**

1. `--no-stack` → single PR, no prompt. `--stack` → stack, no prompt.
2. No flag, and **≥2 slices**, and `gh stack --help` succeeds, and the run is not on a fork → **offer
   it once** with the layer order it would produce (`AskUserQuestion`). Fewer than 2 slices, no
   extension, or a fork → single PR, stated once, not prompted.
3. **Default on no answer / non-interactive / ambiguity: single PR.** The offer never blocks the run.
4. **Linear only.** `layerOrder` = slice ids in priority order. A slice that depends on two prior
   slices in a non-chain shape cannot be a stack ("stacks with branching structures … aren't
   supported") — fall back to a single PR rather than flattening a DAG to fit.
5. **One stack per repo.** Stacks cannot span repositories; a `fe` + `be` + `core` run produces three
   independent stacks, the same per-repo shape Phase 5.5 already uses.

Lanes are never layers — a lane is parallel work inside one slice and merges into that slice's branch.

## Phase 5.5 — Integration gate: the wall between "merged" and "PR opened" (mandatory)

Per-round judging grades each specialist's diff **in isolation**. That is structurally blind to what
only exists once the lanes are merged: a consumer importing an export a sibling deleted, a type
mismatch across lanes, a build that only breaks integrated, an unused import CI never fails on.
**N green worktrees do not imply a green branch.**

After a slice's last serial merge — and always after the final slice, **before any PR exists** — run
`Skill(codebase-intelligence:pre-pr-gate)`:

1. **Once per repo that has diffs.** A change spanning `seathq-fe` + `seathq-be` + `seathq-core` runs
   three gates; the aggregate verdict is 🔴 if **any** repo is 🔴.
2. Layers, in order: **L0** resolve real gate commands (a prescribed script that does not exist is a
   misconfiguration, never a silent pass; never run a mutating command such as `eslint --fix` as a
   gate) → **L1** CI-parity install → **L2** whole-repo typecheck → **L3** changed-files lint at zero
   warnings → **L4** build → **L5** full non-watch test suite → **L6** dangling / unresolved / unused
   import sweep → **L7** `applyTo`-scoped bot-parity rulebook replay → **L8** hygiene sweep →
   **L9** constitution + frozen-contract check.
3. **Cadence.** Mandatory before any PR; run it at **every checkpoint** that is shipped or reviewed
   separately, and whenever a slice touched a frozen contract. A break found at checkpoint 1 costs one
   slice to fix; found after checkpoint 4 it costs four. **Under stacking this is unconditional** —
   every checkpoint is a PR, GitHub enforces required checks and CODEOWNERS against the trunk for
   *every* layer, so each layer needs its own receipt bound to its own tip. One receipt for the top of
   the stack says nothing about the layers below it.
4. **Bot parity is the point of L7.** The PR is reviewed by GitHub Copilot review and Cursor bugbot,
   which read the repo's own `.github/copilot-instructions.md` + `.github/instructions/*`. L7 replays
   exactly those files over the merged diff, `applyTo`-scoped, citing the repo's real rule IDs
   (`FR-1`, `FQ-4`, `T-5`, `DB-3`, `PKG-1`, `CORE-002`, `SOLID-SRP-001`, `CG-003`). MUST/MUST-NOT ⇒ 🔴
   fix now; SHOULD ⇒ carried as an acknowledged note with a rationale.
5. **Verdict routing:** ✅ → record the receipt in `orchestration-state.json` and continue.
   🔴 → **no PR**; each blocker goes back to the owning specialist as next-round actionable criteria,
   and a blocker crossing two territories goes to `project-manager` as a contract/territory-map bug.
   Bounded at **3** fix→re-gate cycles, then STOP and surface the survivors to the human.
6. **Never relax a gate to pass it.** Loosening a rule file or glob, lowering a lint severity, adding
   `@ts-ignore` / `eslint-disable` / `.skip`, or widening a constitution threshold — each is itself a
   🔴 and a drift-guard Q5 failure.
7. **Paste the receipt block into the PR description**, together with any Complexity Tracking rows —
   the bots' own rule IDs answered, with verbatim commands and exit codes, before anyone opens the
   diff.

This phase is mandatory at every `CI_MODEL_TIER` and has **no diff-size exemption** — "it was a small
change" is precisely the reasoning that produced the broken PRs.

## Phase 5.75 — Converge: did we build the spec?

Every gate before this answers a local question. None answers the one the ticket was opened for. Run
`Skill(codebase-intelligence:spec-converge)` on the gated branch: it re-reads every FR, buildable SC,
and acceptance scenario against the code and classifies each gap as
`missing | partial | contradicts | unrequested`.

- **Converged** (zero findings, the append target byte-for-byte unchanged — `specs/<slug>/tasks.md`
  normally, the vault plan note under `--no-repo-specs`) → Phase 6.
- **Tasks appended** → route each to its owning lane as next-round criteria, re-gate, converge again.
  Bounded at **3** passes, each strictly smaller than the last.
- **`unrequested` code is surfaced, never deleted** — with `file:line` evidence, for the human to
  justify or remove. A red-blast-radius one is a human gate.

## Phase 5.9 — Submit the stack (only when Phase 1.9 enabled it)

Skipped entirely when stacking is off — PR creation then stays exactly where it already was.

1. **Precondition:** every layer holds a passing Phase 5.5 receipt bound to **its own tip**. A missing
   or stale receipt on any layer blocks the whole stack, because merging is bottom-up.
2. **Adopt the slice branches** the mediator already created and pushed — do not let the tool invent
   branches:
   ```bash
   gh stack init -b "$TRUNK" "$LAYER0" "$LAYER1" ...   # bottom → top
   gh stack push
   gh stack submit
   ```
   A layer that already has an open PR is adopted with `gh stack link --base "$TRUNK" <branch|pr> ...`.
3. **Verify on GitHub, don't assume:** `gh stack view --json` must show position 0 on the trunk and
   every other layer based on the one below it. A mismatch is a 🔴 — fix with `gh stack modify`, never
   by opening loose PRs.
4. **Per-layer PR body:** that layer's own receipt block, plus one line on what the layer is and what
   it depends on. A body copy-pasted across layers defeats the point of splitting the diffs.
5. **Never auto-merge a stack.** Merging is bottom-up and `gh pr merge` cannot do it — the legacy merge
   endpoints can't merge a stack. `gh stack merge` runs only when the human asks.
6. **A stack closes when fully merged.** Follow-up work starts a new stack; record that in
   session-memory so a resumed run doesn't try to extend a closed chain.

## Phase 7 — Finish: the post-merge checklist

Shutdown ends with N worktrees removed *for the specialists* and one or more PRs **open**. Nothing in
the flow has ever closed what comes after the merge — the feature branches, their remote copies, and
session notes ending in "resume here" survive every run, one set per ticket, until someone notices.

Follow `Skill(codebase-intelligence:post-merge-cleanup)`; it owns the safety predicates.

1. **Read each PR's real state** — `gh pr view --json state,mergedAt,headRefOid`. A squash merge leaves
   the branch looking unmerged to git, so `git branch --merged` is not the authority here and never
   decides a deletion.
2. **Merged** → remove the worktree, delete the branch locally and on the remote (one confirmation for
   the batch — remote deletion is outward-facing), then `session-memory` **SESSION CLOSE**: what
   shipped, the PR URL, what was cleaned, and a `Carried forward` line for any Open Failure that
   outlives the ticket. An unresolved failure does not disappear because the PR merged.
3. **Open** (the normal case at shutdown) → clean nothing. State once that cleanup is pending and that
   `/codebase-intelligence:prp-checkup` will finish it. A pending cleanup is a correct outcome.
4. **Stacked runs** — a layer's branch is **not** deleted while any open PR still targets it, even if
   that layer merged. Bottom-up merging means the layer above would lose its base. The guard is
   mechanical (`post-merge-cleanup` P3), and it usually resolves itself once GitHub retargets the
   stack.
5. **Multi-repo runs** — the checklist is per repo, exactly like Phase 5.5's gate. Three repos with
   diffs means three sweeps; one clean repo says nothing about the other two.

## Step 1 — Capability preflight (U-1 / U-2)

Detect the agent-teams runtime and choose a mode:

- **Enable key (U-1 — CONFIRMED from official docs,
  https://code.claude.com/docs/en/agent-teams.md):** agent teams are on iff env
  **`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`** is set under `settings.json → "env"`.
- **Team tools (U-2):** teammates are spawned in **natural language** (there is no `TeamCreate` tool
  since Claude Code v2.1.178) and message each other with the **`SendMessage`** tool. Detect whether
  this build exposes `SendMessage` + teammate spawn.

Fallback table (a fallback is never a failure — every AC still holds serially):

| Capability | Present | Absent (fallback) |
|---|---|---|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `SendMessage` | parallel: worktree-per-specialist fan-out inside each slice | serial: one specialist worktree at a time, single writer; slices still checkpoint in priority order |
| Model tiers | planner/generator/evaluator in separate contexts | single-tier: all roles on one model (no-op) |
| `gh` + `gh-stack` extension (`gh stack --help`) | Phase 1.9 may offer stacked PRs | single PR for the run, as before — stated once, never prompted (fix: `gh extension install github/gh-stack`) |

## Step 2 — Interaction policy (AC-1)

- **No Y/N gates.** Run goal → done without per-step approval prompts.
- **The Phase 1.9 stack offer is not a Y/N gate either** — it is asked at most once, only when the
  decomposition produced ≥2 slices and the tooling supports it, and **no answer resolves to the safe
  default (single PR)** rather than blocking. It is a shipping-shape choice the user asked to size
  against the implementation; `--stack` / `--no-stack` skip it entirely.
- **The clarify loop in Step R is not a Y/N gate** — it is bounded (≤5), each question is a pick, and
  it happens once, before anything is built. That is the cheapest interaction in the flow and it is
  the one that prevents building the wrong thing.
- **STOP and ask a human ONLY on:**
  1. a genuine **requirement fork** (the goal is ambiguous in a way that changes what gets built), or
  2. a **red blast-radius** action — **auth / payments / deploy / db-migration**.
- Everything else proceeds autonomously; surface invariants **silently unless they fail** (AC-5) —
  no `PHASE_N_CHECKPOINT` narration. **Do** announce each checkpoint: a demoable increment landing is
  information the user acts on, not narration.

## Step 3 — Load the mediator + preset

- `Skill(mediator)` owns slice/lane decomposition, the contract freeze, territory allocation, the
  per-round rules + constitution verdict, the merge gate, checkpoints, the message graph, and
  capability fallback.
- **Preset resolution (in order):** (a) explicit `--preset <name>`; else (b) **infer from the Jira
  project code** — `--jira-project SEATHQ` or a ticket prefix (`SEATHQ-9999` → `SEATHQ`) resolves to
  `presets/seathq.yaml` when that file exists (lowercase the code); else (c) roles bind to `self`
  (current repo). Agents contain **no** org specifics — all binding is in the preset.
- `--base <branch>` overrides the auto-detected base branch every worktree forks from.
- `--plan <path>` / `--spec <path>` reuse existing artifacts and skip the phase that produces them
  (idempotent re-runs).
- `--stack` / `--no-stack` force the Phase 1.9 shipping shape and suppress its offer.

## Step 4 — Auto-invoked skills (AC-5)

Inside the flow — no manual calls required — the flow auto-invokes `refinement` (Step R),
`constitution` (read), `spec-analyze` (Phase 0.5), `drift-guard` (per-round judging), `ask-kb`
(pattern decisions), `context7-research` (any external API a specialist introduces),
`worktree-lifecycle` (ENTER/EXIT per specialist), `pre-pr-gate` (Phase 5.5), `spec-converge`
(Phase 5.75) and `post-merge-cleanup` (Phase 7, only once a PR has actually merged). Three of these
can veto: `spec-analyze` vetoes fan-out, `pre-pr-gate` vetoes the PR, `spec-converge` vetoes shutdown.

**Progress tracking — `session-memory` read/write throughout (not just at end):** the orchestration
layer **reads** prior session-memory at the start (restore last-state + re-read documented pitfalls so
the team doesn't repeat them) and **writes** it per round and per checkpoint — progress + `## Verified
Facts`, **common pitfalls → `## General Rules`**, `## Open Failures`, and `symptom → rule` `## Lessons`
— then a full SESSION END (write-before-stop) with `## Verified Invariants`. The mediator is the sole
session-memory writer; specialists return findings to it via `SendMessage`.

## Step 5 — Pre-approval note (avoid permission stalls — KB: Agent Teams P05/X01)

Teammates inherit the main session's permissions; unapproved tools stall them. Before spawning,
pre-approve the tools the specialists need (edit/write/bash/test runner + `SendMessage`). Point the
user at their `settings.json` allow-list if a specialist would otherwise block.

## What this command does NOT do

- Does not modify `prp-plan` / `prp-implement` / `prp-loop`'s own contracts (they remain callable
  building blocks; `prp-plan` gains task metadata and the constitution gate, nothing is removed).
- No Workflow-tool / Task-subagent implementation — agent-teams (tmux + worktree) model only.
- No cron/scheduling, no new MCP, no auto-invocation from `prp-implement`.
- Never auto-merges a red action; never invents the enable key.
- Does not add CI jobs, install tooling, or edit the target repo's rule files — Phase 5.5 runs the
  repo's **own** toolchain and reads the repo's **own** rulebook.
- Never scaffolds or amends a constitution to make a gate pass, and never amends one mid-run.
- Never opens a PR on a 🔴 integration gate, and never weakens a gate, glob, or lint severity to clear
  one.
- Never deletes `unrequested` code found at convergence — it reports it with evidence.
- Never deletes a branch, a remote branch, or a worktree before its PR is **merged on GitHub**, and
  never deletes the branch of a closed-unmerged PR as routine cleanup. Phase 7 defers to
  `/prp-checkup` rather than guessing.
- Does not stack by default, does not install the `gh-stack` extension, and does not merge a stack —
  `gh stack merge` is bottom-up and human-initiated. It also does not edit the target repo's workflows
  to deduplicate per-layer CI (`github.event.pull_request.stack` is reported as an option, never
  applied), and never flattens a non-linear slice dependency to make a stack possible.
