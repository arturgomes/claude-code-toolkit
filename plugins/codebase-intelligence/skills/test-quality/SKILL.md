---
name: test-quality
description: >
  Run the 16-item Test Quality Checklist (structure, coverage, property testing, integration) on test files.
  Trigger after writing tests or on "review my tests", "run QCHECKT".
version: 2.0.1
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

**Output schema** (single test file):
- `# Test Quality Review`
- `## Test File: <file>` — score `[X/16]`
- `## Violations` — one entry per failing item: ID, issue, fix, before/after code (only if helpful)
- `## Strengths` — items the file passes well (include only if any)
- `## Coverage Gaps` (include only if gaps exist):
  - **Missing edge cases:** checklist of edges not tested (empty/null/boundary/error)
  - **Missing scenarios:** specific behaviour not covered
- `## Overall Assessment` — buckets (sum to 16): Test Structure /2, Test Quality /6, Coverage /4, Property Testing /2, Integration /2 — each with one-line assessment, then `**Total**: [X/16]`
- `**Verdict**: ✅ APPROVED | ⚠️ NEEDS WORK | ❌ REWRITE`

**Output schema** (multi-suite in one file):
- `# Test Quality Review: <file>`
- `## Summary` — N suites, total tests, average /16, N passing (≥14), N needing work (<14)
- One section per `describe(…)` suite — score, brief issue list (full schema only if score < 14)
- `## File-Level Recommendations` — recurring issues across suites (include only if any)
