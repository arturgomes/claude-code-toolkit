---
name: spec-analyze
description: >
  Read-only cross-artifact consistency gate that runs BEFORE any specialist writes code. Grades the
  refinement contract (spec.md) against plan.md, tasks.md, the territory map, and the constitution —
  detecting coverage gaps (a requirement with zero tasks), unmapped tasks (scope creep), duplication,
  ambiguity, terminology drift, contract holes, and territory-overlap defects. Emits a severity-graded
  findings table + a requirement→task→gate coverage matrix; CRITICAL blocks fan-out. Never edits a
  file. Auto-invoked by prp-orchestrate (Phase 0.5) and prp-implement (Step 1.5, before the first
  task); invoke manually on "check my artifacts line up", "is this plan actually covered",
  "analyze spec vs plan vs tasks".
version: 1.0.0
---

# spec-analyze — the gate between "we planned it" and "we built it"

The most expensive failure in this plugin is not a broken build. It is **five worktrees of correct
code that implement the wrong contract** — an AC nobody assigned, a task nobody traced to an AC, two
lanes that both think they own `types.ts`. Per-diff judging cannot see any of that: it grades a diff
against rules, not the artifact chain against itself.

This skill reads the chain — **refinement contract → plan → tasks → territory map → gates** — and
refuses to let a run fan out while a link is broken. It is cheap (one fresh context, read-only, no
worktrees exist yet) and it runs at the exact moment fixing things is still free.

## Model capability (read first)

Read `CI_MODEL_TIER` (`frontier | standard | light`, default `standard`). `frontier`: passes are
intent, run them in the cheapest correct order. `standard`/`light`: run every pass verbatim.
Mandatory at every tier: **read-only**, the **coverage matrix**, **CRITICAL blocks fan-out**, and the
**fresh-context rule** — the analyzer never authored the artifacts it grades.

## Operating constraints

1. **STRICTLY READ-ONLY.** Never modify `spec.md`, `plan.md`, `tasks.md`, the territory map, or any
   code. The output is a report. Remediation is performed by the phase that *owns* the defect.
2. **Fresh context, never the author.** The agent that wrote the plan may not analyze it
   (KB: Harness Patterns P06 — generator ≠ evaluator). The plugin's AC-traceability table is written
   by the planner; this skill is what stops that from being self-grading.
3. **Constitution authority.** A ratified constitution MUST violation is automatically **CRITICAL**
   and is resolved by changing the spec/plan/tasks — never by diluting, reinterpreting, or silently
   dropping the principle. A `draft` constitution produces HIGH findings that do not block.

---

## Inputs

| Artifact | Source | Required |
|---|---|---|
| `spec.md` | refinement contract — `specs/<slug>/spec.md` (repo) or `02-Notes/Plans/<slug>.refinement.md` (vault) | yes |
| `plan.md` | `/prp-plan` output — repo `specs/<slug>/plan.md` or `02-Notes/Plans/<slug>.plan.md` | yes |
| `tasks.md` / `contract[]` | plan tasks, or the project-manager's contract in `orchestration-state.json` | yes |
| territory map | `orchestration-state.json → specialists[].territory` | when orchestrating |
| `contracts/` | the frozen cross-lane interface set | when orchestrating |
| constitution | `.claude/constitution.md` (or preset path) | optional |

Missing a **required** artifact ⇒ abort and name the command that produces it. Never analyze a
partial chain and report a coverage number computed from half of it.

## Load progressively

Pull only what each pass needs — not whole files:

- **spec.md** → user stories + priorities, `FR-###`, `SC-###`, acceptance scenarios, edge cases,
  assumptions, out-of-scope list.
- **plan.md** → architecture decisions, Files-to-Change lanes, Constitution Check, Complexity
  Tracking rows, per-task `expected_gate`s.
- **tasks.md** → task IDs, `[P]` markers, `[US#]` story tags, `files:`, `ac_mapping`, gates.
- **constitution** → principle IDs + their MUST/MUST-NOT statements only.

---

## Detection passes

### A. Coverage gaps (the pass that justifies the skill)

- Every `FR-###` and every acceptance scenario has **≥1 task**. Zero tasks ⇒ **CRITICAL**.
- Every `SC-###` **that requires buildable work** (a performance budget, an audit hook, a load
  harness) has ≥1 task. Exclude post-launch outcome metrics and business KPIs — "reduce support
  tickets 50%" is not buildable and must not be reported as an uncovered requirement.
- Every task has **≥1 executable gate**. A task whose gate is an adjective ⇒ HIGH.
- Every story marked P1 is fully covered before any P2 task exists ⇒ otherwise MEDIUM (priority
  inversion: the MVP is not the first thing that gets built).

### B. Unmapped tasks — scope creep, structurally detected

A task with **no `ac_mapping` to any FR/SC/scenario** is either missing traceability or is work
nobody asked for. Report every one; HIGH by default. This is drift-guard Q1 applied to the whole
plan at once instead of one diff at a time, and it is the only pass that catches gold-plating
*before* it is written.

### C. Ambiguity

- Vague adjectives standing in for criteria: fast, scalable, secure, intuitive, robust, seamless,
  performant — HIGH when they appear in an `FR`/`SC`/gate, MEDIUM elsewhere.
- Unresolved placeholders: `TODO`, `TBD`, `???`, `[NEEDS CLARIFICATION`, `<placeholder>` — CRITICAL
  in `spec.md` (refinement should have closed it), HIGH in `plan.md`.
- An `SC-###` with no number, unit, or observable threshold ⇒ HIGH.

### D. Underspecification

- A requirement with a verb but no object or measurable outcome.
- A user story with no **Independent Test** line (it cannot be checkpointed).
- A task referencing a file, module, or component that appears nowhere in the plan's Files-to-Change.

