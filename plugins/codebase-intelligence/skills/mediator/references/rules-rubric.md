# Mediator Rules Rubric — per-round verdict on a specialist diff

The mediator loads this rubric each round and grades **every active specialist's diff**
against (a) the target repo's rule sources — `CLAUDE.md`, `.claude/*.md`, **and the `.github/`
Copilot instructions (`.github/copilot-instructions.md` + `.github/instructions/*.instructions.md`,
each `applyTo`-scoped)** — and (b) drift-guard's 8 questions. Output is a single verdict per specialist plus, on failure, **actionable criteria**
returned to that specialist (an adversarial evaluator returns a rubric, never vibes — KB:
`claude-code` / Harness Patterns P06, Adversarial-Evaluator checklist).

The verdict is **advisory input to the merge gate**: a 🔴 verdict **blocks the merge** of that
specialist's worktree (AC-2).

---

## Step 1 — Parse the target repo rules (per round, cached)

Read **all** of the target repo's rule sources — do not stop at `.claude/`. Discover, in precedence
order (later sources refine earlier ones; a preset `rule_sources` list overrides this default set):

1. `<repo>/CLAUDE.md` and any `<repo>/.claude/*.md` behavioral contracts.
2. **`.github/` Copilot instructions** (a first-class rule source, not optional):
   - `<repo>/.github/copilot-instructions.md` — repo-wide guidelines.
   - `<repo>/.github/instructions/*.instructions.md` — scoped instruction files. Each has frontmatter
     with an **`applyTo` glob** (e.g. `applyTo: "**/*.{ts,tsx}"`) — **apply that file's rules ONLY to
     diff files matching its `applyTo` glob.** A React instruction file does not judge a SQL migration.
3. Any path listed in the active preset's `rule_sources` (if present) — lets a repo point at
   non-standard locations.
4. The active preset's `rule_emphases` for this role (e.g. core-db-specialist ⇒ D-1/D-3 transactions).

**Classify every rule** into one of four buckets — by modal verb **and** by checklist convention
(Copilot instruction files often use check IDs like `FQ-1` and imperative/▢-style lines rather than
"MUST/SHOULD"):

| Bucket | Signals | Severity | Verdict effect |
|---|---|---|---|
| **MUST** | must / shall / always / required; a hard numeric limit ("≤ 10", "must be typed") | blocking | violation ⇒ 🔴 (blocks merge) |
| **MUST NOT** | must not / never / forbidden / do not / disallowed | blocking | violation ⇒ 🔴 (blocks merge) |
| **SHOULD** | should / prefer / recommended; a plain checklist item (e.g. `FQ-2: names descriptive`) | advisory | violation ⇒ ⚠️ |
| **SHOULD NOT** | should not / avoid / discouraged | advisory | violation ⇒ ⚠️ |

- A **checklist item under a `.github/instructions` file** that carries no modal verb defaults to
  **SHOULD** (advisory) — cite it by its **check ID** (e.g. `FQ-4`) in the verdict evidence.
- Genuinely ambiguous lines default to **SHOULD**, never MUST — do not manufacture a blocking rule the
  repo did not clearly state.

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
