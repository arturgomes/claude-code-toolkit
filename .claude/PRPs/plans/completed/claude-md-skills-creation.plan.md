# Feature: Create Skills from CLAUDE.md Shortcuts

## Summary

Transform CLAUDE.md code review shortcuts (QUX, QCHECK, QCHECKF, QCHECKT, QPO, QPLAN, QCODE) into reusable Claude Code skills that can be invoked manually by users and automatically integrated into planning/implementation workflows.

## User Story

As a developer using Claude Code
I want CLAUDE.md shortcuts available as skills
So that I can invoke quality checks, test planning, and reviews consistently without copy-pasting prompts

## Problem Statement

CLAUDE.md defines 7 powerful shortcuts (QPO, QPLAN, QUX, QCODE, QCHECK, QCHECKF, QCHECKT) but they require manual copying into chat. Converting them to skills makes them:
- **Discoverable** via skill list
- **Reusable** across all projects
- **Automatable** via phase injection into prp-plan/prp-implement
- **Versioned** with the codebase

## Solution Statement

Create 5 new skills in `plugins/codebase-intelligence/skills/` that mirror existing skill patterns (drift-guard, consult-kb, task-memory). Each skill translates a CLAUDE.md shortcut into a structured workflow with:
- YAML frontmatter (name, description, user-invocable)
- Step-by-step execution instructions
- Quality checklists
- Integration points with prp-plan/prp-implement

## Metadata

| Field | Value |
|-------|-------|
| Type | NEW_CAPABILITY |
| Complexity | MEDIUM |
| Systems Affected | plugins/codebase-intelligence/skills |
| Dependencies | None (pure markdown skills) |
| Estimated Tasks | 7 |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐            ║
║   │   Claude    │ ──────► │  Copy/Paste │ ──────► │   Execute   │            ║
║   │   Chat      │         │  CLAUDE.md  │         │   Shortcut  │            ║
║   └─────────────┘         │  Shortcut   │         └─────────────┘            ║
║                           └─────────────┘                                     ║
║                                                                               ║
║   USER_FLOW:                                                                  ║
║   1. Open CLAUDE.md in editor                                                 ║
║   2. Find desired shortcut (QCHECK, QUX, etc.)                                ║
║   3. Copy entire prompt block                                                 ║
║   4. Paste into Claude chat                                                   ║
║   5. Execute manually                                                         ║
║                                                                               ║
║   PAIN_POINT:                                                                 ║
║   - Manual copy/paste every time                                              ║
║   - No discoverability (must remember shortcut names)                         ║
║   - Not automated in workflows                                                ║
║   - No version control integration                                            ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐            ║
║   │   Claude    │ ──────► │  Type Skill │ ──────► │   Execute   │            ║
║   │   Chat      │         │  Command    │         │   Review    │            ║
║   └─────────────┘         └─────────────┘         └─────────────┘            ║
║         │                                                                     ║
║         │                 ┌─────────────┐                                     ║
║         └────────────────►│   Auto      │  (prp-plan/prp-implement)           ║
║                           │ Integration │                                     ║
║                           └─────────────┘                                     ║
║                                                                               ║
║   USER_FLOW:                                                                  ║
║   Manual: Type skill name (e.g., "qcheck", "qux")                             ║
║   Auto: Skills run at phase gates in prp-plan/prp-implement                   ║
║                                                                               ║
║   VALUE_ADD:                                                                  ║
║   - Zero copy/paste friction                                                  ║
║   - Tab-completion and discoverability                                        ║
║   - Automatic quality gates in workflows                                      ║
║   - Version-controlled with codebase                                          ║
║                                                                               ║
║   DATA_FLOW:                                                                  ║
║   Input: Code changes / Plan / Feature description                            ║
║   Process: Skill executes checklist (Function Quality / Test Quality / etc.)  ║
║   Output: Structured feedback (✅/❌ with specific file:line references)       ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| Claude chat | User types full QCHECK prompt | User types "qcheck" | 90% fewer keystrokes |
| prp-plan Phase 5 | No automatic quality review | quality-review skill auto-runs | Catches issues before implementation |
| prp-implement Task loop | No automatic test coverage check | test-quality skill auto-runs after test creation | Ensures tests meet standards |
| Feature planning | Manual QPO/QPLAN copy/paste | Type "product-spec" or "technical-plan" | Consistent planning artifacts |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `/Users/artur/Documents/ai-tools/claude-code-toolkit/CLAUDE.md` | 243-380 | Source shortcuts to convert (QNEW, QPLAN, QCODE, QCHECK, QCHECKF, QCHECKT, QUX, QPO, QGIT) |
| P0 | `/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/skills/drift-guard.md` | all | Pattern for quality checkpoint skills |
| P0 | `/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/skills/consult-kb.md` | all | Pattern for review skills with feedback categories |
| P0 | `/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/skills/task-memory.md` | all | Pattern for session-based skills |
| P1 | `/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/skills/ship.md` | all | YAML frontmatter structure and multi-step workflow pattern |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [Claude Code Skills Docs](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/skills) | Skill structure | Official skill format specification |

