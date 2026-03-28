---
name: test-quality
description: >
  Run the 16-item Test Quality Checklist on test files. Acts as a skeptical senior engineer
  reviewing test code for structure, quality, coverage, property testing, and integration.
  Use when reviewing test files, after writing tests, or when asked "review my tests",
  "check test quality", "run QCHECKT", or automatically in prp-implement after test creation.
  Produces detailed per-test-file score and recommendations.
user-invocable: true
---

# test-quality

**Role**: You are a SKEPTICAL senior software engineer reviewing test code quality.

Run the complete 16-item Test Quality Checklist on each test file added or significantly modified.

---

## The 16-Item Test Quality Checklist

### Test Structure (Items 1-2)
1. ✅ Tests grouped under `describe(functionName, …)`?
2. ✅ Each test has one clear purpose?

### Test Quality (Items 3-8)
3. ✅ Test name exactly matches what it verifies?
4. ✅ All inputs parameterized with named constants?
5. ✅ No magic numbers or strings (e.g., `42`, `"foo"`)?
6. ✅ Test can fail for real defects (not trivial assertions)?
7. ✅ Using strongest appropriate assertion?
8. ✅ Expected values computed independently (not reusing function output)?

### Coverage (Items 9-12)
9. ✅ Edge cases tested (empty, null, undefined, zero, max)?
10. ✅ Boundary values tested?
11. ✅ Unexpected inputs tested?
12. ✅ Error conditions tested?

### Property Testing (Items 13-14)
13. ✅ Considered property-based tests for invariants?
14. ✅ Using `expect.any(...)` for non-deterministic values?

### Integration (Items 15-16)
15. ✅ Not testing TypeScript-enforced constraints?
16. ✅ Follows same lint/type rules as prod code?

---

## Output Format

For each test file reviewed:

```markdown
# Test Quality Review

## Test File: `file.test.ts`

**Score**: [X/16]

---

## Violations

1. **Item #N**: [Check description]
   - **Issue**: [What's wrong]
   - **Fix**: [How to fix it]
   - **Example**:
     ```typescript
     // ❌ Before
     it('works', () => {
       expect(fn(42)).toBeTruthy();
     });

     // ✅ After
     it('returns sum when both inputs are positive', () => {
       const a = 5;
       const b = 3;
       expect(add(a, b)).toBe(8);
     });
     ```

2. **Item #N**: [Check description]
   - **Issue**: [What's wrong]
   - **Fix**: [How to fix it]

---

## Strengths

- **Item #N**: [What's done well]
- **Item #N**: [What's done well]

---

## Coverage Gaps

**Missing edge cases**:
- [ ] Empty inputs (e.g., `""`, `[]`, `null`)
- [ ] Boundary values (e.g., max length, zero, -1)
- [ ] Error conditions (e.g., invalid input, API failures)

**Missing scenarios**:
- [Specific scenario not covered]

---

## Overall Assessment

- **Test Structure**: [X/2] — [Brief assessment]
- **Test Quality**: [X/6] — [Brief assessment]
- **Coverage**: [X/4] — [Brief assessment]
- **Property Testing**: [X/2] — [Brief assessment]
- **Integration**: [X/2] — [Brief assessment]

**Total**: [X/16]

**Verdict**: [✅ APPROVED | ⚠️ NEEDS WORK | ❌ REWRITE]
```

---

## Multi-Test-Suite Review

When reviewing multiple test suites in one file:

```markdown
# Test Quality Review: `file.test.ts`

## Summary
- **Test suites reviewed**: [N]
- **Total tests**: [N]
- **Average score**: [X.X/16]
- **Suites passing (≥14/16)**: [N]
- **Suites needing work (<14/16)**: [N]

---

## Suite: `describe("functionA", ...)`
**Score**: [X/16]
**Tests**: [N]
**Issues**: [Brief list]

---

## Suite: `describe("functionB", ...)`
**Score**: [X/16]
**Tests**: [N]
**Issues**: [Brief list]

---

## File-Level Recommendations

1. [Recommendation affecting multiple test suites]
2. [Recommendation affecting multiple test suites]
```
