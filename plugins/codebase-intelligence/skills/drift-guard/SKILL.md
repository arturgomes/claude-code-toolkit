---
name: drift-guard
description: >
  Continuously anchors planning and implementation work to the original task requirements
  and acceptance criteria. Prevents scope creep, gold-plating, and architectural drift.
  Invoked automatically at every phase gate in prp-plan and prp-implement.
  Also invoke manually when something "feels off", when a task is taking longer than expected,
  when a new idea emerges mid-implementation, or when asked "am I drifting?", "is this in scope?",
  "should we also do X?", or "does this still match the requirement?".
  The skill's job is to be an honest, blunt mirror — not to block progress, but to ensure
  every decision traces back to the stated requirement.
version: 2.0.0
---

# drift-guard

**One job**: keep every decision tethered to the original requirement and acceptance criteria.

Drift is not always intentional. It happens when:
- A "quick improvement" is added because it's nearby
- An architectural curiosity becomes a rabbit hole
- The solution solves a more general problem than asked
- External research introduces scope not in the original task
- A refactor expands beyond the files the feature touches

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

Write this anchor to the first section of the active memory file and re-state it at every
phase gate.

---

## Drift Check Protocol

Run this check **automatically** at:
- End of prp-plan Phase 2 (before generating the plan)
- Before each task in prp-implement Phase 3
- Whenever a new idea or addition is introduced
- When a task runs significantly over expected complexity

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
```

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
4. Write the decision to memory under "### Drift decisions"
```

---

## Integration with prp-plan

### Injected at Phase 2 EXPLORE gate

Before finalising the discovery table, run drift check #1 and #5:
> "Do all the files I found actually need to change to satisfy the AC? Remove any that don't."

### Injected at Phase 5 ARCHITECT gate

Before writing the "Files to Change" table, run the full seven questions against the proposed
file list and approach. For every file listed, it must trace to at least one AC item.

### Injected at Phase 6 GENERATE gate

Before saving the plan file, run drift check #7:
> "Every AC item must have at least one task. Check now."

If any AC item has no corresponding task → add it before finishing the plan.

---

## Integration with prp-implement

### Before each task (Phase 3.1)

Run drift questions #1 and #4:
```
Before implementing task {N}:
  - Which AC does this serve? → {state it}
  - Am I about to add anything the AC doesn't ask for? → {yes/no}
```

If no AC maps to this task: pause and verify it's in the plan's "Files to Change" table.
If it's not → skip it and flag for review.

### Mid-task drift trigger

If implementing a task takes more than ~2x the expected effort (e.g., a "simple update" turns
into a refactor), stop and run the full seven questions. Complexity explosion is a leading
indicator of drift.

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

Append to task memory whenever drift is detected and resolved:

```markdown
### Drift decisions — Session <date>
- [timestamp] Drift detected: was going to {Y}. Reason: {seven-question trigger}.
  Decision: {discarded | deferred to follow-up | justified as part of AC N}.
```

---

## What drift-guard does NOT do

- It does not block legitimate discovery. If Phase 2 search reveals the task is larger than
  expected, that's information — update the plan, don't ignore it.
- It does not enforce rigid adherence when reality differs from the plan. Deviations are fine
  when documented with a rationale.
- It does not replace engineering judgment. It's a checklist, not a constraint.

The goal is **intentional deviation**, not zero deviation.
