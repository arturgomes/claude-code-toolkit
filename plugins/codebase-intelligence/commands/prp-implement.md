---
description: >
  Enhanced prp-implement with codebase intelligence. Extends prp-core:prp-implement with:
  cross-session memory loaded before execution, per-task memory cache checks during Phase 3,
  and automatic memory save after each milestone and at final report.
  Use exactly as you would /prp-implement — pass the path to a .plan.md file.
argument-hint: <path/to/plan.md> [--base <branch>]
---

# Implement Plan (codebase-intelligence enhanced)

**Plan**: $ARGUMENTS

---

## Your Mission

Execute the plan end-to-end with rigorous self-validation. You are autonomous.

**Core Philosophy**: Validation loops catch mistakes early. Run checks after every change.
Fix issues immediately. The goal is a working implementation, not just code that exists.

**Golden Rule**: If a validation fails, fix it before moving on. Never accumulate broken state.

**Intelligence Layer**: Memory is loaded before execution. Per-task cache checks avoid redundant
searches. All progress is saved back to memory so future sessions resume without re-investigation.

---

<!-- ═══════════════════════════════════════════════════════════════════
     INTELLIGENCE PRE-PHASE — codebase-intelligence, runs before Phase 0
     ═══════════════════════════════════════════════════════════════════ -->

## Pre-Phase: MEMORY — Restore prior context

Follow skill: `codebase-intelligence:task-memory` → **SESSION START protocol**

1. Run `git branch --show-current` → {branch}
2. Extract ticket ID from {branch} or from the plan file's "Intelligence Context" section
3. Check `~/.claude/memory/{TICKET}/{BRANCH}.md`

**If memory EXISTS:**
- Load last 3 sessions
- Print: "📂 Memory loaded for {TICKET} — prior findings available for {N} areas"
- Identify any "Implementation status" checkboxes from prior sessions → restore progress state
- If prior session shows tasks completed: confirm git log before re-doing them

**If memory DOES NOT EXIST:**
- Print: "🆕 No prior memory. Starting fresh."
- Create empty memory file

**PRE-PHASE CHECKPOINT:**
- [ ] Branch and ticket confirmed
- [ ] Memory loaded (or fresh start)
- [ ] Prior task completion state restored (if applicable)

---

<!-- ═══════════════════════════════════════════════════════════════════
     STANDARD prp-core PHASES — unchanged from Wirasm/PRPs-agentic-eng
     with codebase-intelligence hooks at marked points
     ═══════════════════════════════════════════════════════════════════ -->

## Phase 0: DETECT - Project Environment

### 0.1 Identify Package Manager

| File Found | Package Manager | Runner |
|------------|-----------------|--------|
| `bun.lockb` | bun | `bun` / `bun run` |
| `pnpm-lock.yaml` | pnpm | `pnpm` / `pnpm run` |
| `yarn.lock` | yarn | `yarn` / `yarn run` |
| `package-lock.json` | npm | `npm run` |
| `pyproject.toml` | uv/pip | `uv run` / `python` |
| `Cargo.toml` | cargo | `cargo` |
| `go.mod` | go | `go` |

Store the detected runner — use it for all subsequent commands.

### 0.2 Detect Base Branch

1. Check `$ARGUMENTS` for `--base <branch>` flag
2. Auto-detect: `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'`
3. Fallback: `git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}'`
4. Last resort: `main`

Store as `{base-branch}` — use for ALL branch comparisons, rebasing, syncing. Never hardcode `main`.

### 0.3 Identify Validation Scripts

Check `package.json` (or equivalent) for: `type-check` · `typecheck` · `tsc` · `lint` · `lint:fix` · `test` · `build`.

Use the plan's "Validation Commands" section — it specifies exact commands for this project.

**PHASE_0_CHECKPOINT:**
- [ ] Package manager and runner detected
- [ ] Base branch determined
- [ ] Validation commands identified

---

## Phase 1: LOAD - Read the Plan

### 1.1 Load Plan File

```bash
cat $ARGUMENTS
```

### 1.2 Extract Key Sections

Locate and understand:
- **Intelligence Context** — ticket, memory sessions, Jira AC, QA context ← *added by codebase-intelligence*
- **Summary** — What we're building
- **Patterns to Mirror** — Code to copy from
- **Files to Change** — CREATE/UPDATE list
- **Step-by-Step Tasks** — Implementation order
- **Validation Commands** — How to verify (USE THESE, not hardcoded commands)
- **Acceptance Criteria** — Definition of done

### 1.3 Validate Plan Exists

If plan not found:
```
Error: Plan not found at $ARGUMENTS
Create a plan first: /prp-plan "feature description"
```

