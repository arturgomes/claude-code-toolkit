---
name: drift-guard
description: >
  Anchors every planning and implementation decision to the original AC via seven drift questions.
  Auto-invoked at every phase gate; invoke manually on "am I drifting?", "is this in scope?", or when a task exceeds expected complexity.
version: 2.0.1
---

# drift-guard

**One job**: keep every decision tethered to the original requirement and acceptance criteria.

Drift causes: nearby "quick improvements", architectural rabbit holes, over-generalised solutions, research-introduced scope, scope-bleeding refactors.

## Model capability (read first)

This skill is model-agnostic. Read `CI_MODEL_TIER` (values: `frontier` | `standard` | `light`; default `standard` when unset or unknown).
- `frontier`: treat numbered sub-steps as intent; skip redundant per-step narration.
- `standard` / `light`: follow every numbered step verbatim.
Invariants are mandatory at EVERY tier and never skipped: executable gates, the AC anchor, drift checks, write-before-stop, the independent blind verifier, and blast-radius routing.

---

## The Anchor Document

At the start of every planning or implementation session, establish the anchor:

```markdown
## TASK ANCHOR
Ticket:     {JIRA-TICKET}
Summary:    {one-line task description}
Type:       {NEW_CAPABILITY | BUG_FIX | ENHANCEMENT | REFACTOR}

Acceptance Criteria:
  1. {AC item 1 — verbatim from Jira or plan}
  2. {AC item 2}
  3. {AC item N}

Hard boundaries (NOT in scope):
  - {explicit exclusion from plan's "NOT Building" section}

This anchor is FIXED. It does not change unless the user explicitly updates the Jira ticket
or replaces the acceptance criteria in this session.
```

Append this anchor to the session-memory vault file using the session-memory skill
(`mcp__ultimate-obsidian__create_or_update_note(mode: 'append')`) and re-state it at every
phase gate.

---

## Drift Check Protocol

Run this check **automatically** at:
- End of prp-plan Phase 2 (before generating the plan)
- Before each task in prp-implement Phase 3
- Whenever a new idea or addition is introduced
- When a task runs significantly over expected complexity

## Mechanical checks (run FIRST)

Before you touch the seven judgment questions, run a deterministic gate. This is an
executable predicate, not a matter of opinion — it either matches or it does not.

