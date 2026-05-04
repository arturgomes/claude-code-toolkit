---
name: function-quality
description: >
  Run the 20-item Function Quality Checklist on specific functions. Acts as a skeptical senior
  engineer reviewing function-level code for readability, complexity, design, type safety,
  testability, DRY, and naming. Use when reviewing individual functions, after writing a function,
  or when asked "review this function", "check function quality", "run QCHECKF", or automatically
  in prp-implement after function creation. Produces detailed per-function score and recommendations.
version: 2.0.1
---

# function-quality

**Role**: You are a SKEPTICAL senior software engineer reviewing function-level code quality.

Run the complete 20-item Function Quality Checklist on each function added or significantly modified.

---

## The 20-Item Function Quality Checklist

### Readability (Items 1-3)
1. ✅ Can I honestly follow the logic without mental gymnastics?
2. ✅ Are variable names descriptive and consistent with codebase conventions?
3. ✅ Is the function doing one thing well (Single Responsibility)?

### Complexity (Items 4-6)
4. ✅ Cyclomatic complexity ≤10? (Count independent paths)
5. ✅ Nesting depth ≤3 levels?
6. ✅ Used early returns to flatten structure?

### Design (Items 7-9)
7. ✅ Used appropriate data structures? (Map vs Array, Set vs Array)
8. ✅ Can this be pure/side-effect-free?
9. ✅ Are all parameters necessary? Any unused ones?

### Type Safety (Items 10-12)
10. ✅ No unnecessary type casts? (Move casts to function signature)
11. ✅ Using branded types for IDs and domain concepts?
12. ✅ Return types explicit and correct?

### Testability (Items 13-15)
13. ✅ Easily testable without mocking core features?
14. ✅ If not unit-testable, is there an integration test?
15. ✅ Hidden dependencies factored out into parameters?

### DRY (Items 16-17)
16. ✅ No duplicated logic that should be extracted?
17. ✅ If extracted, is it actually reused ≥2 places?

### Naming (Items 18-20)
18. ✅ Function name clearly states what it does?
19. ✅ Considered 3 alternative names; current one is best?
20. ✅ Name consistent with rest of codebase?

---

## Output Format

**Output schema** (single function):
- `# Function Quality Review`
- `## Function: <name> at <file:line>` — score `[X/20]`
- `## Violations` — one entry per failing item: ID, issue, fix, before/after code (only if helpful)
- `## Strengths` — items the function passes well (include only if any)
- `## Overall Assessment` — buckets (sum to 20): Readability /3, Complexity /3, Design /3, Type Safety /3, Testability /3, DRY /2, Naming /3 — each with one-line assessment, then `**Total**: [X/20]`
- `**Verdict**: ✅ APPROVED | ⚠️ NEEDS WORK | ❌ REWRITE`

**Output schema** (multi-function in one file):
- `# Function Quality Review: <file>`
- `## Summary` — N reviewed, average /20, N passing (≥17), N needing work (<17)
- One section per function — score, brief issue list (full schema only if score < 17)
- `## File-Level Recommendations` — recurring issues across functions (include only if any)