**PHASE_1_CHECKPOINT:**
- [ ] Plan file loaded
- [ ] Intelligence Context section read (ticket, prior memory, QA context)
- [ ] Key sections identified
- [ ] Tasks list extracted

---

## Phase 2: PREPARE - Git State

### 2.1 Check Current State

```bash
git branch --show-current
git status --porcelain
git worktree list
```

### 2.2 Branch Decision

| Current State | Action |
|---|---|
| In worktree | Use it |
| On {base-branch}, clean | Create branch: `git checkout -b feature/{plan-slug}` |
| On {base-branch}, dirty | STOP: "Stash or commit changes first" |
| On feature branch | Use it |

### 2.3 Sync with Remote

```bash
git fetch origin
git pull --rebase origin {base-branch} 2>/dev/null || true
```

**PHASE_2_CHECKPOINT:**
- [ ] On correct branch
- [ ] Working directory clean
- [ ] Up to date with remote

---

## Phase 3: EXECUTE - Implement Tasks

<!-- ─────────────────────────────────────────────────────────────────
     AUGMENTED PHASE — codebase-intelligence adds Steps 3.0 and 3.4
     ───────────────────────────────────────────────────────────────── -->

### 3.0 MEMORY CACHE CHECK (codebase-intelligence)

Before starting the first task: scan task-memory for any cached findings about the
files listed in "Files to Change". For each file already investigated:

- Print: "✅ Memory hit for {file}: {one-line finding from memory}"
- Use this as a starting orientation — no need to re-read from scratch
- If memory shows a prior GOTCHA for a file, pre-load that warning

---

**For each task in the plan's Step-by-Step Tasks section:**

### 3.1 Read Context

1. Read the **MIRROR** file reference from the task
2. Check task-memory for prior findings about this file (skip re-reading if cached)
3. Understand the pattern to follow
4. Read any **IMPORTS** specified

### 3.2 Implement

1. Make the change exactly as specified
2. Follow the pattern from MIRROR reference
3. Handle any **GOTCHA** warnings (including those from prior memory sessions)

### 3.3 Validate Immediately

Run the type-check command from the plan's Validation Commands section after EVERY file change.

If types fail:
1. Read the error
2. Fix the issue
3. Re-run type-check
4. Only proceed when passing

### 3.4 MEMORY SAVE — per milestone (codebase-intelligence)

After every 3 tasks OR after any non-trivial discovery (unexpected pattern, new gotcha, changed
approach), append an interim entry to task-memory:

```markdown
## Session: <ISO date> — Implementation (task {N} of {total})

### Investigated
- <file:line> — <what was found or changed>

### Decisions
- <any deviation from plan and why>

### Implementation status
- [x] Task 1: <description>
- [x] Task 2: <description>
- [ ] Task 3: <description>  ← current

### Next steps
- Continue from Task {N+1}: <file>
```

This ensures that if the session is interrupted, the next session picks up exactly here.

### 3.5 Track Progress

Log each task:
```
Task 1: CREATE src/features/x/models.ts ✅
Task 2: CREATE src/features/x/service.ts ✅
Task 3: UPDATE src/routes/index.ts ✅
```

**Deviation Handling:** If you must deviate from the plan, note WHAT and WHY. Continue documented.

**PHASE_3_CHECKPOINT:**
- [ ] All tasks executed in order
- [ ] Each task passed type-check
- [ ] Memory saved at milestones (every 3 tasks)
- [ ] Deviations documented

---

## Phase 4: VALIDATE - Full Verification

### 4.1 Static Analysis

Run type-check and lint commands from the plan's Validation Commands. Must pass with zero errors.

### 4.2 Unit Tests

Write or update tests for new code — not optional.

Requirements:
- Every new function/feature needs at least one test
- Edge cases from the plan need tests
- Update existing tests if behaviour changed

Run the test command from the plan. Fix failures — determine if implementation bug or test bug.

### 4.3 Build Check

Run the build command from the plan. Must complete without errors.

### 4.4 Integration Testing (if applicable)

If the plan involves API/server changes, run integration tests per plan instructions.

### 4.5 Edge Case Testing

Run any edge case tests specified in the plan.

**PHASE_4_CHECKPOINT:**
- [ ] Type-check passes
- [ ] Lint passes (0 errors)
- [ ] Tests pass (all green)
- [ ] Build succeeds
- [ ] Integration tests pass (if applicable)

---

## Phase 5: REPORT - Create Implementation Report

### 5.1 Create Report Directory

```bash
mkdir -p .claude/PRPs/reports
```

### 5.2 Generate Report

**Path**: `.claude/PRPs/reports/{plan-name}-report.md`

Include all standard prp-core report sections:
- Summary · Assessment vs Reality · Tasks Completed · Validation Results
- Files Changed · Deviations from Plan · Issues Encountered · Tests Written · Next Steps

