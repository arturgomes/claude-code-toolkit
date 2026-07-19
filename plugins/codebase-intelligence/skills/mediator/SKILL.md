---
name: mediator
description: >
  Coordinator + adversarial judge + merge-gate for /prp-orchestrate. Decomposes a goal into a
  testable on-disk contract, assigns disjoint file territory, fans work to 2-5 specialists each in
  their OWN git worktree, judges every specialist's diff each round against the target repo's rule
  sources (.claude/ + CLAUDE.md + .github/ Copilot instructions, applyTo-scoped) as
  MUST/SHOULD/MUST-NOT/SHOULD-NOT (drift-guard Q1-8 + rules rubric), blocks merges on
  a 🔴 verdict, and merges passing worktrees serially. Capability-gated: falls back to serial
  single-writer worktrees when agent-teams tools are absent. Auto-invoked by /prp-orchestrate;
  invoke manually on "coordinate a team", "run the mediator", "judge these specialist diffs".
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
Invariants mandatory at EVERY tier: the disjoint-territory assertion, the per-round rules verdict,
the 🔴-blocks-merge gate, serial merge, clean shutdown, write-before-stop of `orchestration-state.json`,
and the fresh-context adversarial evaluator (never self-grade).

---

## State: `orchestration-state.json` (single writer = the mediator)

Persist all coordination state as JSON, **not markdown** — models overwrite markdown but respect
structured JSON (KB: Harness Patterns F03). Schema: `references/orchestration-state.schema.json`.
Written to `<repo>/.claude/orchestration-state.json`. Only the mediator writes it; specialists read it.

## Progress log: session-memory (read + write, throughout — the mediator is the single writer)

The `orchestration-state.json` is the machine contract; **session-memory is the durable narrative
record** of the run — progress, findings, common pitfalls, and lessons — in the Obsidian vault via the
`session-memory` skill. The orchestration layer **reads and writes it throughout**, not just at the end:

- **READ at start (Phase R / Phase 0):** restore any prior session for this ticket/goal — resume
  `## Last-Session State`, and re-read `## General Rules` and `## Open Failures` so the team does not
  repeat a documented pitfall (this feeds the mediator's incident-repeat check, drift-guard Q8).
- **WRITE per round + per milestone (Phase C-E):** append what each round produced —
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
  `"env"`). This is the real key; historically tracked as the placeholder
  `<AGENT_TEAMS_ENABLE_KEY — confirm at implement time>` (U-1) — now resolved.
- **Team tools (U-2):** teammates are spawned by **natural language** (there is no `TeamCreate` tool
  since v2.1.178) and message each other with the **`SendMessage`** tool. Detect whether this build
  exposes `SendMessage` + teammate spawn.