1. **Derive the forbidden-path glob from the anchor.** Read the TASK ANCHOR's
   `Hard boundaries (NOT in scope)` block (the plan's "NOT Building" section). Turn each
   excluded area into a path glob. Example: an exclusion of "billing service" and
   "auth middleware" yields the pattern `src/billing/*` and `src/middleware/auth/*`.
   Persist the derived globs so the check is reproducible.

2. **Run `git diff --name-only` against the forbidden glob.** Any changed file matching a
   forbidden glob is a deterministic 🔴 — no judgment call, no "but it was harmless":

   ```bash
   # forbidden_glob is derived from the anchor Boundaries / NOT-Building section
   git diff --name-only | grep -E "$FORBIDDEN_GLOB_REGEX" && echo "🔴 DRIFT: touched forbidden path"
   ```

   If any line prints, the verdict is 🔴 DRIFTING immediately. STOP and re-anchor before
   running the seven questions — a boundary violation is drift regardless of how the seven
   judgment questions would score.

**Evidence discipline (evidence phase):** run this mechanical gate and collect its
`file:line` evidence BEFORE forming any interpretation — evidence collected under a
conclusion is contaminated — collect file:line evidence before interpreting. Record the
`git diff --name-only` output verbatim first, then judge.

Fallback: if no `Hard boundaries` / "NOT Building" section exists in the anchor, this gate
is a no-op (nothing to forbid) and you proceed directly to the seven questions — but note
in the log that no forbidden-path glob was available.

### The Seven Drift Questions

For the work being done right now, answer each question honestly:

```
1. REQUIREMENT TRACE
   "Does this directly serve one of the acceptance criteria?"
   → If NO: stop and justify, or remove it

2. SCOPE BOUNDARY
   "Is this change inside the files/systems identified in the plan?"
   → If touching unexpected files: flag as potential drift

3. COMPLEXITY BUDGET
   "Is this more complex than the problem warrants?"
   → If yes: simplify before proceeding

4. GOLD-PLATE CHECK
   "Am I making this more general/flexible/elegant than the task requires?"
   → If yes: defer to a future task, do not include now

5. RESEARCH DRIFT
   "Did the external research introduce requirements not in the original ticket?"
   → If yes: note as 'Future consideration', do not include now

6. ARCHITECTURAL DRIFT
   "Am I making architectural decisions beyond what this task needs?"
   → If yes: scope back to the minimum viable architecture

7. AC COVERAGE
   "Which acceptance criteria does NOT yet have a corresponding task?"
   → If any: add the missing task before adding anything else

8. PRIOR-FAILURE REPEAT
   "Does this repeat a documented prior failure?"
   → Check session-memory / the Loop Ledger for a recorded prior failure with the same
     shape. If yes: STOP — do not re-run the failing approach; apply the recorded fix or
     escalate.
```

> Note: a previously-verified AC is an invariant; breaking it is drift. If a change would
> regress an acceptance criterion already recorded under "## Verified Invariants", treat it
> as a 🔴 the same way a forbidden-path hit is — re-verified goals do not silently revert.

### Drift Verdict

After running the seven questions:

```
✅ ON TRACK   — All 7 pass. Continue.
⚠️  DRIFT RISK — 1-2 concerns. State them explicitly, get confirmation before continuing.
🔴 DRIFTING   — 3+ concerns. STOP. Re-anchor to the task before writing another line.
```

---

## Re-anchor Ritual

When drift is detected, do this before continuing:

```
1. Re-read the TASK ANCHOR (ticket, AC, boundaries)
2. State in one sentence: "The task requires X. I was doing Y."
3. Decide:
   a. Y is part of X → justify it explicitly and continue
   b. Y is not part of X → discard Y, resume X
   c. Y is valuable but separate → add to Jira as a follow-up ticket, not this task
4. Append the decision to session-memory under "### Drift decisions" via
   `mcp__ultimate-obsidian__create_or_update_note(mode: 'append')`
```

---

## Integration with prp-plan

- **Phase 2 EXPLORE** → run #1 + #5 against discovery table; drop files that don't trace to AC.
- **Phase 5 ARCHITECT** → run full 7 against the proposed Files-to-Change list. Every file must trace to ≥1 AC item.
- **Phase 6 GENERATE** → run #7. If any AC has no task, add it before saving the plan.

---

## Integration with prp-implement

- **Before each task (Phase 3.1)** → run #1 + #4: state which AC the task serves; confirm nothing extra. If no AC maps and the task isn't in Files-to-Change, skip and flag.
- **Mid-task** → if effort exceeds ~2× expected, stop and run the full 7. Complexity explosion is a drift leading indicator.

### Before any "while I'm here" change

Any thought that begins with:
- "While I'm here, I should also..."
- "This would be better if..."
- "I noticed this other thing..."
- "It would be cleaner to..."

**STOP**. Run drift check #4 (gold-plate) and #2 (scope boundary) before proceeding.
These phrases are the most common entry point for drift.

---

## Drift Log

Append to session-memory (Obsidian vault) whenever drift is detected and resolved.
Use `mcp__ultimate-obsidian__create_or_update_note(mode: 'append')` on the active
session file at `02-Notes/Sessions/{SUFFIX}.md`.

`{SUFFIX}` is the SAME suffix the invoking command derives — do NOT hardcode
`{TICKET}-{BRANCH}.md`. Consume the `{SUFFIX}` passed in by prp-plan / prp-implement so the
Drift Log lands in the same session file as every other note. Fallback when no ticket is
present: `{SUFFIX}` derives from the plan-stem (the plan filename without its `.plan.md`
extension), matching the command's own plan-stem fallback:

```markdown
### Drift decisions — Session <date>
- [timestamp] Drift detected: was going to {Y}. Reason: {seven-question trigger}.
  Decision: {discarded | deferred to follow-up | justified as part of AC N}.
```

---

## What drift-guard does NOT do

- Does not block legitimate discovery — if Phase 2 reveals more scope, update the plan.
- Does not enforce rigid plan adherence — documented deviations are fine.
- Does not replace engineering judgment — it's a checklist, not a constraint.

Goal: **intentional deviation**, not zero deviation.