<!-- ─────────────────────────────────────────────────────────────────
     ADDED SECTION — codebase-intelligence appends this to the report
     ───────────────────────────────────────────────────────────────── -->

Add an **Intelligence Summary** section to the report:

```markdown
## Intelligence Summary

**Memory sessions loaded at start**: {N}
**Memory saves during execution**: {N} (every ~3 tasks)
**Cache hits (files reused from memory)**: {N}
**New findings added to memory**: {N}

### Patterns discovered (added to memory)
- {file:line} — {what was found}

### Gotchas encountered (added to memory)
- {what the gotcha was, how it was resolved}
```

<!-- End of added section -->

### 5.3 Update Source PRD (if applicable)

Check plan for `Source PRD:` reference. If found, update phase status from `in-progress` to `complete`.

### 5.4 Archive Plan

```bash
mkdir -p .claude/PRPs/plans/completed
mv $ARGUMENTS .claude/PRPs/plans/completed/
```

<!-- ─────────────────────────────────────────────────────────────────
     ADDED STEP — codebase-intelligence final memory save
     ───────────────────────────────────────────────────────────────── -->

### 5.5 FINAL MEMORY SAVE (codebase-intelligence)

Follow skill: `codebase-intelligence:task-memory` → **SESSION END protocol**

Append final session entry to `~/.claude/memory/{TICKET}/{BRANCH}.md`:

```markdown
## Session: <ISO date> — Implementation Complete

### Investigated
<all file:line findings from execution>

### Decisions
<deviations from plan and rationale>

### Implementation status
- [x] All {N} tasks complete
- [x] Validation: type-check ✅ lint ✅ tests ✅ build ✅
- [x] Report: .claude/PRPs/reports/{name}-report.md
- [x] Plan archived: .claude/PRPs/plans/completed/

### QA / Failures
<any failures encountered during implementation and how resolved — or "none">

### Next steps
- Review report and create PR: /prp-pr
- If QA rejects: memory is saved — run /prp-plan "fix {TICKET} QA failures" to resume
```

<!-- End of added step -->

**PHASE_5_CHECKPOINT:**
- [ ] Report created at `.claude/PRPs/reports/`
- [ ] Intelligence Summary section in report
- [ ] PRD updated (if applicable)
- [ ] Plan archived to completed
- [ ] Final memory saved to `~/.claude/memory/{TICKET}/{BRANCH}.md`

---

## Phase 6: OUTPUT - Report to User

```markdown
## Implementation Complete ✅

**Plan**: `$ARGUMENTS`
**Branch**: `{branch-name}`
**Ticket**: {JIRA-TICKET}

### Validation Summary

| Check | Result |
|---|---|
| Type check | ✅ |
| Lint | ✅ |
| Tests | ✅ ({N} passed) |
| Build | ✅ |

### Files Changed

- {N} files created · {M} files updated · {K} tests written

### Intelligence Summary

- Memory loaded: {N} prior sessions
- Cache hits: {N} files reused from memory
- Memory saved: {N} milestones + final

### Deviations

{If none: "Implementation matched the plan."}

### Artifacts

- Report: `.claude/PRPs/reports/{name}-report.md`
- Plan archived to: `.claude/PRPs/plans/completed/`
- Memory: `~/.claude/memory/{TICKET}/{BRANCH}.md`

### Next Steps

1. Review report
2. Create PR: `/prp-pr`
3. If QA rejects (even weeks later): `/prp-plan "fix {TICKET} QA failures"` — memory is waiting
```

---

## Handling Failures

### Type Check Fails
Fix, re-run, don't proceed until passing. Save current state to memory before investigating.

### Tests Fail
Determine: implementation bug or test bug? Fix root cause. Re-run until green.

### Lint Fails
Run auto-fix command, manually fix remainder, re-run.

### Build Fails
Usually a type or import issue. Fix and re-run.

### Session Interrupted
Memory was saved every ~3 tasks. Restart with:
```
/prp-implement $ARGUMENTS
```
Pre-phase will restore context from `~/.claude/memory/{TICKET}/{BRANCH}.md` automatically.

---

## Success Criteria

- **TASKS_COMPLETE**: All plan tasks executed
- **TYPES_PASS**: Type-check command exits 0
- **LINT_PASS**: Lint command exits 0
- **TESTS_PASS**: All tests green
- **BUILD_PASS**: Build succeeds
- **REPORT_CREATED**: Implementation report exists with Intelligence Summary
- **PLAN_ARCHIVED**: Original plan moved to completed
- **MEMORY_SAVED**: Final session entry in `~/.claude/memory/{TICKET}/{BRANCH}.md`