---

## Patterns to Mirror

**YAML FRONTMATTER:**
```yaml
# SOURCE: plugins/codebase-intelligence/skills/drift-guard.md:1-5
# COPY THIS PATTERN:
---
name: drift-guard
description: >
  Keep every decision tethered to requirements. Invoked automatically after
  prp-plan Phase 5 (ARCHITECT) and before prp-implement Phase 1 (first task).
  Also invoke manually when scope feels uncertain.
user-invocable: true
---
```

**STEP-BY-STEP STRUCTURE:**
```markdown
# SOURCE: plugins/codebase-intelligence/skills/drift-guard.md:63-95
# COPY THIS PATTERN:

## Seven Drift Questions

For every new file, function, or decision:

### 1. REQUIREMENT TRACE
Does this directly serve an AC? Name which one.

IF_NO → ⚠️ Flag for scope creep.
IF_YES → Continue.

### 2. SCOPE BOUNDARY
Inside files the plan identified? Or new file not in plan?

IF_NEW_FILE → Justify why plan didn't anticipate it.
IF_IN_PLAN → Continue.
```

**QUALITY CHECKLIST FORMAT:**
```markdown
# SOURCE: CLAUDE.md:172-209
# COPY THIS PATTERN:

## Function Quality Checklist

Before considering a function "done", verify:

### Readability
1. ✅ Can I honestly follow the logic without mental gymnastics?
2. ✅ Are variable names descriptive and consistent with codebase conventions?
3. ✅ Is the function doing one thing well (Single Responsibility)?

### Complexity
4. ✅ Cyclomatic complexity ≤10? (Count independent paths)
5. ✅ Nesting depth ≤3 levels?
6. ✅ Used early returns to flatten structure?
```

**FEEDBACK CATEGORIES:**
```markdown
# SOURCE: plugins/codebase-intelligence/skills/consult-kb.md:46-52
# COPY THIS PATTERN:

## Feedback Categories

🔴 **Violation** — directly contradicts documented principle (file:line ref required)
🟡 **Tension** — deviates but has potential justification (explain)
🟢 **Aligned** — explicitly matches recommendation
💡 **Suggestion** — KB has better approach not currently used
```

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `plugins/codebase-intelligence/skills/product-spec.md` | CREATE | QPO shortcut → Product Owner skill |
| `plugins/codebase-intelligence/skills/technical-plan.md` | CREATE | QPLAN shortcut → Technical planning skill |
| `plugins/codebase-intelligence/skills/test-scenarios.md` | CREATE | QUX shortcut → QA test scenario generation |
| `plugins/codebase-intelligence/skills/quality-review.md` | CREATE | QCHECK shortcut → Comprehensive code review |
| `plugins/codebase-intelligence/skills/function-quality.md` | CREATE | QCHECKF shortcut → Function-level quality |
| `plugins/codebase-intelligence/skills/test-quality.md` | CREATE | QCHECKT shortcut → Test-level quality |
| `plugins/codebase-intelligence/README.md` | UPDATE | Add phase injection points for new skills |

---

## NOT Building (Scope Limits)

Explicit exclusions to prevent scope creep:

- **QCODE skill** — Not creating this because QCODE is implementation instructions, not a checkable skill. It's already handled by prp-implement workflow.
- **QGIT skill** — Not creating this because `ship.md` already handles git workflows (stage, commit, push, PR).
- **QNEW shortcut** — Not creating this because it's a meta-instruction to "understand CLAUDE.md", which is automatically loaded via project context.
- **Automatic skill invocation config** — Not implementing phase injection automation in this PR. Skills will be user-invocable first; auto-injection is future work.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

### Task 1: CREATE `plugins/codebase-intelligence/skills/product-spec.md`

