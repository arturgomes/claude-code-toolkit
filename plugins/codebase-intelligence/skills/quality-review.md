---
name: quality-review
description: >
  Comprehensive code quality review covering function quality, test quality, and best practices.
  Acts as a skeptical senior software engineer to catch violations before merge. Use after
  major changes, before committing, or when asked "review my code", "check quality", "run QCHECK",
  or automatically after prp-implement tasks. Runs Function Quality Checklist, Test Quality Checklist,
  and Implementation Best Practices checks. Produces structured feedback with file:line references.
user-invocable: true
---

# quality-review

**Role**: You are a SKEPTICAL senior software engineer conducting a comprehensive code review.

Run all quality checklists (Function Quality, Test Quality, Best Practices) to catch violations before code is merged.

---

## The Six Quality Checks

Run these checks in order for every major change:

### 1. RUN FUNCTION QUALITY CHECKLIST
For every function added or significantly modified:
- Run the complete 20-item Function Quality Checklist (see `function-quality` skill)
- Check: Readability, Complexity, Design, Type Safety, Testability, DRY, Naming

**Output**: Per-function score (X/20) with specific violations

---

### 2. RUN TEST QUALITY CHECKLIST
For every test file added or significantly modified:
- Run the complete 16-item Test Quality Checklist (see `test-quality` skill)
- Check: Test Structure, Test Quality, Coverage, Property Testing, Integration

**Output**: Per-test-file score (X/16) with specific violations

---

### 3. VERIFY IMPLEMENTATION BEST PRACTICES
Check against CLAUDE.md standards:
- [ ] Early returns used to reduce nesting
- [ ] No deep nesting (max 3 levels)
- [ ] DRY principle followed (no code duplication)
- [ ] Branded types used for IDs
- [ ] Type aliases preferred over interfaces (unless merging needed)
- [ ] Comments only for non-obvious logic, not obvious code
- [ ] Strong assertions in tests (not weak `toBeTruthy`)
- [ ] Tests have meaningful descriptions matching what they verify

**Output**: List of violations with file:line references

---

### 4. CHECK FOR DRY VIOLATIONS
Scan for duplicated logic:
- Identical or near-identical code blocks across files
- Repeated validation logic
- Repeated transformation logic
- Copy-pasted functions

**Output**: List of duplication sites with recommendation to extract

---

### 5. CHECK FOR UNNECESSARY NESTING
Scan for deep control flow:
- Functions with nesting depth > 3
- Nested if-else chains
- Missing guard clauses
- Opportunities to use early returns

**Output**: List of nested code blocks with refactor suggestions

---

### 6. VERIFY EARLY RETURNS USED APPROPRIATELY
Check control flow patterns:
- Guard clauses at function start
- Error conditions return early
- No else-after-return
- Flat structure preferred

**Output**: List of functions that could use early returns

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

## Function Quality Results

### File: `path/to/file.ts`

#### Function: `functionName` (line X)
**Score**: [X/20]

**Violations**:
- 🔴 [Check #N]: [Specific issue] — [Fix recommendation]
- 🟡 [Check #N]: [Specific issue] — [Discuss]

**Aligned**:
- 🟢 [Check #N]: [What's done well]

---

## Test Quality Results

### File: `path/to/file.test.ts`
**Score**: [X/16]

**Violations**:
- 🔴 [Check #N]: [Specific issue] — [Fix recommendation]

---

## Best Practices Violations

- 🔴 **Deep nesting** (`file.ts:42`): Function has 4 levels of nesting. Extract to flat structure.
- 🔴 **DRY violation** (`fileA.ts:10`, `fileB.ts:25`): Identical validation logic. Extract to shared function.
- 🟡 **Type alias** (`types.ts:5`): Uses `interface` instead of `type`. Consider `type` unless merging needed.

---

## Critical Issues (Must Fix)

[List all 🔴 violations that MUST be fixed before merge]

---

## Recommendations

[List all 💡 suggestions for improvement]

---

## Approval Status

- [ ] **APPROVED** — All checks pass, ready to merge
- [ ] **NEEDS WORK** — Fix critical issues above
- [ ] **BLOCKED** — Major quality violations, do not merge

**Next Step**: [What to do next]
```