### E. Constitution alignment

- Any plan decision conflicting with a MUST principle ⇒ CRITICAL (ratified) / HIGH (draft).
- A Phase -1 gate marked 🔴 in the plan with **no Complexity Tracking row**, or a row with an empty
  "simpler alternative rejected because" column ⇒ CRITICAL.

### F. Inconsistency

- Terminology drift: the same concept named differently across spec/plan/tasks (`lastLogin` vs
  `last_seen_at` vs "last activity") ⇒ MEDIUM, and HIGH when it appears in a contract or a gate.
- An entity in the plan that is absent from the spec, or vice versa.
- Conflicting requirements (two FRs demanding incompatible behavior) ⇒ CRITICAL.
- Ordering contradictions: a task that consumes an artifact produced by a later-phase task with no
  dependency note.

### G. Territory + parallelism defects (orchestration only — this is what makes disjointness provable)

Derive lane ownership from the union of each lane's task `files:` and check mechanically:

- A file claimed by **two lanes** ⇒ **CRITICAL** (the AC-4 abort condition, caught before worktrees
  exist rather than at allocation).
- A file in the plan's Files-to-Change owned by **no** lane ⇒ CRITICAL (it will be edited by whoever
  trips over it).
- Two tasks marked `[P]` **inside the same lane** that share a file ⇒ HIGH (they are not parallel).
- A lane with **zero** tasks ⇒ HIGH (an activated specialist with nothing to do — the idle-teammate
  failure, detected before it burns a session).

### H. Contract coverage (orchestration only)

- Every cross-lane symbol a consumer task imports exists in the **frozen contract set**
  (`contracts/`) ⇒ absent means the lanes will not compile together; **CRITICAL**.
- Every frozen contract has a **contract test** that currently fails ⇒ absent means
  `G-INTEGRATION-FIRST` is unmet; CRITICAL when the constitution is ratified, HIGH otherwise.
- A contract with no consumer ⇒ MEDIUM (speculative interface — G-SIMPLICITY smell).

---

## Severity

| Severity | Meaning | Effect |
|---|---|---|
| **CRITICAL** | ratified-constitution MUST violation · a requirement with zero coverage · territory overlap · missing contract · conflicting requirements · unresolved placeholder in the spec | **blocks fan-out** |
| **HIGH** | duplicate/ambiguous requirement · unmapped task · untestable gate · idle lane | fix before fan-out unless explicitly accepted with a reason |
| **MEDIUM** | terminology drift · priority inversion · missing non-functional coverage | recorded; may proceed |
| **LOW** | wording, redundancy that changes no execution order | recorded |

Cap the findings table at **50 rows**; summarize the remainder in an overflow line with counts by
category. Deterministic IDs — re-running an unchanged chain produces the same IDs and the same counts.

---

## Output (report only — no writes)

```markdown
## Spec analysis — {slug} @ {plan sha or date}

| ID | Category | Severity | Location | Summary | Recommendation |
|----|----------|----------|----------|---------|----------------|
| A1 | Coverage | CRITICAL | spec.md FR-004 | no task implements the retention rule | add a task in the core lane, gate `npm run test:run -- retention` |

### Coverage matrix

| Requirement | Story | Tasks | Gate | Lane | Covered |
|---|---|---|---|---|---|
| FR-001 | US1 (P1) | T003, T007 | `npm run test:run -- login` | backend | ✅ |
| SC-002 | — | — | — | — | 🔴 buildable, uncovered |

### Territory proof

| Lane | Files (from task `files:`) | Overlaps |
|---|---|---|
| backend | src/auth/**, src/session/** | none |

### Metrics
requirements={n} · buildable SC={n} · tasks={n} · coverage={n}% · unmapped tasks={n} ·
ambiguities={n} · duplicates={n} · CRITICAL={n} · territory overlaps={n}

### Verdict
{✅ PROCEED | 🔴 BLOCKED — {n} CRITICAL}
```

## Verdict routing (who fixes what — fix it at the source, never downstream)

| Defect class | Owner phase | Action |
|---|---|---|
| requirement missing/ambiguous/conflicting | **Phase R** (`refinement`) | re-open the clarify loop; re-run the DoR |
| design decision, constitution gate, complexity row | **Phase 0** (`prp-plan`) | amend the plan |
| coverage gap, unmapped task, gate quality | **Phase 1** (`project-manager`) | amend the contract/tasks |
| territory overlap, idle lane | **Phase 1** (`project-manager`) | re-partition the map |
| missing contract or contract test | **Phase 1.5** (contract freeze) | freeze the interface first |

Patching the symptom in the downstream artifact — adding a task to satisfy a coverage check while the
spec stays ambiguous — is the failure this routing table exists to prevent.

**Bounded:** at most **3** analyze→fix→re-analyze cycles. Still CRITICAL after 3 ⇒ STOP and surface
the survivors to the human. Do not fan out "and let the round loop sort it out".

## Invariants (silent unless failed)

- [ ] No file was modified.
- [ ] The analyzer did not author any artifact it graded.
- [ ] Every required artifact was present; no coverage % computed from a partial chain.
- [ ] Coverage matrix lists **every** FR/SC/scenario, including the uncovered ones.
- [ ] CRITICAL > 0 ⇒ no fan-out, no worktrees, no code.
- [ ] Buildable-vs-outcome SC split applied (business KPIs not reported as uncovered work).

## Dependencies

Reads `constitution` (authority), `../mediator/references/rules-rubric.md` (MUST/SHOULD vocabulary),
`orchestration-state.json` (territory + contract state). Feeds `mediator` Phase A2 and `drift-guard`
(Q1/Q7 at plan scope). Its findings are session-memory material: a repeat defect becomes a
`## General Rules (distilled)` entry.
