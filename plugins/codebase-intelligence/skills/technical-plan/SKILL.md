---
name: technical-plan
description: >
  Validate implementation plans against codebase patterns for code reuse, DRY, and minimal changes.
  Trigger on "review my plan", "validate this approach", "does this follow our patterns?".
version: 2.0.1
---

# technical-plan

Run the **5 validation questions** below in order against the plan.

**Per-question output shape:**
```
### {N}. {QUESTION TITLE}: [✅ PASS | ❌ FAIL | ⚠️ NEEDS TRIMMING]
- Evidence: <bullets with file:line refs where applicable>
- Recommendation: <if FAIL/NEEDS TRIMMING: specific fix; if PASS: confirm what's correct>
```

---

## 1. PATTERN CONSISTENCY
Does the plan reuse patterns already in the codebase (error handling, validation, state mgmt, API design)?

- ✅ if plan reuses existing patterns (cite file:line refs).
- ❌ if plan introduces new patterns not present elsewhere — flag for review.

## 2. MINIMAL CHANGES
Does the plan introduce only the changes needed to satisfy requirements?

- Count CREATE vs UPDATE files. Identify any "while I'm here" refactors / cleanups outside the AC.
- ✅ if plan is minimal.
- ⚠️ NEEDS TRIMMING if plan includes refactors not required by AC — list which to remove.

## 3. CODE REUSE
Does the plan reuse existing utilities/helpers instead of reimplementing?

- Search for existing functions solving similar problems (e.g., `packages/shared`).
- ✅ if plan reuses existing utilities (cite paths).
- ❌ if plan reimplements logic that exists — point to the existing utility.

## 4. DRY PRINCIPLES
Does the plan avoid duplicating logic across files?

- Identify repeated validation, transformation, business logic.
- ✅ if no duplication.
- ❌ if duplication — name what to extract and where.

## 5. EARLY RETURNS & FLAT STRUCTURE
Does the plan use guard clauses to keep nesting flat?

- Review pseudocode / control flow for nested if-else chains.
- ✅ if flat.
- ❌ if deeply nested — show how to refactor with early returns.

---

## Final Validation Report

```markdown
# Technical Plan Validation Report

## Plan: {title or path}

## Summary
{1–2 sentences: "ready for implementation" or "needs revisions before implementation"}

## Validation Results

| Question | Status | Details |
|---|---|---|
| 1. Pattern Consistency | ✅/❌ | {brief} |
| 2. Minimal Changes | ✅/⚠️ | {brief} |
| 3. Code Reuse | ✅/❌ | {brief} |
| 4. DRY Principles | ✅/❌ | {brief} |
| 5. Early Returns | ✅/❌ | {brief} |

**Overall**: {N}/5 passed

## Critical Issues (Must Fix)
{list ❌ verdicts with specific fixes — omit section if none}

## Warnings (Review Before Implementation)
{list ⚠️ verdicts with rationale — omit if none}

## Existing Patterns to Follow
{file:line refs the plan should leverage}

## Recommendations
{prioritized list}

**Next Step**: {what to do}
```