- **ACTION**: Convert QPO shortcut (CLAUDE.md:324-381) into Product Owner skill
- **IMPLEMENT**:
  - YAML frontmatter: name: product-spec, user-invocable: true
  - 8-section workflow: Feature Overview → User Stories → Acceptance Criteria → Dependencies → Out of Scope → Success Metrics → Technical Considerations → UI/UX Requirements
- **MIRROR**: `plugins/codebase-intelligence/skills/drift-guard.md:1-10` for YAML structure
- **PATTERN**: Each section has a checklist of required items
- **OUTPUT**: Markdown artifact with frontmatter tags (FEATURE_OVERVIEW, USER_STORIES, etc.) for parsing by downstream skills
- **VALIDATE**: Read the file and verify all 8 sections present

### Task 2: CREATE `plugins/codebase-intelligence/skills/technical-plan.md`

- **ACTION**: Convert QPLAN shortcut (CLAUDE.md:252-260) into Technical Planning skill
- **IMPLEMENT**:
  - YAML frontmatter: name: technical-plan, user-invocable: true
  - 5-step workflow: Analyze codebase patterns → Ensure consistency → Minimize changes → Reuse utilities → Follow DRY + early returns
- **MIRROR**: `plugins/codebase-intelligence/skills/drift-guard.md:63-95` for question-based validation
- **PATTERN**: Each step is a question with IF_NO → action, IF_YES → continue
- **OUTPUT**: Checklist of plan validation results (✅ consistent / ❌ introduces new patterns not in codebase)
- **VALIDATE**: Read the file and verify 5 validation questions present

### Task 3: CREATE `plugins/codebase-intelligence/skills/test-scenarios.md`

- **ACTION**: Convert QUX shortcut (CLAUDE.md:304-313) into QA Test Scenario skill
- **IMPLEMENT**:
  - YAML frontmatter: name: test-scenarios, user-invocable: true
  - Role prompt: "You are a human QA engineer"
  - 5 scenario categories: Happy path → Edge cases → Error conditions → Performance → Security
- **MIRROR**: `plugins/codebase-intelligence/skills/consult-kb.md:39-111` for structured output format
- **PATTERN**: Output sorted by priority (P0, P1, P2) with test case table
- **OUTPUT**:
  ```
  | Priority | Scenario | Given | When | Then | Notes |
  |----------|----------|-------|------|------|-------|
  ```
- **VALIDATE**: Read the file and verify 5 scenario categories present

### Task 4: CREATE `plugins/codebase-intelligence/skills/quality-review.md`

- **ACTION**: Convert QCHECK shortcut (CLAUDE.md:274-283) into comprehensive code review skill
- **IMPLEMENT**:
  - YAML frontmatter: name: quality-review, user-invocable: true
  - Role prompt: "You are a SKEPTICAL senior software engineer"
  - 6-step checklist: Run Function Quality Checklist → Run Test Quality Checklist → Verify Implementation Best Practices → Check DRY violations → Check nesting → Verify early returns
- **MIRROR**: `plugins/codebase-intelligence/skills/consult-kb.md:46-52` for feedback categories (🔴/🟡/🟢/💡)
- **PATTERN**: For each violation, require file:line reference + specific fix recommendation
- **OUTPUT**:
  ```
  ## Quality Review Report

  ### Function Quality
  [Per-function report with checklist results]

  ### Test Quality
  [Per-test-file report with checklist results]

  ### Best Practices
  [Violations with file:line refs]
  ```
- **VALIDATE**: Read the file and verify all 6 checklist steps present

### Task 5: CREATE `plugins/codebase-intelligence/skills/function-quality.md`

- **ACTION**: Convert QCHECKF shortcut (CLAUDE.md:285-293) + Function Quality Checklist (CLAUDE.md:172-209) into function-level skill
- **IMPLEMENT**:
  - YAML frontmatter: name: function-quality, user-invocable: true
  - 6 quality dimensions: Readability (3 checks) → Complexity (3 checks) → Design (3 checks) → Type Safety (3 checks) → Testability (3 checks) → DRY (2 checks) → Naming (3 checks)
  - Total: 20 checklist items
