---
name: mediator
description: >
  Coordinator + adversarial judge + merge-gate for /prp-orchestrate. Consumes the plan, slices work
  into a blocking Foundational round plus one round per prioritized user story, freezes the cross-lane
  contracts before any worktree forks, assigns disjoint file territory derived from the tasks
  themselves, fans work to 2-5 specialists each in their OWN git worktree, judges every specialist's
  diff each round against the constitution + the target repo's rule sources (.claude/ + CLAUDE.md +
  .github/ Copilot instructions, applyTo-scoped) as MUST/SHOULD/MUST-NOT/SHOULD-NOT (drift-guard Q1-8
  + rules rubric), blocks merges on a 🔴 verdict, merges passing worktrees serially into a demoable
  checkpoint per story, gates the integrated branch, and reconciles the result against the spec before
  shutdown. Capability-gated: falls back to serial single-writer worktrees when agent-teams tools are
  absent. Auto-invoked by /prp-orchestrate; invoke manually on "coordinate a team", "run the
  mediator", "judge these specialist diffs".
version: 2.0.0
---

# mediator

The reusable coordinator + judge + merge-gate procedure behind `/prp-orchestrate`. The command is
thin; this skill owns all coordination detail (progressive disclosure — KB: `claude-code` /
Agent-Decomposition P01/P02: reserve the system prompt for always-needed info, push sometimes-needed
procedure into skills).

## Model capability (read first)

Read `CI_MODEL_TIER` (`frontier | standard | light`, default `standard`).
- `frontier`: numbered sub-steps are intent; skip redundant narration.
- `standard`/`light`: follow every step verbatim.
Invariants mandatory at EVERY tier: the **Phase 0.5 analyze gate before any worktree exists**, the
**Phase A2 contract freeze before any lane forks**, the disjoint-territory assertion, the per-round
rules + constitution verdict, the 🔴-blocks-merge gate, serial merge, **the Phase E2 integration gate
before any PR exists**, **Phase E3 convergence**, clean shutdown, write-before-stop of
`orchestration-state.json`, and the fresh-context adversarial evaluator (never self-grade).

---

## Phase names — the command's numbers are these letters

`/prp-orchestrate` narrates numbered phases to the user; this skill executes lettered ones. They are
the same phases. Use this table whenever a finding, receipt, or state field cites one form and you
need the other:

| Command | Mediator | What it is |
|---|---|---|
| Phase R | *(before Phase 0)* | `refinement` — the Definition-of-Ready gate |
| Phase 0 | Phase 0 | `/prp-plan` |
| **Phase 0.5** | **Phase 0.5** | `spec-analyze` — the artifact-chain gate |
| Phase 1 | Phase A | decompose into slices + lanes |
| **Phase 1.5** | **Phase A2** | contract freeze |
| **Phase 1.9** | **Phase A3** | stacked-PR decision (opt-in) |
| Phase 2 | Phase B | allocate worktrees |
| Phase 3 | Phase C | round loop (judge) |
| Phase 4 | Phase D | verify |
| Phase 5 | Phase E | serial merge → checkpoint |
| **Phase 5.5** | **Phase E2** | `pre-pr-gate` integration gate |
| **Phase 5.75** | **Phase E3** | `spec-converge` |
| **Phase 5.9** | **Phase E4** | stack submission (only when stacking) |
| Phase 6 | Phase F | shutdown |

## The two axes: slices (when) and lanes (who)

Work is cut twice, and confusing the two is the most expensive mistake available here.

- **Slice = when.** A vertical, demoable increment: the **Foundational** slice (blocking shared
  groundwork) followed by **one slice per user story**, in priority order. A slice ends in a
  *checkpoint*: merged, gated, and independently testable on its own.
- **Lane = who.** A specialist's disjoint file territory *inside* a slice — frontend, backend, core-db.

The old shape had lanes only: everyone built their layer, nothing was demoable until every lane
landed, and one bad lane held the whole ticket. Slices fix that. P1 merges, gets gated, and is
demoable while P2 is still being written — and if the run is stopped at any checkpoint, what shipped
is a working feature rather than three-fifths of one.

Territories are disjoint **within a slice**. Two different slices may touch the same file — they are
separated in time, not in space, and the checkpoint between them is what makes that safe.

