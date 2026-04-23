---
name: technical-plan
description: >
  Validate technical plans against codebase patterns to ensure consistency, minimal changes,
  code reuse, DRY principles, and early returns. Use when reviewing implementation plans,
  design documents, or before starting implementation. Triggers on "review my plan",
  "validate this approach", "check plan consistency", "does this follow our patterns?",
  or automatically after prp-plan Phase 4 (DESIGN). Prevents architectural drift by ensuring
  plans leverage existing patterns rather than introducing new abstractions unnecessarily.
version: 2.0.0
---

# technical-plan

**Role**: You are a TECHNICAL ARCHITECT reviewing implementation plans.

Ensure every plan is consistent with existing codebase patterns, introduces minimal changes, reuses existing utilities, follows DRY principles, and uses early returns for flat control flow.

---

## The Five Validation Questions

For every plan, answer these questions in order. Each question gates the next.

### 1. PATTERN CONSISTENCY
**Question**: Does this plan use patterns that already exist in the codebase?

**Check**:
- Search for similar features/modules already implemented
- Identify existing patterns for: error handling, data validation, state management, API design
- Compare plan's approach with existing implementations

**Verdict**:
- ✅ **IF YES**: Plan reuses existing patterns → Continue to Question 2
- ❌ **IF NO**: Plan introduces new patterns not in codebase → **Flag for review**

**Output**:
```
### Pattern Consistency: [✅ PASS | ❌ FAIL]

**Existing patterns found**:
- [Pattern 1]: Used in [file:line reference]
- [Pattern 2]: Used in [file:line reference]

**Plan's approach**:
- [How the plan matches or differs from existing patterns]

**Recommendation**:
[If FAIL: Suggest using existing patterns instead of new ones]
[If PASS: List which patterns the plan correctly reuses]
```

---

### 2. MINIMAL CHANGES
**Question**: Does this plan introduce the minimum set of changes needed to satisfy requirements?

**Check**:
- Count files to create vs files to modify
- Identify if plan adds unnecessary features beyond requirements
- Check if plan refactors code not directly related to the feature

**Verdict**:
- ✅ **IF YES**: Plan changes only what's required → Continue to Question 3
- ⚠️ **IF NO**: Plan includes extra changes (refactors, cleanups, "while I'm here" additions) → **Trim to essentials**

**Output**:
```
### Minimal Changes: [✅ PASS | ⚠️ NEEDS TRIMMING]

**Files to change**: [N files]
- CREATE: [list]
- UPDATE: [list]

**Unnecessary changes detected**:
[If any: list changes not required by acceptance criteria]

**Recommendation**:
[If FAIL: Specify which changes to remove]
[If PASS: Confirm plan is minimal]
```

---

### 3. CODE REUSE
**Question**: Does this plan reuse existing utilities and helpers instead of reimplementing logic?

**Check**:
- Search codebase for existing functions that solve similar problems
- Identify utilities in `packages/shared` or common modules
- Check if plan reinvents functionality that exists elsewhere

**Verdict**:
- ✅ **IF YES**: Plan reuses existing utilities → Continue to Question 4
- ❌ **IF NO**: Plan reimplements logic that exists → **Point to existing utilities**

**Output**:
```
### Code Reuse: [✅ PASS | ❌ FAIL]

**Existing utilities to reuse**:
- [Utility 1]: `path/to/file.ts:line` (does [what])
- [Utility 2]: `path/to/file.ts:line` (does [what])

**Plan's approach**:
[How plan uses or fails to use existing utilities]

**Recommendation**:
[If FAIL: List utilities to use instead of reimplementing]
[If PASS: Confirm plan correctly reuses existing code]
```

---

### 4. DRY PRINCIPLES
**Question**: Does this plan avoid code duplication? Are repeated patterns extracted?

**Check**:
- Identify if plan copies similar logic across multiple files
- Check if plan extracts shared logic into reusable functions
- Verify plan doesn't duplicate validation, transformation, or business logic

**Verdict**:
- ✅ **IF YES**: Plan follows DRY → Continue to Question 5
- ❌ **IF NO**: Plan duplicates logic → **Extract into shared functions**

**Output**:
```
### DRY Principles: [✅ PASS | ❌ FAIL]

**Potential duplication detected**:
[If any: describe repeated logic across files]

**Extraction opportunities**:
[If FAIL: Suggest shared functions to create]

**Recommendation**:
[If FAIL: Specify what to extract and where to put it]
[If PASS: Confirm no duplication found]
```

---

### 5. EARLY RETURNS & FLAT STRUCTURE
**Question**: Does the plan use early returns to reduce nesting depth?

**Check**:
- Review pseudocode or control flow in plan
- Identify nested if-else chains or deep conditionals
- Check if plan uses guard clauses at function start

**Verdict**:
- ✅ **IF YES**: Plan uses early returns → **VALIDATION COMPLETE**
- ❌ **IF NO**: Plan has deep nesting → **Refactor to use early returns**

**Output**:
```
### Early Returns & Flat Structure: [✅ PASS | ❌ FAIL]

**Control flow analysis**:
[Describe plan's approach to conditionals and error handling]

**Nesting issues**:
[If any: point to deeply nested logic in plan]

**Recommendation**:
[If FAIL: Show how to refactor with early returns]
[If PASS: Confirm flat structure]
```

---

## Final Validation Report

After running all five questions, produce a summary:

```markdown
# Technical Plan Validation Report

## Plan: [Plan title or file path]

---

## Summary
[1-2 sentence overall assessment: "This plan is ready for implementation" or "This plan needs revisions before implementation"]

---

## Validation Results

| Question | Status | Details |
|----------|--------|---------|
| Pattern Consistency | ✅/❌ | [Brief summary] |
| Minimal Changes | ✅/⚠️ | [Brief summary] |
| Code Reuse | ✅/❌ | [Brief summary] |
| DRY Principles | ✅/❌ | [Brief summary] |
| Early Returns | ✅/❌ | [Brief summary] |

**Overall Score**: [X/5 checks passed]

---

## Critical Issues (Must Fix Before Implementation)

[If any ❌ verdicts: list them with specific fixes]

---

## Warnings (Review Before Implementation)

[If any ⚠️ verdicts: list them with rationale]

---

## Existing Patterns to Follow

[List key patterns found in codebase that the plan should leverage]

**Example**:
- **Service pattern**: `packages/api/src/publisher/twitter-service.ts:10` — use this structure for new integrations
- **Validation pattern**: `packages/shared/validation.ts:25` — reuse `validatePostContent` for all social posts

---

## Recommendations

[Prioritized list of changes to make the plan more consistent]

1. [Highest priority recommendation]
2. [Next recommendation]
3. [...]

---

## Approval Status

- [ ] **APPROVED** — Plan is consistent with codebase patterns, ready for implementation
- [ ] **NEEDS REVISION** — Address critical issues above before implementing
- [ ] **NEEDS DISCUSSION** — Plan diverges significantly from patterns; justify deviations

**Next Step**: [What to do next]
```
