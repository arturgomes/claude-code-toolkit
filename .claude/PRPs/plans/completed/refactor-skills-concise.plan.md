# Feature: Refactor Skills to Be Concise and Token-Efficient

## Summary

The existing skills contain extensive documentation, examples, and explanatory text that inflate token usage. This plan refactors 7 skills (`product-spec`, `technical-plan`, `test-scenarios`, `quality-review`, `function-quality`, `test-quality`, `ship`) to retain only actionable, essential information while removing verbose explanations, redundant examples, and meta-commentary.

## User Story

As a developer using Claude Code skills
I want concise, practical skill instructions
So that token usage is minimized while maintaining full functionality

## Problem Statement

Current skills average 300-650 lines with extensive explanations, multiple examples, integration guides, anti-pattern lists, and meta-commentary about when/how to use them. This causes high token consumption and slower processing.

## Solution Statement

Strip each skill to its core: role statement, essential checklist/process, output format, and minimal examples. Remove all verbose sections like "When to Use", "What This Skill Does NOT Do", "Common Mistakes", "Integration with Workflows", and redundant examples.

## Metadata

| Field            | Value                                      |
| ---------------- | ------------------------------------------ |
| Type             | REFACTOR                                   |
| Complexity       | MEDIUM                                     |
| Systems Affected | plugins/codebase-intelligence/skills/      |
| Dependencies     | None                                       |
| Estimated Tasks  | 8                                          |

---

## UX Design

### Before State
```
Skill files: 300-650 lines
- Extensive "When to Use" sections (20-40 lines)
- Multiple examples for each concept (100+ lines)
- "Integration with Workflows" sections (30-50 lines)
- "What This Skill Does NOT Do" sections (20-30 lines)
- "Common Mistakes" sections (30-50 lines)
- Redundant anti-pattern examples

Token usage: HIGH (skills contribute 15-20% of context)
```

