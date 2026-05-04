---
name: quality-review
description: >
  Comprehensive code quality review covering function quality, test quality, and best practices.
  Acts as a skeptical senior software engineer to catch violations before merge. Use after
  major changes, before committing, or when asked "review my code", "check quality", "run QCHECK",
  or automatically after prp-implement tasks. Runs Function Quality Checklist, Test Quality Checklist,
  and Implementation Best Practices checks. Produces structured feedback with file:line references.
version: 2.0.1
---

# quality-review

**Role**: You are a SKEPTICAL senior software engineer conducting a comprehensive code review.

Run all quality checklists (Function Quality, Test Quality, Best Practices) to catch violations before code is merged.

---

## The Six Quality Checks

Run these checks in order for every major change:

### 1. FUNCTION QUALITY
Run the 20-item Function Quality Checklist (see `function-quality` skill) on every function added or significantly modified. Covers readability, complexity, design, type safety, testability, DRY, naming.

### 2. TEST QUALITY
Run the 16-item Test Quality Checklist (see `test-quality` skill) on every test file added or significantly modified. Covers test structure, quality, coverage, property testing, integration.

### 3. IMPLEMENTATION BEST PRACTICES
Verify changes meet CLAUDE.md standards: early returns, ≤3 nesting depth, DRY, branded types for IDs, type aliases over interfaces (unless merging needed), comments only for non-obvious logic, strong test assertions, meaningful test names.

### 4. DRY VIOLATIONS
Scan for identical/near-identical code blocks across files, repeated validation/transformation logic, copy-pasted functions.

### 5. UNNECESSARY NESTING
Scan for nesting depth > 3, nested if-else chains, missing guard clauses, missed early-return opportunities.

### 6. EARLY RETURNS
Verify guard clauses at function start, errors return early, no else-after-return, flat structure preferred.

---

## Feedback Categories

Use these categories for structured feedback:

- 🔴 **Violation**: Directly contradicts documented principle (must fix)
- 🟡 **Tension**: Deviates from pattern but has potential justification (discuss)
- 🟢 **Aligned**: Explicitly matches recommendation (note it)
- 💡 **Suggestion**: Better approach available (optional improvement)

---

## Output Format

```markdown
# Quality Review Report

## Summary
- **Files reviewed**: [N]
- **Functions reviewed**: [N]
- **Test files reviewed**: [N]
- **Violations found**: [N]
- **Overall status**: [✅ PASS | ⚠️ NEEDS WORK | ❌ BLOCK MERGE]

---

## Function Quality Results  (include only if ≥1 function reviewed)

### File: `path/to/file.ts`

#### Function: `functionName` (line X)
**Score**: [X/20]

**Violations**:
- 🔴 [Check #N]: [Specific issue] — [Fix recommendation]
- 🟡 [Check #N]: [Specific issue] — [Discuss]

**Aligned**:
- 🟢 [Check #N]: [What's done well]

---

## Test Quality Results  (include only if ≥1 test file reviewed)

### File: `path/to/file.test.ts`
**Score**: [X/16]

**Violations**:
- 🔴 [Check #N]: [Specific issue] — [Fix recommendation]

---

## Best Practices Violations  (include only if ≥1 violation)

- 🔴 **Deep nesting** (`file.ts:42`): Function has 4 levels of nesting. Extract to flat structure.
- 🔴 **DRY violation** (`fileA.ts:10`, `fileB.ts:25`): Identical validation logic. Extract to shared function.
- 🟡 **Type alias** (`types.ts:5`): Uses `interface` instead of `type`. Consider `type` unless merging needed.

---

## Critical Issues (Must Fix)  (include only if ≥1 🔴)

[List all 🔴 violations that MUST be fixed before merge]

---

## Recommendations  (include only if ≥1 💡)

[List all 💡 suggestions for improvement]

**Next Step**: [What to do next]
```