A slice is therefore already the unit a **GitHub stacked PR** layer is defined as — merged, gated, and
independently testable on its own. Phase A3 decides whether to ship it that way. Lanes are never
layers: a lane is parallel-in-space and merges into its slice's branch, and GitHub stacks are strictly
linear.

---

## State: `orchestration-state.json` (single writer = the mediator)

Persist all coordination state as JSON, **not markdown** — models overwrite markdown but respect
structured JSON (KB: Harness Patterns F03). Schema: `references/orchestration-state.schema.json`.
Written to `<repo>/.claude/orchestration-state.json`. Only the mediator writes it; specialists read it.

Top-level: `capability` · `analyze` (verdict + findings + cycles) · `contracts[]` (the freeze) ·
`slices[]` (id, story, priority, status, `specialists[]`, `rounds[]`, `mergeLog[]`, `checkpoint`,
`stackLayer`) · `gateReceipts[]` · `convergence` · `stack` · `humanGates[]`.

## Progress log: session-memory (read + write, throughout — the mediator is the single writer)

The `orchestration-state.json` is the machine contract; **session-memory is the durable narrative
record** of the run — progress, findings, common pitfalls, and lessons — in the Obsidian vault via the
`session-memory` skill. The orchestration layer **reads and writes it throughout**, not just at the end:

- **READ at start (Phase R / Phase 0):** restore any prior session for this ticket/goal — resume
  `## Last-Session State`, and re-read `## General Rules` and `## Open Failures` so the team does not
  repeat a documented pitfall (this feeds the mediator's incident-repeat check, drift-guard Q8).
- **WRITE per round + per checkpoint (Phase C-E3):** append what each round produced —
  - `## Verified Facts` — a confirmed fact with `file:line` evidence (a passing gate, a merged diff).
  - `## General Rules (distilled)` — a **reusable, ticket-agnostic pitfall or rule** learned this run
    (e.g. "MUI 7 prop X renamed — verify via Context7"): this is where **common pitfalls** are documented.
  - `## Open Failures` — anything still failing, with a required `Verify:` repro/`file:line`.
  - `## Lessons` — one `symptom → rule` line per non-obvious fix / gotcha / drift correction.
- **WRITE at SESSION END (Phase F):** the write-before-stop gate — full segmented block + append each
  proven contract gate to `## Verified Invariants`, and index for BM25 search.

**Single writer:** only the mediator writes session-memory (mirrors the plugin's single-writer rule).
Specialists **return** findings/pitfalls to the mediator (via `SendMessage`); the mediator records them.
Every vault write passes the `session-memory` pre-write secret scrub → `[REDACTED]`.

---

## Capability preflight (U-1 / U-2 — run once, before Phase A)

Detect the agent-teams runtime and pick a mode:

- **Enable key (U-1, confirmed from official docs — https://code.claude.com/docs/en/agent-teams.md):**
  agent teams are on iff env `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set (in `settings.json` →
  `"env"`).
- **Team tools (U-2):** teammates are spawned by **natural language** (there is no `TeamCreate` tool
  since v2.1.178) and message each other with the **`SendMessage`** tool. Detect whether this build
  exposes `SendMessage` + teammate spawn.

| Capability | Present | Absent (fallback) |
|---|---|---|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `SendMessage` | `capability.mode = "parallel"` — worktree-per-specialist fan-out inside each slice | `capability.mode = "serial"` — one specialist worktree at a time, single writer, no parallelism |
| Model tiers (routing) | separate contexts for planner/generator/evaluator | single-tier: all roles on one model (no-op) |
| `gh` + the `gh-stack` extension (`gh stack --help`) | stacked-PR shipping is *offerable* in Phase A3 | `stack.decidedBy = "unavailable"` — one PR for the whole run, as today; say so once, do not prompt |

Probe the stack capability with the other two — it costs one command and it decides whether Phase A3
has anything to offer:
```bash
gh stack --help >/dev/null 2>&1 && echo "gh-stack available" \
  || echo "no gh-stack — single-PR mode (fix: gh extension install github/gh-stack)"
```

The fallback is **not** a failure — every AC still holds serially, and slices still checkpoint in
priority order; only wall-clock parallelism is lost.

---

## Phase 0 — Plan (full prp-plan rigor, delegated — never reinvented)

The planning phase **is** the existing `/prp-plan` command, run as a building block; its rigor is
inherited wholesale and nothing is discarded. The mediator does **not** substitute an ad-hoc goal
decomposition for it.

1. **Reuse-or-plan (idempotent):** if the caller passed `--plan <path>` and the file exists, reuse
   that `plan.md`. Otherwise invoke `/prp-plan` on the **READY refinement contract** (`spec.md`) —
   which is itself either the Phase R output or a `--spec <path>` file that Phase R revalidated and
   passed through. Both flags are independent: `--spec` alone re-plans a parked spec; `--plan` alone
   skips straight to decomposition; both together resume at Phase 0.5.
2. `/prp-plan` runs its full pipeline unchanged: **session-memory** → **Jira injection** →
   **drift-guard anchor** (verbatim requirements) → **codebase agents** (Serena) → **ask-kb +
   Context7 BEFORE web** → **consult-kb** → **constitution Phase -1 gates + Complexity Tracking** →
   emits `plan.md`, `contracts/`, and tasks tagged `[P]` / `[US#]` / `files:`.
3. The resulting `plan.md` is the **decomposition input** for Phase A and the durable planning
   artifact — written to `specs/<slug>/plan.md` (repo) and `02-Notes/Plans/` (vault).
4. A genuine **requirement fork** or a `/prp-plan` refusal on a blocking unknown is the sanctioned
   AC-1 human stop — surface it and wait; never fan out on an unresolved plan.

## Phase 0.5 — Analyze (the artifact-chain gate — before a single worktree exists)

Run `Skill(codebase-intelligence:spec-analyze)` in a **fresh context that authored none of these
artifacts**. It grades `spec.md` → `plan.md` → tasks → territory map → contracts → constitution and
returns a coverage matrix plus severity-graded findings.

- **CRITICAL > 0 ⇒ no fan-out.** Route each finding to the phase that *owns* it (requirement → R,
  design → 0, coverage/territory → A, contract → A2) and re-analyze. Bounded at **3** cycles, then
  STOP and surface the survivors.
- ✅ ⇒ record the verdict + metrics in `orchestration-state.json → analyze` and continue.

This is the cheapest gate in the flow and it catches the most expensive class of defect — a
requirement nobody was assigned, a task nobody asked for, two lanes claiming one file — at the one
moment when fixing it costs a paragraph instead of five worktrees.

## Phase A — Decompose into slices and lanes (planner context — consumes the plan.md)

1. Invoke the `project-manager` agent (planner) with the **Phase 0 plan.md** + `spec.md` + active
   preset. The PM **maps the plan, it does not re-plan**:
   - the spec's **prioritized user stories** → the **slice list**: `S0 Foundational` (only the shared
     groundwork every story needs — schema, shared types, wiring) then `S1..Sn` in priority order,
     one per story, each carrying that story's **Independent Test** as its checkpoint criterion;
   - the plan's **tasks + `expected_gate`s + traceability** → the **contract** = granular, testable
     `done` criteria, each carrying an executable gate and its `FR/SC/US-AC` ref (KB: Harness
     Patterns F05);
   - the union of each lane's task **`files:`** → the **territory map**, per slice. Territory is
     *derived from the tasks*, not hand-drawn: that is what makes disjointness provable rather than
     asserted, and it is why `spec-analyze` can catch an overlap before allocation.
2. **Keep `S0` as small as it can possibly be.** Everything in the Foundational slice blocks every
   story; work parked there that only P2 needs delays the MVP for no reason. If only one story needs
   it, it belongs to that story's slice.
3. Approve the contract **before** any specialist writes code (KB: Agent Teams P06). Write `slices[]`
   + `contract[]` + provisional `specialists[]` into `orchestration-state.json`.
4. **Size each slice to 2-5 active specialists** — never activate all 7 (KB: Agent Teams P04/X04:
   N sessions ≈ N× token cost). A slice needing one lane runs one specialist; that is normal, not a
   failure to parallelize.
5. **Fallback (no plan.md):** only if Phase 0 was skipped AND no `--plan` was given (a trivial goal in
   a repo with no vault/Jira) may the PM decompose the raw goal directly.

## Phase A2 — Contract freeze (before any worktree forks — the fix, not the cure)

Phase E2 exists because lanes that never agreed on an interface do not compile together. This phase
removes the cause instead of catching the symptom five rounds later.

Before creating worktrees for a slice:

1. **Publish the cross-boundary interface** every lane in the slice consumes or provides — shared
   types, endpoint request/response shapes, DB schema deltas, event payloads — as real code on the
   **base branch** (or the slice's integration branch), in `contracts/` plus the source files that
   declare them. Every worktree then forks from a base that already contains the agreed shape.
2. **Write the contract tests, and confirm they FAIL** against the pre-change code. A contract test
   that passes before the feature exists is testing nothing. This is `G-INTEGRATION-FIRST` from the
   constitution, enforced mechanically.
3. **Record `contracts[]`** in the state file: id, the declaring lane (`provides`), the consuming
   lanes (`consumes`), the file path, and the contract test command.
4. **A frozen contract is immutable for the slice.** A specialist that needs it changed does **not**
   edit it: it messages `project-manager`, which either amends the contract (re-freeze, notify every
   consumer, re-run the failing contract tests) or rejects the change. A lane editing a frozen
   contract inside its own worktree is a **🔴** in Phase C — that is exactly the silent divergence
   that breaks the integrated branch.
5. A contract with **no consumer** is a speculative interface: drop it (G-SIMPLICITY).

## Phase A3 — Stacked-PR decision (opt-in; decided once, before any branch is named)

Slices are already the thing a GitHub stack layer is: *"the first, or bottom, pull request targets the
stack's trunk"* and each subsequent one targets the branch below it, merged bottom-up. Shipping N
slices as one PR discards the increment boundary the decomposition just paid for; shipping them as a
stack preserves it — each layer is reviewed against its own focused diff while the ones above it are
still being written.

This is a **shipping-shape** choice, not an architectural one, so it is decided here — after slice
count is known, before any branch is named — and never re-decided mid-run.

1. **Resolve the decision, in order:**
   - `--no-stack` → `stack.enabled = false`, `decidedBy: "declined"`. No prompt.
   - `--stack` → `enabled = true`, `decidedBy: "flag"`.
   - the capability probe failed, or the run is on a **fork** → `enabled = false`,
     `decidedBy: "unavailable"`. Say it once; do not prompt for something that cannot work.
   - fewer than **2** slices → `enabled = false`, `decidedBy: "declined"`. A one-layer stack is a PR
     with ceremony. No prompt.
   - otherwise → **offer it to the user** (see below).
2. **The offer** (the sanctioned exception to the no-Y/N-gate policy — the user asked for this
   decision explicitly, and it is sized by the implementation): present the slice list with the layer
   order it would produce and ask once, via `AskUserQuestion`. **Default on no answer, a
   non-interactive run, or anything ambiguous: `enabled = false`** — the existing single-PR behaviour.
   The offer never blocks: an unanswered offer resolves to the safe default and the run continues.
3. **Assert linearity before enabling.** `layerOrder` is the slice ids in priority order. If any slice
   depends on two prior slices in a shape that is not a chain, the stack cannot represent it —
   *"stacks with branching structures … aren't supported"* — so set `enabled = false` with that reason
   recorded. Do not flatten a DAG into a chain to make stacking possible.
4. **One stack per repo.** Stacks cannot span repositories. A run touching `fe` + `be` + `core`
   produces three independent stacks, one per repo, each with its own trunk and `layerOrder` — the
   same per-repo shape Phase E2 already uses.
5. **Record `stack` in the state file** before Phase B. Every later phase reads it; nothing re-decides
   it.

When `enabled = false`, every phase below behaves exactly as it did before this section existed.

## Phase B — Allocate (disjoint territory + worktrees, per slice)

1. **Assert territory disjointness (AC-4 invariant)** for the slice's active specialists. Because
   territory is derived from task `files:`, this is a set-intersection check, not a judgment call. Any
   intersection → `territoryDisjoint: false` and **ABORT allocation** (return to PM to re-partition).
   Shared files → overwrites → non-holistic output (KB: Agent Teams P02/X02).
2. Create **one git worktree per active specialist** off the slice's base, each a distinct path
   (`worktree` field), each on **its own new feature branch**. This is the hard guarantee that no two
   specialists ever touch the same code.

   **Never on `main`/`master`/the base branch — asserted per specialist, per repo, after spawn.**
   A specialist that begins writing while its HEAD is the base branch is a 🔴 on its first round and
   its work does not merge. The check is mechanical, and it runs *inside* each worktree:

   ```bash
   CUR=$(git branch --show-current)
   case "$CUR" in main|master|"$BASE"|"") echo "🔴 STOP: $ROLE is on '$CUR'"; exit 1 ;; esac
   ```

   Three ways it breaks: the **serial fallback** (`git switch -c` fails and the run continues on
   whatever HEAD was), a repo **already parked on an unrelated branch** (not permission to build
   there — fork off the detected base), and **multi-repo runs** (one repo being clean says nothing
   about the other two — assert per repo). In the serial fallback specialists still each get their own
   branch; only the separate checkout directory is lost.
3. Record each specialist's `recipients` explicitly (KB: Agent Teams P03 — name recipients). Default
   message graph: `frontend → {qa, ux}`, `backend → {qa}`, `core-db → {backend, qa}`,
   `qa → {pr-reviewer}`, `pr-reviewer → {project-manager, mediator}`, `ux → {frontend}`,
   `project-manager → {mediator}`.
4. **Pre-approve tools** — teammates inherit the main session's permissions; unapproved tools stall
   them (KB: Agent Teams P05/X01). Confirm the preapproval checklist before spawning.

---

## Phase C — Round loop (monitor ▸ JUDGE ▸ gate) — runs per slice

Each round, for every `working`/`submitted` specialist in the active slice:

1. **Monitor** progress (avoid the idle-teammate failure X03 — every activated specialist has an
   explicit assigned criterion + dependency).
2. **JUDGE** the specialist's diff using `references/rules-rubric.md`: parse ALL the target repo's rule
   sources — `.claude/` + `CLAUDE.md` + `.github/copilot-instructions.md` +
   `.github/instructions/*.instructions.md` (each `applyTo`-scoped to matching diff files) — as
   **MUST / MUST NOT / SHOULD / SHOULD NOT** (checklist IDs like `FQ-4` default to SHOULD), run
   drift-guard Q1-8 + the mechanical territory pre-scan, and emit
   `✅ ON TRACK / ⚠️ DRIFT RISK / 🔴 DRIFTING`.
3. **Constitution pass.** A **ratified** constitution MUST/MUST-NOT violation is 🔴 regardless of what
   the style rulebook says — it outranks the plan. A `draft` constitution produces ⚠️ only. A carried
   violation needs its Complexity Tracking row to already exist in the plan; inventing one mid-round
   to excuse a diff is itself a 🔴.
4. **Contract-freeze pass.** Any edit to a file in `contracts[]` from inside a lane worktree ⇒ 🔴,
   routed to `project-manager` as an amendment request — never merged as-is.
5. **Gate:** a 🔴 verdict (any MUST/MUST-NOT violation, a constitution violation, a frozen-contract
   edit, a territory breach, or drift 3+) sets `blocksMerge: true` and returns **actionable criteria**
   to that specialist for the next round. ⚠️ is recorded but does not block; ✅ is merge-eligible.
6. **Pre-submit smoke (cheap, in the specialist's own worktree).** Before a specialist may move to
   `submitted`, it runs the repo's typecheck, a changed-files lint at zero warnings, **and its slice's
   contract tests**, reporting every exit code. This is deliberately *not* the full gate — it is the
   cheap half that stops obviously broken work from reaching the merge queue. An unused or stale
   import found here is a 🔴 for that specialist even where the repo's own lint config only warns.
7. Auto-invoke `drift-guard`, `ask-kb` (pattern decisions), and `context7-research` (any external API
   the specialist introduces) **inside** this loop — no manual calls required (AC-5).
8. A **red blast-radius** change in any diff (auth/payments/deploy/db-migration) ⇒ append a
   `humanGates` entry and STOP for a human (AC-1) — never auto-merge a red action.

Write each round's verdicts into the slice's `rounds[]`. Loop until every active specialist in the
slice is `verdict-pass` or the slice's criteria are met (or a hard stop / human gate fires).

---

## Phase D — Verify (fresh-context adversarial evaluators) — per slice

1. `qa-analyst` (evaluator) runs the slice's **behavioral gates**, its story's **Independent Test**,
   and any **buildable `SC-###`** whose work landed in this slice → pass/fail report. A slice whose
   Independent Test does not pass is not a checkpoint, whatever its unit gates say.
2. `pr-reviewer` (adversarial evaluator) does a **harsh fresh-context** review of the merged-candidate
   diff vs the constitution + the repo's rule sources + conventions. Neither evaluator may be the
   author of the code it grades — generator/evaluator/planner keep separate contexts, never
   self-evaluate (KB: Harness Patterns P06).

---

## Phase E — Serial merge → checkpoint (merge gate) — per slice

1. Merge only `verdict-pass` worktrees, **one at a time** (serial merge — never concurrent), in a
   deterministic order recorded in the slice's `mergeLog[]`.
2. Resolve any merge conflict against the territory map (conflicts should be rare — territories are
   disjoint); a conflict that crosses territory is a territory-map bug → back to Phase B.
3. `ux-specialist` runs a taste check on any UI-affecting merge (design / originality / craft /
   functionality — KB: Harness Patterns P07) before it lands.
4. **Declare the checkpoint.** Record `checkpoint: { sliceId, sha, independentTest: pass, demoable:
   true }`. A checkpoint means exactly this: *if the run stopped here, what is on the branch works and
   is worth having.* Then start the next slice — the next slice's worktrees fork from **this** sha.

### Branch topology when `stack.enabled`

The merge order and the merge gate are unchanged. What changes is *where the merged slice lands*: a
named, pushed branch per slice instead of successive shas on one shared integration branch.

```bash
# position 0 — the bottom layer targets the trunk
git switch -c "${PREFIX}s0-foundational" "origin/$TRUNK"
# position N — each layer forks from the layer below it, never from the trunk
git switch -c "${PREFIX}s1-<story-slug>" "${PREFIX}s0-foundational"
```

- The slice's lanes merge serially into **that slice's branch**; its tip is the checkpoint sha, and it
  is what the next slice forks from. That is the same sequencing as before, just named and pushed.
- Record `slices[].stackLayer` — `branch`, `position`, `baseBranch` (the trunk at position 0, else the
  position-1 branch).
- **Push each layer as its checkpoint is declared**, and never force-push a layer another layer is
  stacked on: rewriting a lower layer invalidates every layer above it. Restacking is
  `gh stack rebase` / `gh stack sync`, never a hand-rolled cascade.
- A checkpoint whose Independent Test fails is not a layer. Do not push it and do not stack on it.

---

## Phase E2 — Integration gate (mandatory; the branch as CI and the bots will see it)

Phases C and D judge **per-specialist diffs**. They structurally cannot catch what only appears once
the worktrees are merged: a consumer importing an export a sibling deleted, a type that no longer
lines up across lanes, a build that only breaks integrated. **N green worktrees do not imply a green
branch** — that gap is how one unchecked merge breaks several PRs at once.

So after a slice's last serial merge — and always after the final slice, **before any PR exists** —
run `Skill(codebase-intelligence:pre-pr-gate)` on the integration branch:

1. **Once per repo that has diffs.** A change spanning `fe` + `be` + `core` runs three gates; the
   aggregate verdict is 🔴 if **any** repo is 🔴. Cross-repo contract changes are green only together.
2. The gate resolves real commands from the active preset's `pre_pr_gate` block (or verifies derived
   ones exist), then runs: install parity → **whole-repo typecheck** → changed-files lint at zero
   warnings → build → full non-watch test suite → **dangling/unresolved/unused import sweep** →
   **`applyTo`-scoped bot-parity replay of the repo's `.github` rulebook** → hygiene sweep →
   **constitution + frozen-contract check (L9)**.
3. **Cadence.** Mandatory before any PR. Run it at **every checkpoint** when checkpoints are shipped
   or reviewed separately, and whenever a slice touched a frozen contract — an integration break found
   at checkpoint 1 costs one slice to fix; found after checkpoint 4 it costs four.
   **When `stack.enabled` this stops being conditional: every checkpoint IS shipped separately**, so
   the gate runs once per layer, on that layer's tip, and its receipt is recorded in
   `slices[].stackLayer.gateReceiptSha`. GitHub enforces *"required reviews, required status checks,
   and CODEOWNERS … against the stack's base branch for every pull request in the stack"* — every
   layer is judged on its own, so one receipt for the top of the stack proves nothing about the
   layers below it. A layer without a passing receipt bound to its own tip is not submittable.
4. **Verdict routing:**
   - ✅ → write the receipt path + block into `gateReceipts[]`, continue.
   - 🔴 → **no PR.** Map every blocker back to the owning territory, hand it to that specialist as
     next-round *actionable criteria* (Phase C format), and re-enter the round loop. Bounded: at most
     **3** fix→re-gate cycles, then STOP and surface the surviving blockers to the human.
5. **A blocker that spans two territories** (e.g. a deleted export in `core` breaking a consumer in
   `fe`) is a territory-map or contract bug, not a specialist's mistake — route it to
   `project-manager` for a re-partition or a contract amendment (back to Phase A2/B), not to whichever
   specialist happens to own the file that fails to compile.
6. **The mediator never relaxes the gate to pass it.** Loosening a rule file, a glob, a lint severity,
   `@ts-ignore`, `.skip`, or a constitution threshold to clear a blocker is itself a 🔴 and a
   drift-guard Q5 failure.
7. Record the receipt block verbatim; it is what goes into the PR description so the reviewers and the
   PR bots have their own rule IDs already answered with commands and exit codes.

## Phase E3 — Converge (did we build the spec?) — after the final gate, before shutdown

Run `Skill(codebase-intelligence:spec-converge)` on the gated branch. It re-reads every FR, buildable
SC, and acceptance scenario against the code and classifies gaps as
`missing | partial | contradicts | unrequested`.

- **Converged** (zero findings, the append target byte-for-byte unchanged) → continue to Phase F.
- **Tasks appended** → route each to its owning lane as next-round criteria and re-enter Phase C for
  that slice; re-gate, then converge again. Bounded at **3** passes, each strictly smaller than the
  last. A pass that is not smaller is not converging — stop and surface it.
- **`unrequested` findings are never deleted by the flow.** Surface them to the human with evidence;
  a red-blast-radius one is a `humanGates` entry.

A `missing` finding on a requirement `spec-analyze` reported as **covered** is a traceability bug, not
just a gap: record it in `## General Rules (distilled)` so the next run reads its coverage matrix with
that in mind.

The gate's and converge's findings are session-memory material: a repeat blocker becomes a
`## General Rules (distilled)` entry, and its `symptom → rule` line lands in `## Lessons` — so
drift-guard Q8 (incident repeat) can catch it next run.

---

## Phase E4 — Submit the stack (only when `stack.enabled`; skipped entirely otherwise)

Runs after E3 converges and after **every** layer holds a passing E2 receipt bound to its own tip. If
`stack.enabled` is false this phase does not exist and PR creation stays where it already was.

1. **Precondition, asserted not assumed.** Every entry in `layerOrder` has
   `stackLayer.gateReceiptSha == that branch's tip`. A missing or stale receipt on **any** layer blocks
   submission of the **whole** stack — not just that layer. Bottom-up merging means a bad lower layer
   is a bad everything-above-it.
2. **Adopt the existing branches into a stack** (they already exist — the mediator created them in
   Phase E; do not let the tool create branches):
   ```bash
   gh stack init -b "$TRUNK" "${PREFIX}s0-foundational" "${PREFIX}s1-<slug>" ...   # bottom → top
   gh stack push
   gh stack submit
   ```
   If a layer already has an open PR, adopt instead of recreating:
   `gh stack link --base "$TRUNK" <branch-or-pr> <branch-or-pr> ...`.
3. **Verify the topology on GitHub before declaring success** — the local order is an intention, the
   remote order is the fact:
   ```bash
   gh stack view --json
   ```
   Store it (or its path) in `stack.verifiedBy` and assert each layer's base is the layer below it,
   with position 0 on the trunk. A mismatch is a 🔴: fix with `gh stack modify`, never by opening
   loose PRs and hoping.
4. **Each layer's PR body carries its own receipt block** — that layer's verbatim commands, exit
   codes, and the repo's own rule IDs — plus a one-line statement of what the layer is and what it
   depends on. A shared body pasted across layers defeats the reason the diffs were split.
5. **Merging is not this phase's job.** Bottom-up only, and `gh pr merge` cannot merge a stack —
   *"the legacy pull request merge endpoints can't merge a stack"*. Use `gh stack merge` when the
   human asks for it. The mediator never auto-merges a stack.
6. **The stack is finite.** Once every PR merges, that stack is closed; follow-up work is a new stack,
   not an extension of this one. Record that in the session-memory Last-Session State so a resumed run
   does not try to stack onto a closed chain.
7. **Cost note, stated once:** CI triggers on every layer. Where the target repo runs CI only on merge
   to trunk this is free; where it runs per-PR it multiplies by layer count. GitHub exposes
   `github.event.pull_request.stack` for skipping redundant jobs — **report it, never implement it**:
   this flow does not edit the target repo's workflows.

---

## Phase F — Shutdown (clean handshake)

1. Issue a shutdown handshake to each specialist; each **confirms and saves** its work as files, not
   transient state (KB: Agent Teams F06 / X05-X06 — clean shutdown, persist to filesystem). Never
   force-kill with unsaved work.
2. Run `session-memory` SESSION END (write-before-stop): Verified Facts, General Rules, Open Failures,
   Lessons, Last-Session State. Append proven contract gates to `## Verified Invariants`.
3. Remove specialist worktrees only after their work is merged or explicitly saved (mirror
   `worktree-lifecycle` EXIT: save-before-delete, confirm-before-remove).
4. **Hand off the post-merge cleanup — do not perform it.** At shutdown the PR(s) are open, so the
   feature branches, their remote copies, and the session note's open status all still belong to
   in-flight work. Record the pending cleanup in the run's Last-Session State (branch names, worktree
   paths, PR URLs) and state once that `/prp-checkup` finishes it after the merge. The only case the
   mediator cleans up itself is a PR that GitHub already reports as `MERGED`, and then only via
   `Skill(codebase-intelligence:post-merge-cleanup)` with its predicates intact.

---

## Invariants checklist (silent unless failed — AC-5)

- [ ] `spec-analyze` ran on the full chain and returned **0 CRITICAL** before any worktree existed.
- [ ] Contracts frozen with failing contract tests **before** any lane forked; no lane edited a frozen
      contract.
- [ ] Slices ordered: Foundational first, then stories by priority; each slice's checkpoint carries a
      passing Independent Test.
- [ ] `territoryDisjoint == true` per slice, derived from task `files:`, before any specialist writes.
- [ ] One distinct worktree path per active specialist, each on its **own new feature branch**;
      2-5 active per slice, never all 9.
- [ ] Post-spawn branch assertion passed for **every** specialist in **every** repo — no HEAD on
      `main`/`master`/the base branch. Asserted again after any serial-fallback re-branch.
- [ ] Every round emits a rules **and** constitution verdict per specialist; 🔴 blocks that merge.
- [ ] Recipients named for every specialist (message graph).
- [ ] Merges are serial; `mergeLog[]` ordered per slice.
- [ ] Phase E2 integration gate ran on the merged HEAD of **every** repo with diffs, verdict ✅, receipt
      SHA-bound to that HEAD — before any PR exists. No diff-size exemption; no gate relaxed to pass.
- [ ] Phase E3 convergence reached (or its survivors surfaced to the human); `unrequested` code
      reported, never deleted.
- [ ] `stack` decided exactly once in Phase A3 and never re-decided; absent decision ⇒ single PR.
- [ ] When stacking: `layerOrder` linear and equal to slice priority order; one stack per repo; every
      layer carries its own E2 receipt bound to its own tip; `gh stack view --json` agrees with
      `layerOrder` before submission is declared done. No layer force-pushed under another.
- [ ] State persisted as JSON; mediator is sole writer.
- [ ] session-memory READ at start + WRITTEN per round/checkpoint; mediator is the sole writer.
- [ ] Human asked ONLY on requirement fork or red blast-radius.
- [ ] Clean shutdown + session-memory SESSION END before exit (write-before-stop).

## Dependencies

- `references/rules-rubric.md` — the per-round grading rubric.
- `references/baseline-js-ts.md` — the project-agnostic `JT-*` JS/TS floor applied under the repo's
  own rulebook (a repo that ships no rules classifies to nothing without it).
- `references/orchestration-state.schema.json` — the durable state contract.
- `spec-analyze` — the Phase 0.5 artifact-chain gate.
- `constitution` — the architectural authority read in Phase 0, C, and E2.
- `pre-pr-gate` — the Phase E2 integration gate run on the merged HEAD.
- `spec-converge` — the Phase E3 spec↔code reconciliation.
- `gh` + the `gh-stack` extension (`gh extension install github/gh-stack`) — **optional**, and only
  for Phase E4. Absent ⇒ `stack.decidedBy = "unavailable"` and the run ships one PR. Never a hard
  dependency, never installed by this skill.
- Auto-invoked skills: `drift-guard`, `ask-kb`, `context7-research`, `session-memory`,
  `worktree-lifecycle`.
- The 7 role agents in `agents/` + a `presets/*.yaml` binding.