### After State
```
Skill files: 100-200 lines
- Brief role statement (2-3 lines)
- Core checklist/process only
- Minimal output format template
- ONE concise example maximum
- Zero meta-commentary

Token usage: REDUCED by 60-70%
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| All skills | 300-650 lines with examples | 100-200 lines, essential only | Faster processing, lower token cost |
| Skills context | 15-20% of total tokens | 5-8% of total tokens | More room for codebase context |

---

## NOT Building (Scope Limits)

- Not changing skill functionality or core logic
- Not modifying skill frontmatter (name, description, user-invocable)
- Not removing checklists themselves (only explanations around them)
- Not changing how skills are invoked or integrated
- Not touching other plugin files outside skills/

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `plugins/codebase-intelligence/skills/product-spec.md` | UPDATE | Remove verbose sections, keep 8-section structure |
| `plugins/codebase-intelligence/skills/technical-plan.md` | UPDATE | Keep 5 questions, remove examples and meta-text |
| `plugins/codebase-intelligence/skills/test-scenarios.md` | UPDATE | Keep 5 categories, remove redundant examples |
| `plugins/codebase-intelligence/skills/quality-review.md` | UPDATE | Keep 6 checks, remove verbose explanations |
| `plugins/codebase-intelligence/skills/function-quality.md` | UPDATE | Keep 20-item checklist, remove pattern examples |
| `plugins/codebase-intelligence/skills/test-quality.md` | UPDATE | Keep 16-item checklist, remove redundant text |
| `plugins/codebase-intelligence/skills/ship.md` | UPDATE | Already concise (71 lines), minimal changes |

---

## Step-by-Step Tasks

### Task 1: UPDATE `product-spec.md` (650 → 200 lines)

**ACTION**: Remove verbose sections while preserving 8-section structure

**SECTIONS TO REMOVE**:
- Lines 20-31: "When to Use This Skill" (triggers covered in frontmatter)
- Lines 167-191: "Quality Checklist" (redundant with output structure)
- Lines 193-212: "Integration with Workflows" (not actionable)
- Lines 214-220: "Tone and Style" (obvious from examples)
- Lines 222-281: "Example PRD Structure" (redundant, one example at end is enough)
- Lines 283-290: "What This Skill Does NOT Do" (meta-commentary)
- Lines 292-300: "Common Mistakes to Avoid" (can be inferred)
- Lines 302-316: "Ready to Use" (invocation is standard)

**KEEP**:
- Role statement (line 15)
- 8-section output structure (lines 33-165)
- Output format template (lines 108-165)

**VALIDATE**: Check markdown renders correctly

---

### Task 2: UPDATE `technical-plan.md` (392 → 150 lines)

**ACTION**: Keep 5 validation questions, remove all meta-text

**SECTIONS TO REMOVE**:
- Lines 20-31: "When to Use This Skill"
- Lines 265-296: "Integration with Workflows"
- Lines 290-297: "What This Skill Does NOT Do"
- Lines 299-306: "Tone and Style"
- Lines 308-371: "Example Validation" (one minimal example is enough)
- Lines 373-381: "Common Anti-Patterns to Catch" (redundant with questions)
- Lines 383-392: "Ready to Use"

**KEEP**:
- Role statement
- 5 validation questions with checks (lines 33-183)
- Final validation report format (lines 185-261)

**VALIDATE**: Check markdown structure intact

---

### Task 3: UPDATE `test-scenarios.md` (406 → 180 lines)

**ACTION**: Keep 5 categories, strip examples and meta-sections

**SECTIONS TO REMOVE**:
- Lines 20-31: "When to Use This Skill"
- Lines 207-245: "Scenario Quality Checklist" (redundant)
- Lines 247-270: "Integration with Workflows"
- Lines 272-279: "What This Skill Does NOT Do"
- Lines 281-289: "Tone and Style"
- Lines 291-356: "Example Output" (one brief example max)
- Lines 358-391: "Common Scenarios to Remember" (not actionable)
- Lines 393-406: "Ready to Use"

**KEEP**:
- Role statement
- 5 test categories (Happy Path, Edge Cases, Error, Performance, Security) with formats (lines 33-142)
- Output format table (lines 144-205)

**VALIDATE**: Check table formatting

---

### Task 4: UPDATE `quality-review.md` (448 → 170 lines)

**ACTION**: Keep 6 quality checks, remove verbose report templates

**SECTIONS TO REMOVE**:
- Lines 20-31: "When to Use This Skill"
- Lines 295-323: "Integration with Workflows"
- Lines 325-332: "What This Skill Does NOT Do"
- Lines 334-341: "Tone and Style"
- Lines 343-350: "Checklist Integration"
- Lines 352-410: "Example Review" (too verbose)
- Lines 412-433: "Common Violations to Watch For" (redundant)
- Lines 435-448: "Ready to Use"

**KEEP**:
- Role statement
- 6 quality checks list (lines 33-101)
- Feedback categories (lines 103-111)
- Output format structure (lines 113-293)

**VALIDATE**: Check nested list structure

---

### Task 5: UPDATE `function-quality.md` (652 → 220 lines)

**ACTION**: Keep 20-item checklist, remove pattern examples and verbose explanations

**SECTIONS TO REMOVE**:
- Lines 20-31: "When to Use This Skill"
- Lines 387-428: "Multi-Function Review" (obvious pattern)
- Lines 430-451: "Integration with Workflows"
- Lines 453-460: "What This Skill Does NOT Do"
- Lines 462-469: "Tone and Style"
- Lines 471-493: "Common Failure Patterns" (redundant with checklist)
- Lines 640-652: "Ready to Use"

**REDUCE**:
- Lines 32-288: Shorten each checklist item explanation by 50% (remove pattern examples, keep check definition only)

**KEEP**:
- Role statement
- 20-item checklist with brief checks (condensed from lines 32-288)
- Output format template (lines 290-385)
- One minimal example (lines 495-636, condensed to ~80 lines)

**VALIDATE**: Verify checklist completeness

---

### Task 6: UPDATE `test-quality.md` (672 → 240 lines)

**ACTION**: Keep 16-item checklist, remove redundant examples

**SECTIONS TO REMOVE**:
- Lines 20-31: "When to Use This Skill"
- Lines 415-439: "Integration with Workflows"
- Lines 441-448: "What This Skill Does NOT Do"
- Lines 450-457: "Tone and Style"
- Lines 459-481: "Common Failure Patterns" (redundant)
- Lines 660-672: "Ready to Use"

**REDUCE**:
- Lines 32-305: Shorten each checklist item explanation by 50% (keep check definition, remove verbose examples)

**KEEP**:
- Role statement
- 16-item checklist with brief checks (condensed from lines 32-305)
- Output format template (lines 307-413)
- One minimal example (lines 483-656, condensed to ~90 lines)

**VALIDATE**: Check test file structure

---

### Task 7: UPDATE `ship.md` (71 lines → minimal changes)

**ACTION**: Already concise, verify no redundant sections

**VERIFY**:
- No verbose explanations present
- Structure is clear and actionable
- Confirmation flow is explicit

**IF NEEDED**: Remove any discovered verbosity

**VALIDATE**: Skill remains functional

---

### Task 8: VERIFY all refactored skills

**ACTION**: Smoke test each skill to ensure functionality preserved

**CHECKS**:
- [ ] Frontmatter unchanged (name, description, user-invocable)
- [ ] Core checklists/processes intact
- [ ] Output format templates present
- [ ] Markdown renders correctly
- [ ] No broken references
- [ ] Skills remain actionable without external docs

**METHOD**: Read each file, verify structure

**VALIDATE**: All 7 skills functional after refactor

---

## Testing Strategy

### Validation Commands

**Level 1: MARKDOWN_LINT**
```bash
markdownlint plugins/codebase-intelligence/skills/*.md
```
**EXPECT**: No linting errors

**Level 2: STRUCTURE_CHECK**
```bash
# Verify each skill has:
# - Frontmatter (---)
# - Role statement (starts with "**Role**:")
# - Core checklist or process
# - Output format section
grep -l "^---$" plugins/codebase-intelligence/skills/*.md
grep -l "\*\*Role\*\*:" plugins/codebase-intelligence/skills/*.md
```
**EXPECT**: All 7 skills match

**Level 3: TOKEN_REDUCTION_CHECK**
```bash
# Before: wc -l on original files (recorded above)
# After: verify 60-70% reduction
wc -l plugins/codebase-intelligence/skills/{product-spec,technical-plan,test-scenarios,quality-review,function-quality,test-quality,ship}.md
```
**EXPECT**:
- product-spec: ~200 lines (was 650)
- technical-plan: ~150 lines (was 392)
- test-scenarios: ~180 lines (was 406)
- quality-review: ~170 lines (was 448)
- function-quality: ~220 lines (was 652)
- test-quality: ~240 lines (was 672)
- ship: ~70 lines (was 71)

**Level 4: MANUAL_VALIDATION**
- Open each skill in editor
- Verify frontmatter intact
- Check core checklist present
- Confirm output format clear
- Test skill invocation (if possible)

---

## Acceptance Criteria

- [ ] All 7 skills reduced by 60-70% in line count
- [ ] Core functionality preserved (checklists, processes, output formats)
- [ ] Frontmatter unchanged
- [ ] No markdown rendering errors
- [ ] Skills remain independently actionable
- [ ] Token usage reduced from 15-20% to 5-8% of context

---

## Completion Checklist

- [ ] Task 1: product-spec.md refactored (650 → ~200 lines)
- [ ] Task 2: technical-plan.md refactored (392 → ~150 lines)
- [ ] Task 3: test-scenarios.md refactored (406 → ~180 lines)
- [ ] Task 4: quality-review.md refactored (448 → ~170 lines)
- [ ] Task 5: function-quality.md refactored (652 → ~220 lines)
- [ ] Task 6: test-quality.md refactored (672 → ~240 lines)
- [ ] Task 7: ship.md verified (71 lines, minimal changes)
- [ ] Task 8: All skills validated and functional
- [ ] Level 1-4 validation commands pass
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Removing too much context breaks skill usability | MEDIUM | HIGH | Keep one minimal example per skill; preserve all checklists intact |
| Markdown formatting errors | LOW | MEDIUM | Run markdownlint after each file; verify in editor |
| Skills become unclear without examples | MEDIUM | MEDIUM | Test each skill after refactor; add back minimal example if needed |
| Token reduction insufficient | LOW | MEDIUM | Target 60-70% reduction; if not met, remove more examples |

---

## Notes

**Refactoring Principles**:
1. **Preserve**: Frontmatter, role statement, core checklist/process, output format
2. **Remove**: "When to Use", "Integration", "What NOT to Do", "Common Mistakes", "Tone and Style", "Ready to Use"
3. **Condense**: Examples (one minimal example max), explanations (keep check definitions only)
4. **Test**: Each skill independently after refactor

**Token Estimation**:
- Before: ~3,200 lines across 7 skills
- After: ~1,230 lines across 7 skills
- Reduction: ~62% (within 60-70% target)

**Success Metrics**:
- Skills load faster in context
- More room for codebase-specific information
- Functionality and usability preserved
