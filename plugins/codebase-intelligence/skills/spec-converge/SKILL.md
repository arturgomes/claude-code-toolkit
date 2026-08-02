---
name: spec-converge
description: >
  Append-only reconciliation of the merged code against the spec, run after the integration gate and
  before shutdown. Re-reads every FR/SC/acceptance scenario against what the branch actually
  implements and classifies each gap as missing | partial | contradicts | unrequested, appending the
  remaining work as traceable tasks. Converged means byte-for-byte unchanged tasks. Never edits code,
  never deletes anything, never rewrites an existing task. Auto-invoked by prp-orchestrate
  (Phase 5.75) and prp-implement (Step 4.7b, on the gated HEAD); invoke manually on
  "did we actually build the spec", "what's left", "converge this branch".
version: 1.0.0
---

# spec-converge — did we build the thing we specified?

Every gate before this one answers a *local* question. QA runs the contract's gates. `pr-reviewer`
reads a diff. `pre-pr-gate` proves the branch compiles, builds, tests, and obeys the rulebook.

None of them answers the one the ticket was opened for: **is every acceptance criterion actually
implemented, and is there code here nobody asked for?** A branch can be green on all of the above and
still be missing FR-004 entirely — because the task that owned it was dropped in a re-partition, and
no mechanical gate knows FR-004 exists.

This skill closes that loop, and it is the only place in the flow where **`unrequested` code** is
detected at the codebase level rather than one diff at a time.

## Model capability (read first)

Read `CI_MODEL_TIER` (`frontier | standard | light`, default `standard`). `frontier`: steps are
intent. `standard`/`light`: verbatim. Mandatory at every tier: **append-only**, the
**gap-type classification**, the **converged ⇒ byte-for-byte-unchanged** rule, and the **bounded pass
count**.

## Operating constraints

### Where the Convergence section is appended (resolve this FIRST)

There is not always a `tasks.md` — the repo copy is optional (`spec_artifacts: vault`,
`--no-repo-specs`, or a plain `prp-implement` run that only ever read the plan from the vault). Resolve
the append target in this order and **name the one you used** in the report:

1. `specs/<slug>/tasks.md` in the repo — when the dual-write produced it;
2. otherwise the **plan note's task section** in the vault (`02-Notes/Plans/<slug>.plan.md`), appended
   under the same `## Phase N: Convergence` heading;
3. neither exists ⇒ there is no task list to converge against. Report the findings and **stop** — do
   not invent a task file. A converge run with nowhere to write is a misconfiguration, not a pass.

Every rule below — append-only, byte-for-byte-unchanged when converged, never renumber — applies to
**whichever target resolved**, not to `tasks.md` specifically.

**APPEND-ONLY, NEVER REWRITE.** The only write is appending a `## Phase N: Convergence` section to
the resolved target. It MUST NOT:

- modify `spec.md` or `plan.md` in any way;
- rewrite, renumber, reorder, or delete any existing task — including tasks from a prior convergence;
- modify, create, or delete any application code. Completing the appended tasks is the round loop's
  job, not this skill's.

**When nothing is missing, the target is left byte-for-byte unchanged** — no empty Convergence
header, no "verified" stub. A no-op run must be invisible in the diff.

**This is not a diff tool.** It assesses the *present state of the code* against the artifacts. No
git history, no branch comparison, no "what changed". A requirement satisfied by code that predates
this ticket is satisfied.

**Prerequisite:** runs only after the round loop has implemented the current tasks and the integration
gate has a ✅ receipt on this HEAD. Converging a branch that never built produces a task list that is
just the plan again.

---

## Procedure

### 1. Build the intent inventory

One stable key per obligation, from the artifacts only:

- every `FR-###`, every buildable `SC-###`, every acceptance scenario (`US1/AC2`);
- every plan decision that imposes buildable work (a named migration, a contract, a data model);
- every ratified constitution MUST principle;
- every frozen contract in `contracts/` + its contract test.

Exclude post-launch outcome metrics and business KPIs — they are real success criteria and they are
not code, so they never become tasks.

### 2. Derive the code scope

From the file paths named in `plan.md` and `tasks.md`, plus a symbol/keyword search for each
requirement's concepts. **Bound the assessment to that scope.** Do not wander the repo: a converge
pass that "finds gaps" in code the spec never claimed is generating scope, not closing it.