- **MIRROR**: `plugins/codebase-intelligence/skills/drift-guard.md:63-95` for question-based validation
- **PATTERN**: Each check is ✅ or ❌ with file:line reference if failing
- **OUTPUT**:
  ```
  ## Function: functionName (file.ts:line)

  ### Readability
  1. ✅ Logic is clear
  2. ❌ Variable naming inconsistent (line 15: use camelCase)
  3. ✅ Single Responsibility

  [... 17 more checks ...]

  **SCORE**: 18/20 (90%)
  **RECOMMENDATION**: Fix naming consistency
  ```
- **VALIDATE**: Read the file and verify all 20 checklist items present

### Task 6: CREATE `plugins/codebase-intelligence/skills/test-quality.md`

- **ACTION**: Convert QCHECKT shortcut (CLAUDE.md:294-302) + Test Quality Checklist (CLAUDE.md:213-241) into test-level skill
- **IMPLEMENT**:
  - YAML frontmatter: name: test-quality, user-invocable: true
  - 4 quality dimensions: Test Structure (3 checks) → Test Quality (5 checks) → Coverage (4 checks) → Property Testing (2 checks) → Integration (2 checks)
  - Total: 16 checklist items
- **MIRROR**: `plugins/codebase-intelligence/skills/function-quality.md` (same checklist format)
- **PATTERN**: Each check is ✅ or ❌ with file:line reference if failing
- **OUTPUT**:
  ```
  ## Test File: test-file.spec.ts

  ### Test Structure
  1. ✅ Tests grouped under describe()
  2. ✅ Each test has one clear purpose
  3. ❌ Test name mismatch (line 42: test says "returns error" but asserts success)

  [... 13 more checks ...]

  **SCORE**: 14/16 (87%)
  **RECOMMENDATION**: Fix test name to match assertion
  ```
- **VALIDATE**: Read the file and verify all 16 checklist items present

### Task 7: UPDATE `plugins/codebase-intelligence/README.md`

- **ACTION**: Document new skills and their phase injection points
- **IMPLEMENT**: Add table entry for each new skill:
  ```markdown
  | Skill | Phase Injection | Purpose |
  |-------|-----------------|---------|
  | product-spec | Manual / Pre-planning | Generate comprehensive PRD from feature idea |
  | technical-plan | prp-plan Phase 4 (DESIGN) | Validate plan consistency with codebase patterns |
  | test-scenarios | prp-plan Phase 5 (ARCHITECT) | Generate QA test cases before implementation |
  | quality-review | prp-implement After each task | Run full quality checklist (function + test) |
  | function-quality | prp-implement After writing function | Validate function against 20-point checklist |
  | test-quality | prp-implement After writing test | Validate test against 16-point checklist |
  ```
- **MIRROR**: Existing README.md format (if it has a skills table)
- **VALIDATE**: Read README.md and verify all 6 new skills documented

---

## Testing Strategy

### Manual Validation to Perform

| Skill | Test Scenario | Expected Output |
|-------|---------------|-----------------|
| product-spec | User types "product-spec: Add dark mode toggle" | 8-section PRD artifact with Feature Overview, User Stories, ACs, etc. |
| technical-plan | User provides a plan draft | Checklist of ✅/❌ for consistency, minimal changes, DRY, early returns |
| test-scenarios | User provides feature description | Table of test scenarios sorted by priority (P0/P1/P2) |
| quality-review | User points to recent code changes | Report with Function Quality + Test Quality + Best Practices violations |
| function-quality | User points to specific function | 20-item checklist with score and specific file:line recommendations |
| test-quality | User points to test file | 16-item checklist with score and specific file:line recommendations |

### Edge Cases Checklist

