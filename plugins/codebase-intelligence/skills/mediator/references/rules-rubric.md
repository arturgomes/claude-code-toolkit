# Mediator Rules Rubric — per-round verdict on a specialist diff

The mediator loads this rubric each round and grades **every active specialist's diff**
against (a) the target repo's `.claude/` + `CLAUDE.md` rules and (b) drift-guard's 8
questions. Output is a single verdict per specialist plus, on failure, **actionable criteria**
returned to that specialist (an adversarial evaluator returns a rubric, never vibes — KB:
`claude-code` / Harness Patterns P06, Adversarial-Evaluator checklist).

The verdict is **advisory input to the merge gate**: a 🔴 verdict **blocks the merge** of that
specialist's worktree (AC-2).

---

## Step 1 — Parse the target repo rules (per round, cached)

Read the target repo's rule sources, in precedence order:

1. `<repo>/CLAUDE.md` and any `<repo>/.claude/*.md` behavioral contracts.
2. The active preset's `rule_emphases` for this role (e.g. core-db-specialist ⇒ D-1/D-3 transactions).

Classify every rule line by its modal verb into one of four buckets:

| Bucket | Modal | Severity | Verdict effect |
|---|---|---|---|
| **MUST** | must / shall / always / required | blocking | violation ⇒ 🔴 (blocks merge) |
| **MUST NOT** | must not / never / forbidden / do not | blocking | violation ⇒ 🔴 (blocks merge) |
| **SHOULD** | should / prefer / recommended | advisory | violation ⇒ ⚠️ |
| **SHOULD NOT** | should not / avoid / discouraged | advisory | violation ⇒ ⚠️ |

Rules whose modal verb is ambiguous default to **SHOULD** (advisory), never MUST — do not
manufacture a blocking rule the repo did not clearly state.

---

## Step 2 — drift-guard 8 questions (mechanical pre-scan first)

Run drift-guard against the specialist's diff **before** the rules pass:

- **Mechanical pre-scan:** the forbidden-path glob (from the goal's Boundaries / this specialist's
  territory) vs `git -C <worktree> diff --name-only`. Any file **outside this specialist's own
  territory** is a deterministic 🔴 (a territory breach = the exact failure AC-4 exists to prevent).
- Then the 8 questions:
  1. REQUIREMENT TRACE — does each changed file serve a contract criterion / AC?
  2. SCOPE BOUNDARY — inside this specialist's territory only?
  3. COMPLEXITY BUDGET — more complex than the criterion warrants?
  4. GOLD-PLATE — more general/flexible than the criterion requires?
  5. RESEARCH DRIFT — introduced scope not in the goal?
  6. ARCHITECTURAL DRIFT — architectural decisions beyond this criterion?
  7. AC COVERAGE — which assigned criterion still has no diff?
  8. INCIDENT REPEAT — repeats a documented prior failure (session-memory / Loop Constraints)?

Drift tally maps to the base verdict: 0 fails ⇒ ✅ · 1–2 ⇒ ⚠️ · 3+ ⇒ 🔴.

---

## Step 3 — Combine into one verdict

The specialist's verdict is the **most severe** of {drift base verdict, worst rule-bucket
violation}:

- Any **MUST / MUST NOT** violation **or** any **territory breach** ⇒ **🔴 DRIFTING** → `blocksMerge: true`.
- Else any **SHOULD / SHOULD NOT** violation, or drift tally 1–2 ⇒ **⚠️ DRIFT RISK** → merge allowed, note recorded.
- Else ⇒ **✅ ON TRACK** → merge-eligible.

Red blast-radius change (auth / payments / deploy / db-migration) detected in the diff ⇒ record a
`humanGates` entry and STOP for a human regardless of verdict (AC-1) — never auto-merge a red action.

---

## Step 4 — Emit the verdict block (one per specialist, per round)

```
### Verdict — {role} — round {n}
Verdict: {✅ ON TRACK | ⚠️ DRIFT RISK | 🔴 DRIFTING}
Territory: {clean | BREACH: <files outside territory>}
Rule violations:
  - [{MUST|MUST NOT|SHOULD|SHOULD NOT}] {rule}  — evidence: {file:line}
Drift: {N}/8 fail ({which})
Blocks merge: {yes|no}
Actionable criteria (only if not ✅):
  1. {concrete, testable fix the specialist must make}
```

Write the same content into `rounds[].verdicts[]` of `orchestration-state.json` (the durable
record). The **actionable criteria** string is the contract the specialist must satisfy next
round — re-grade against it, not against a fresh interpretation.

---

## Invariants (never relaxed)

- A verdict is grounded in **evidence** (`file:line` / diff hunk), never an adjective.
- The mediator **never grades its own work** and never lets a specialist self-grade — grading is
  a separate context (generator ≠ evaluator; KB: Harness Patterns P06).
- 🔴 always blocks merge; ⚠️ never blocks but is always recorded; ✅ is the only merge-eligible state.
- A previously green contract criterion that a later diff breaks is a **regression** = automatic 🔴.