### 3. Classify every gap

| Gap type | Meaning |
|---|---|
| **`missing`** | the required work is absent from the code entirely |
| **`partial`** | it exists but does not fully satisfy the requirement / scenario / plan decision |
| **`contradicts`** | the code does something that conflicts with stated intent or a MUST principle |
| **`unrequested`** | the code contains work no FR/SC/scenario/plan decision called for |

Each finding records: stable id · `source-ref` (the FR/SC/US-AC/principle it traces to) · gap-type ·
severity · evidence as `file:line`. **No finding without evidence** — "probably not implemented" is
not a finding, it is a note to go look.

`unrequested` is never deleted by this skill. It is surfaced with two possible tasks: *justify it*
(map it to a requirement, or record it as an accepted deviation) or *remove it*. Deleting code
someone wrote on the strength of a spec-reading is the one action here with real blast radius, and it
belongs to a human.

### 4. Severity

- **CRITICAL** — violates a ratified constitution MUST, or a `missing`/`contradicts` gap that blocks
  a **P1** story's baseline behavior.
- **HIGH** — `missing`/`partial` on a core FR or acceptance scenario.
- **MEDIUM** — `partial` on a secondary requirement; an `unrequested` addition with real blast radius
  (new dependency, new endpoint, new table).
- **LOW** — cosmetic `unrequested` additions; documentation gaps.

### 5. Resolve to one of exactly two outcomes

**Converged** — zero findings:

```
✅ Converged — the implementation satisfies the spec, plan, and tasks.
   requirements={n} · verified={n} · unrequested=0 · tasks.md unchanged
```

**Tasks appended** — findings exist. Append one traceable task per finding:

```markdown
## Phase {N}: Convergence

- [ ] T{next} [{US#|—}] [{gap-type}] {imperative action} — {file:line}
      source-ref: FR-004 · severity: HIGH · lane: backend
      expected_gate: `{executable command}`
```

Every appended task carries the same fields a plan task carries: a source-ref, an owning lane, and an
**executable gate**. A convergence task without a gate is a wish, and it will converge to nothing.

### 6. Route and re-run (bounded)

Appended tasks go back to the **owning lane's specialist** as next-round criteria — same routing the
integration gate uses. A gap spanning two lanes goes to `project-manager` as a contract or
territory-map defect, not to whichever lane happens to contain the file.

**Bounded at 3 passes.** Each pass must find **strictly fewer** findings than the last; if a pass
finds the same count or more, STOP and surface it — the loop is not converging and another round will
not fix it. After 3 passes, remaining findings go to the human with their evidence.

---

## Interaction with the rest of the flow

- Runs **after** `pre-pr-gate` ✅ and **before** shutdown. A 🔴 gate means there is nothing to
  converge yet.
- Its `unrequested` findings are drift-guard's Q4 (gold-plate) and Q5 (research drift) evaluated at
  branch scope — record each in session-memory `## Lessons` as a `symptom → rule` line.
- A `missing` finding that traces to a requirement `spec-analyze` reported as **covered** is a
  traceability bug, not just a gap: the coverage matrix lied. Record it in
  `## General Rules (distilled)` so the next run's analyze pass is read with that in mind.
- Repeat convergence gaps on the same requirement across runs are exactly the drift-guard Q8
  (prior-failure repeat) signal.

## Invariants (silent unless failed)

- [ ] No code was created, modified, or deleted.
- [ ] `spec.md` and `plan.md` untouched; no existing task rewritten, renumbered, or removed.
- [ ] Append target resolved and named in the report (repo `tasks.md` → vault plan note → stop).
- [ ] Converged ⇒ the target is byte-for-byte unchanged (verify, do not assume).
- [ ] Every finding carries a `source-ref`, a gap-type, and `file:line` evidence.
- [ ] Every appended task carries an executable gate and an owning lane.
- [ ] `unrequested` code was surfaced, never deleted.
- [ ] ≤3 passes, each strictly smaller than the last.

## Dependencies

Reads `spec.md` / `plan.md` / `tasks.md` (repo `specs/<slug>/`, mirrored in the vault),
`contracts/`, `constitution`, and the `pre-pr-gate` receipt. Writes only the Convergence section.
Feeds `mediator` Phase F and `session-memory`.