- [ ] Skill invoked with no code changes (should request input or scan git diff)
- [ ] Skill invoked on non-existent file (should error gracefully)
- [ ] Skill invoked in non-git repo (should skip git commands)
- [ ] Multiple violations in same function (should list all, not just first)
- [ ] Perfect score (should still output report with all ✅)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
# Verify YAML frontmatter is valid
for file in plugins/codebase-intelligence/skills/*.md; do
  echo "Checking $file"
  head -20 "$file" | grep -E '^(name|description|user-invocable):' || echo "Missing frontmatter in $file"
done
```

**EXPECT**: All 6 new skills have valid YAML frontmatter

### Level 2: MANUAL_VALIDATION

1. Open Claude Code chat
2. Type each skill name (product-spec, technical-plan, test-scenarios, quality-review, function-quality, test-quality)
3. Verify skill is recognized and loads
4. Provide sample input
5. Verify structured output matches expected format

**EXPECT**: All 6 skills are invocable and produce correct output format

### Level 3: INTEGRATION_VALIDATION

1. Run `/prp-plan` on a sample feature
2. Verify `technical-plan` and `test-scenarios` skills are mentioned or auto-invoked (future work)
3. Run `/prp-implement` on a sample plan
4. Verify `quality-review`, `function-quality`, `test-quality` skills are mentioned or auto-invoked (future work)

**EXPECT**: Skills integrate cleanly with existing prp-plan/prp-implement workflow

---

## Acceptance Criteria

- [ ] All 6 skills created with valid YAML frontmatter
- [ ] Each skill mirrors existing skill patterns (drift-guard, consult-kb, task-memory)
- [ ] All skills are user-invocable (user-invocable: true)
- [ ] All skills produce structured output with file:line references where applicable
- [ ] README.md documents all 6 skills with phase injection points
- [ ] Manual validation: all skills recognized by Claude Code and executable
- [ ] No regressions: existing skills still work

---

## Completion Checklist

- [ ] Task 1: product-spec.md created and validated
- [ ] Task 2: technical-plan.md created and validated
- [ ] Task 3: test-scenarios.md created and validated
- [ ] Task 4: quality-review.md created and validated
- [ ] Task 5: function-quality.md created and validated
- [ ] Task 6: test-quality.md created and validated
- [ ] Task 7: README.md updated with new skills
- [ ] Level 1: YAML frontmatter validation passes
- [ ] Level 2: Manual invocation test passes for all 6 skills
- [ ] Level 3: Integration test with prp-plan/prp-implement confirms no conflicts
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Skills not discoverable by users | LOW | MEDIUM | Add clear descriptions with trigger keywords (e.g., "invoke manually when scope feels uncertain") |
| Output format inconsistent across skills | MEDIUM | MEDIUM | Mirror existing patterns (consult-kb feedback categories, drift-guard question format) |
| Skills conflict with existing prp-plan/prp-implement steps | LOW | HIGH | Document phase injection points in README; ensure skills are additive, not replacing existing steps |
| Checklist items too strict (too many false positives) | MEDIUM | MEDIUM | Use 🟡 Tension category for deviations with justification; reserve 🔴 Violation for clear contradictions |
| Users don't know which skill to use | LOW | MEDIUM | Add skill selection guide in README (when to use product-spec vs technical-plan vs quality-review) |

---

## Notes

### Design Decisions

1. **Splitting QCHECK into 3 skills** — QCHECK in CLAUDE.md runs Function Quality + Test Quality + Best Practices. We split this into:
   - `quality-review.md` — Runs all 3 checklists (mirrors QCHECK exactly)
   - `function-quality.md` — Runs only function checklist (mirrors QCHECKF)
   - `test-quality.md` — Runs only test checklist (mirrors QCHECKT)

   **Rationale**: Allows users to run targeted checks without full review overhead. `quality-review` is the "run everything" option.

2. **Not automating phase injection yet** — Skills are user-invocable first. Future PR will add automatic invocation at phase gates (e.g., `technical-plan` auto-runs after prp-plan Phase 4). This keeps the initial PR focused on skill creation.

3. **Using feedback categories from consult-kb** — 🔴/🟡/🟢/💡 pattern is proven and intuitive. Reusing it for consistency across skills.

4. **QPO becomes product-spec** — Renamed to match skill naming conventions (verb-noun or noun pattern). "QPO" is an acronym that doesn't self-document; "product-spec" is clear.

### Future Enhancements

- **Automatic phase injection**: Update prp-plan/prp-implement to auto-invoke skills at specific gates
- **Skill composition**: Allow skills to invoke other skills (e.g., quality-review invokes function-quality + test-quality)
- **MCP integration**: Connect skills to Serena (LSP) and SocratiCode (semantic search) for automated violation detection
- **Configurable strictness**: Add YAML frontmatter field for strict/lenient mode (affects 🔴 vs 🟡 threshold)

### Trade-offs

**Verbosity vs Brevity**: Skills are verbose with full checklists and examples. This is intentional — better to over-explain and let users skim than under-explain and cause confusion.

**Manual vs Automatic**: Starting with manual invocation is safer. Automatic invocation can be overwhelming if every task triggers multiple quality checks. Let users opt-in first, then auto-enable once patterns are proven.

**Monolithic vs Modular**: Splitting QCHECK into 3 skills (quality-review, function-quality, test-quality) adds more files but increases flexibility. Users can run targeted checks instead of always running the full suite.