| Capability | Present | Absent (fallback) |
|---|---|---|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` + `SendMessage` | `capability.mode = "parallel"` — worktree-per-specialist fan-out | `capability.mode = "serial"` — one specialist worktree at a time, single writer, no parallelism |
| Model tiers (routing) | separate contexts for planner/generator/evaluator | single-tier: all roles on one model (no-op) |

The fallback is **not** a failure — every AC still holds serially; only wall-clock parallelism is lost.

---

## Phase 0 — Plan (full prp-plan rigor, delegated — never reinvented)

The planning phase **is** the existing `/prp-plan` command, run as a building block; its rigor is
inherited wholesale and nothing is discarded. The mediator does **not** substitute an ad-hoc goal
decomposition for it.

1. **Reuse-or-plan (idempotent):** if the caller passed `--plan <path>` and the file exists, reuse
   that `plan.md`. Otherwise invoke `/prp-plan "<input>"` (input = `JIRA-TICKET` / goal / PRD path).
2. `/prp-plan` runs its full pipeline unchanged: **session-memory** (load the vault session first) →
   **Jira injection** (Atlassian MCP: ticket + AC + QA comments) → **drift-guard anchor** (verbatim
   AC) → **codebase agents** (`codebase-explorer` + `codebase-analyst` via Serena) → **research with
   ask-kb + Context7 BEFORE web** (`web-researcher` fills only the gaps KB + Context7 miss) →
   **consult-kb** (architecture vs KB principles) → emits `plan.md`.
3. The resulting `plan.md` (Intelligence Context with verbatim AC + KB/Context7 facts, AC Traceability,
   Files-to-Change owner-lanes, per-task `expected_gate`s) is the **decomposition input** for Phase A
   and the durable planning artifact retained in `02-Notes/Plans/`.
4. A genuine **requirement fork** or a `/prp-plan` refusal on a blocking unknown is the sanctioned
   AC-1 human stop — surface it and wait; never fan out on an unresolved plan.

## Phase A — Decompose (planner context — consumes the plan.md)

1. Invoke the `project-manager` agent (planner) with the **Phase 0 plan.md** + active preset. The PM
   **maps the plan, it does not re-plan**:
   - plan's **AC Traceability + tasks + `expected_gate`s** → the **contract** = granular, testable
     `done` criteria, each carrying the task's executable gate + its AC ref (KB: Harness Patterns F05);
   - plan's **Files-to-Change single-writer owner-lanes** → the **territory map** = disjoint glob sets
     (the plan's lanes are already single-writer, so they map almost 1:1 to territories).
2. Approve the contract **before** any specialist writes code (KB: Agent Teams P06). Write `contract[]`
   + provisional `specialists[]` into `orchestration-state.json`.
3. **Size the team to 2-5 active specialists** — never activate all 7 (KB: Agent Teams P04/X04:
   N sessions ≈ N× token cost). Activate only the roles the plan's lanes require.
4. **Fallback (no plan.md):** only if Phase 0 was skipped AND no `--plan` was given (e.g. a trivial
   goal in a repo with no vault/Jira), the PM may decompose the raw goal directly — but the default and
   preferred path is always to consume a real plan.md.

---

## Phase B — Allocate (disjoint territory + worktrees)

1. **Assert territory disjointness (AC-4 invariant).** For every pair of active specialists, their
   territory globs must not intersect. If any pair intersects → set `territoryDisjoint: false` and
   **ABORT allocation** (return to PM to re-partition). Do not proceed with overlapping ownership —
   shared files → overwrites → non-holistic output (KB: Agent Teams P02/X02).
2. Create **one git worktree per active specialist** off `baseBranch`, each a distinct path
   (`worktree` field). This is the hard guarantee that no two specialists ever touch the same code.
3. Record each specialist's `recipients` explicitly (KB: Agent Teams P03 — name recipients). Default
   message graph: `frontend → {qa, ux}`, `backend → {qa}`, `core-db → {backend, qa}`,
   `qa → {pr-reviewer}`, `pr-reviewer → {project-manager, mediator}`, `ux → {frontend}`,
   `project-manager → {mediator}`.
4. **Pre-approve tools** — teammates inherit the main session's permissions; unapproved tools stall
   them (KB: Agent Teams P05/X01). Confirm the preapproval checklist before spawning.

---

## Phase C — Round loop (monitor ▸ JUDGE ▸ gate)

Each round, for every `working`/`submitted` specialist:

1. **Monitor** progress (avoid the idle-teammate failure X03 — every activated specialist has an
   explicit assigned criterion + dependency).
2. **JUDGE** the specialist's diff using `references/rules-rubric.md`: parse ALL the target repo's rule
   sources — `.claude/` + `CLAUDE.md` + `.github/copilot-instructions.md` +
   `.github/instructions/*.instructions.md` (each `applyTo`-scoped to matching diff files) — as
   **MUST / SHOULD / MUST NOT / SHOULD NOT** (checklist IDs like `FQ-4` default to SHOULD), run
   drift-guard Q1-8 + the mechanical territory pre-scan, and emit `✅ ON TRACK / ⚠️ DRIFT RISK / 🔴 DRIFTING`.
3. **Gate:** a 🔴 verdict (any MUST/MUST-NOT violation, a territory breach, or drift 3+) sets
   `blocksMerge: true` and returns **actionable criteria** to that specialist for the next round.
   ⚠️ is recorded but does not block; ✅ is merge-eligible.
4. Auto-invoke `drift-guard`, `ask-kb` (pattern decisions), and `context7-research` (any external API
   the specialist introduces) **inside** this loop — no manual calls required (AC-5).
5. A **red blast-radius** change in any diff (auth/payments/deploy/db-migration) ⇒ append a
   `humanGates` entry and STOP for a human (AC-1) — never auto-merge a red action.

Write each round's verdicts into `rounds[]`. Loop until every active specialist is `verdict-pass` or
the goal's contract criteria are all met (or a hard stop / human gate fires).

---

## Phase D — Verify (fresh-context adversarial evaluators)

1. `qa-analyst` (evaluator) runs the contract's **behavioral gates** → pass/fail report.
2. `pr-reviewer` (adversarial evaluator) does a **harsh fresh-context** review of the merged-candidate
   diff vs the repo's rule sources (`.claude/` + `CLAUDE.md` + `.github/` instructions) + conventions.
   Neither evaluator may be the author of the code it grades —
   generator/evaluator/planner keep separate contexts, never self-evaluate (KB: Harness Patterns P06).

---

## Phase E — Serial merge (merge gate)

1. Merge only `verdict-pass` worktrees, **one at a time** (serial merge — never concurrent), in a
   deterministic order recorded in `mergeLog[]`.
2. Resolve any merge conflict against the territory map (conflicts should be rare — territories are
   disjoint); a conflict that crosses territory is a territory-map bug → back to Phase B.
3. `ux-specialist` runs a taste check on any UI-affecting merge (design / originality / craft /
   functionality — KB: Harness Patterns P07) before it lands.

---

## Phase F — Shutdown (clean handshake)

1. Issue a shutdown handshake to each specialist; each **confirms and saves** its work as files, not
   transient state (KB: Agent Teams F06 / X05-X06 — clean shutdown, persist to filesystem). Never
   force-kill with unsaved work.
2. Run `session-memory` SESSION END (write-before-stop): Verified Facts, General Rules, Open Failures,
   Lessons, Last-Session State. Append proven contract gates to `## Verified Invariants`.
3. Remove specialist worktrees only after their work is merged or explicitly saved (mirror
   `worktree-lifecycle` EXIT: save-before-delete, confirm-before-remove).

---

## Invariants checklist (silent unless failed — AC-5)

- [ ] `territoryDisjoint == true` before any specialist writes (else ABORT).
- [ ] One distinct worktree path per active specialist; 2-5 active, never all 9.
- [ ] Every round emits a rules verdict per specialist; 🔴 blocks that merge.
- [ ] Recipients named for every specialist (message graph).
- [ ] Merges are serial; `mergeLog[]` ordered.
- [ ] State persisted as JSON; mediator is sole writer.
- [ ] session-memory READ at start (restore pitfalls/last-state) + WRITTEN per round/milestone
      (progress, findings, common pitfalls, lessons); mediator is the sole session-memory writer.
- [ ] Human asked ONLY on requirement fork or red blast-radius.
- [ ] Clean shutdown + session-memory SESSION END before exit (write-before-stop).

## Dependencies

- `references/rules-rubric.md` — the per-round grading rubric.
- `references/orchestration-state.schema.json` — the durable state contract.
- Auto-invoked skills: `drift-guard`, `ask-kb`, `context7-research`, `session-memory`, `worktree-lifecycle`.
- The 7 role agents in `agents/` + a `presets/*.yaml` binding.
