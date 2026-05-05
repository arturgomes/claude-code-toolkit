---
name: prp-implement
description: >
  Implements a .plan.md end-to-end: restores session memory, verifies library APIs via Context7 before each task, consults KB for pattern decisions, and runs drift-guard before every task.
  Pass path/to/plan.md.
argument-hint: <path/to/plan.md> [--base <branch>]
---

# Implement Plan (codebase-intelligence enhanced)

**Plan**: $ARGUMENTS

---

## Your Mission

Execute the plan end-to-end with rigorous self-validation. You are autonomous.

**Core Philosophy**: Validation loops catch mistakes early. Run checks after every change.
Fix issues immediately. Working implementation, not just existing code.

**Golden Rule for implementation**: If a validation fails, fix it before moving on.
**Golden Rule for scope**: If it's not in the AC, don't build it.

**Intelligence layer**:
- Memory is restored before execution — no re-investigation of prior sessions
- Context7 verifies every library API before you write the call
- KB is consulted when an implementation decision has a principled answer
- Drift-guard checks before EVERY task — "does this serve an AC?"

---

<!-- ═══════════════════════════════════════════════════════════════════
     PRE-PHASES — codebase-intelligence
     ═══════════════════════════════════════════════════════════════════ -->

## Pre-Phase I: MEMORY — Restore prior context

`Skill(codebase-intelligence:session-memory)` → SESSION START protocol. Extract ticket from branch or plan's "Intelligence Context". Restore implementation status checkboxes and GOTCHA notes from prior sessions.

**PRE-PHASE-I CHECKPOINT:** session loaded/created · prior task state restored (if continuing)

---

## Pre-Phase II: ANCHOR — Load requirements anchor

Read the plan file's "Intelligence Context" section and extract:

```
TASK ANCHOR (from plan)
───────────────────────────────────────────────
Ticket:  {from plan}
AC:      {verbatim list from Intelligence Context}
NOT in scope: {Hard boundaries from plan}
───────────────────────────────────────────────
```

**This anchor is fixed.** Re-state it before every task.

If the plan has no Intelligence Context section (e.g., plain prp-core plan):
→ ask the user for the acceptance criteria before proceeding. Do not implement blind.

**PRE-PHASE-II CHECKPOINT:**
- [ ] Anchor loaded from plan
- [ ] AC list printed and confirmed

---

<!-- ═══════════════════════════════════════════════════════════════════
     STANDARD PHASES — with codebase-intelligence hooks marked
     ═══════════════════════════════════════════════════════════════════ -->

## Phase 0: DETECT - Project Environment

### 0.1 Identify Package Manager

| File Found | Package Manager | Runner |
|---|---|---|
| `bun.lockb` | bun | `bun` / `bun run` |
| `pnpm-lock.yaml` | pnpm | `pnpm` / `pnpm run` |
| `yarn.lock` | yarn | `yarn` / `yarn run` |
| `package-lock.json` | npm | `npm run` |
| `pyproject.toml` | uv/pip | `uv run` / `python` |
| `Cargo.toml` | cargo | `cargo` |
| `go.mod` | go | `go` |

### 0.2 Detect Base Branch

1. Check `$ARGUMENTS` for `--base <branch>`
2. Auto-detect: `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'`
3. Fallback: `git remote show origin | grep 'HEAD branch' | awk '{print $NF}'`
4. Last resort: `main`

Store as `{base-branch}`. Never hardcode `main`.

### 0.3 Identify Validation Scripts

Check `package.json` for: `type-check` · `typecheck` · `tsc` · `lint` · `lint:fix` · `test` · `build`.
Use the plan's "Validation Commands" section — it specifies exact commands.

**PHASE_0_CHECKPOINT:**
- [ ] Package manager and runner detected
- [ ] Base branch determined
- [ ] Validation commands identified

---

## Phase 1: LOAD - Read the Plan

Read the plan file via Obsidian MCP:
```
mcp__ultimate-obsidian__read_note({ filepath: "{vault-relative path of $ARGUMENTS}" })
```
Strip the vault prefix from `$ARGUMENTS` to get the vault-relative path:
e.g. `~/Documents/Obsidian-Vault/02-Notes/Plans/foo.plan.md` → `02-Notes/Plans/foo.plan.md`

Extract:
- **Intelligence Context** — ticket, AC verbatim, KB findings, Context7 facts ← *added by this plugin*
- **Summary** — what we're building
- **Patterns to Mirror** — code to copy
- **Files to Change** — CREATE/UPDATE list
- **Step-by-Step Tasks** — implementation order
- **AC Traceability table** — which tasks satisfy which AC ← *added by this plugin*
- **Validation Commands** — exact commands (USE THESE)
- **Acceptance Criteria** — definition of done

**PHASE_1_CHECKPOINT:**
- [ ] Plan loaded
- [ ] Intelligence Context read (AC extracted)
- [ ] AC Traceability table read
- [ ] Tasks list extracted

---

## Phase 2: PREPARE - Git State

```bash
git branch --show-current
git status --porcelain
git worktree list
```

| Current State | Action |
|---|---|
| In worktree | Use it |
| On {base-branch}, clean | `git checkout -b feature/{plan-slug}` |
| On {base-branch}, dirty | STOP: "Stash or commit changes first" |
| On feature branch | Use it |

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
     Intelligence hooks added at steps 3.0, 3.1, 3.2, 3.4, 3.5
     ───────────────────────────────────────────────────────────────── -->

### Step 3.0 — Memory cache pre-load

For each file in "Files to Change":
- Check Skill(session-memory) for prior findings
- Print: "✅ Memory hit for {file}: {one-line finding}" for each hit
- Pre-load any GOTCHA notes from prior sessions

### Step 3.0b — Context7 pre-load

If the plan has a `Context7 Library Facts` section:
- Load confirmed signatures into working memory now
- These replace any API calls made from training-data memory during implementation

---

**For each task in the plan's Step-by-Step Tasks:**

### Step 3.1 — Drift check before every task

Follow skill: `codebase-intelligence:drift-guard` → drift questions #1 and #4.

Before starting task {N}:
```
AC this task serves: {state it from AC Traceability table}
Am I about to add anything the AC doesn't require? {yes → remove it / no → proceed}
```

If the task has NO corresponding AC entry → pause, verify it's legitimately in scope,
document the justification, then proceed (or skip if not justified).

### Step 3.2 — Read context with memory

1. Read the **MIRROR** file from the task
2. Check memory for prior findings on this file — use cached rather than re-reading if available
3. Understand the pattern to follow
4. Read **IMPORTS** specified

### Step 3.3 — Context7 verification before implementation

Follow skill: `codebase-intelligence:context7-research`.

If the task calls an external library API:
1. Check if the plan's `Context7 Library Facts` section already has this library → use those facts
2. If not documented yet → run Context7 now, document findings, then implement
3. If Context7 MCP unavailable → note this and proceed with extra care

**Never write an external library call from training memory alone.**

### Step 3.4 — KB implementation check

For tasks that involve a non-trivial pattern decision (error handling, data transform, retry, etc.):

Follow skill: `codebase-intelligence:ask-kb`.
> "What's the KB-recommended pattern for {specific pattern being implemented}?"

If KB has a recommendation → follow it and cite it in the implementation comment.
If KB is silent → use the codebase's existing pattern (from MIRROR) and continue.

### Step 3.5 — Implement

1. Make the change exactly as specified in the task
2. Follow the MIRROR pattern
3. Handle GOTCHA warnings (including any from prior memory sessions)
4. Use only confirmed API signatures (Context7) for external libraries
5. Apply KB patterns where documented

### Step 3.6 — Validate immediately

Run the type-check command from the plan's Validation Commands after EVERY file change.
Do not proceed to the next task until type-check passes.

### Step 3.7 — Mid-task drift check

If a task is taking significantly more effort than expected, or if a new idea surfaces:

Follow skill: `codebase-intelligence:drift-guard` → "While I'm here" trigger.

Any thought starting with:
- "While I'm here, I should also..."
- "This would be cleaner if..."
- "I noticed this other thing..."

→ STOP. Run drift questions #4 (gold-plate) and #2 (scope boundary).
→ If not in AC: note it as a future improvement, do NOT implement now.

### Step 3.8 — Memory save per milestone

Every 3 tasks (or after any significant discovery): `Skill(codebase-intelligence:session-memory)` → SESSION END protocol. Include: tasks completed (with AC mapping), plan deviations, new Context7 findings, drift decisions, next task to resume from.

### Step 3.9 — Track progress

```
Task 1: CREATE src/features/x/models.ts ✅ (AC: {which AC})
Task 2: CREATE src/features/x/service.ts ✅ (AC: {which AC})
```

### Step 3.10 - Context consumption and avoid context rot
Check if the session context window has reached more than 40%. If so, use Skill(session-memory) to update the task development, and stop, notifying the user
to clear the session and restart in another one.

**PHASE_3_CHECKPOINT:**
- [ ] All tasks executed in order
- [ ] Each task passed type-check immediately
- [ ] Drift check run before every task
- [ ] Context7 verified for all library calls
- [ ] KB consulted for pattern decisions
- [ ] Session saved at milestones via session-memory skill (every ~3 tasks)
- [ ] Deviations documented

---

## Phase 4: VALIDATE - Full Verification

### 4.1 Static Analysis

Run type-check and lint from the plan's Validation Commands. Zero errors required.
Set timeout for 30 seconds for tsc, eslint, etc. If it takes longer than this, 
there might be hapenning a Out of Memory, and you should no longer wait.

### 4.2 Unit Tests

Write or update tests — not optional.
- Every new function needs ≥1 test
- Every AC item needs ≥1 test that verifies it
- Update existing tests if behaviour changed

Run test command from plan. Fix failures — determine implementation bug vs test bug.

### 4.3 Build Check

Run build command. Must complete without errors.

### 4.4 Integration Testing (if applicable)

Run integration tests per plan instructions for API/server changes.

### 4.5 AC Verification

For each AC item in the plan, explicitly verify:
```
AC 1: "{verbatim AC}" → {test that covers it} → {result}
AC 2: "{verbatim AC}" → {test that covers it} → {result}
```

All AC items must be green before marking implementation complete.

### 4.6 Quality Review

Follow skill: `codebase-intelligence:quality-review`.

Run comprehensive quality checks on all modified files:
- Function Quality Checklist (20 items)
- Test Quality Checklist (16 items)
- Implementation Best Practices verification
- DRY violations check
- Nesting depth check
- Early returns verification

**GATE**: Quality review must show ✅ PASS or ⚠️ NEEDS WORK (not ❌ BLOCKED) before proceeding to report.

If ❌ BLOCKED:
1. Fix all 🔴 violations
2. Re-run quality-review
3. Continue only when ✅ PASS or ⚠️ NEEDS WORK

Document quality score for inclusion in implementation report.

**PHASE_4_CHECKPOINT:**
- [ ] Type-check passes
- [ ] Lint passes
- [ ] Tests pass
- [ ] Build succeeds
- [ ] **Every AC item verified with a specific test** ← drift-guard final gate
- [ ] Quality review run on all changed files
- [ ] All 🔴 violations fixed
- [ ] Quality score documented

---

## Phase 5: REPORT - Create Implementation Report

**HIERARCHY CHECK** — Before saving, list the target folder:
```
mcp__ultimate-obsidian__list_vault({ path: "02-Notes/Reports" })
```
Confirm the report name matches the plan name (`{plan-name}-report.md`).

**Path**: Save via Obsidian MCP — do NOT use Write tool or bash:
```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Reports/{plan-name}-report.md",
  content: "..."
})
```

**FRONTMATTER_TEMPLATE**: Include at the start of every report file:
```yaml
---
title: {plan-name}-report
created: {YYYY-MM-DD}
source: Implementation session
project: claude-code-toolkit
tags:
  - prp
  - claude-code-toolkit
  - report
  - implementation
plan: "[[{plan-name}]]"
---
```

Include all standard report sections plus:

```markdown
## Intelligence Summary

**Memory sessions at start**: {N}
**Memory saves during execution**: {N}
**Cache hits (files from memory)**: {N}
**Context7 verifications**: {N libraries, N signatures confirmed}
**KB consultations**: {N — topics and results}
**Drift checks**: {N total} — {N passed, N triggered, N removals}
**Quality review**: {✅ PASS | ⚠️ NEEDS WORK} — {N functions, N tests reviewed, X violations fixed}

### Drift removals (scope defended)
- {what was NOT built and why}

### Context7 facts used
- {library}@{version}: {which functions were verified}

### KB patterns applied
- {pattern} — *Source: {KB reference}*

### Quality review summary
- Functions reviewed: {N}
- Test files reviewed: {N}
- Average function quality: {X/20}
- Average test quality: {X/16}
- 🔴 Violations fixed: {N}
- 🟡 Tensions noted: {N}

### AC coverage
| AC Item | Test | Result |
|---|---|---|
| {AC 1} | {test name} | ✅ |
| {AC 2} | {test name} | ✅ |
```

### 5.3 Update Source PRD (if applicable)

Check plan for `Source PRD:` reference. Update phase from `in-progress` to `complete`.

### 5.4 Archive Plan

Move the plan to `02-Notes/Plans/completed/` via Obsidian MCP:
```
mcp__ultimate-obsidian__move_note({
  filepath: "{vault-relative path of $ARGUMENTS}",
  newPath: "02-Notes/Plans/completed/{filename}"
})
```

### 5.5 Final memory save

`Skill(codebase-intelligence:session-memory)` → SESSION END protocol. Include: all file:line findings, decisions + deviations, all Context7 API confirmations (reusable), KB patterns applied, quality review scores (functions N avg X/20, tests N avg X/16, violations fixed), all tasks complete + AC verified + quality review status, next steps (PR command + QA failure recovery path).

**PHASE_5_CHECKPOINT:**
- [ ] Report with Intelligence Summary created
- [ ] AC coverage table in report — all ✅
- [ ] PRD updated (if applicable)
- [ ] Plan archived
- [ ] Final session saved via session-memory skill to vault

---

## Phase 6: OUTPUT - Report to User

Report: plan path, branch, ticket, validation table (type-check/lint/tests/build/AC coverage — all ✅), intelligence counts (Memory sessions/saves/hits, Context7 verifications, KB patterns, drift checks/removals), artifact paths (report, archived plan, session vault path), and next steps (review report → `/prp-pr` → if QA rejects: `/codebase-intelligence:prp-plan "fix {TICKET} QA failures"`).

---

## Handling Failures

### Type Check Fails
Fix, re-run, don't proceed. Check Context7 facts for the affected library — type error often
means an unverified API signature was used.

### Tests Fail
Root cause first: implementation bug or test bug? If Context7 shows the API differs from
what was written, that's the bug. Fix root cause.

### Lint Fails
Run auto-fix, manually fix remainder, re-run.

### AC Not Met
If a test reveals an AC item isn't satisfied: this is not optional. Fix the implementation.
Do not adjust the AC to match the implementation.

### Session Interrupted
Memory saved every ~3 tasks. Restart with the same command:
```
/codebase-intelligence:prp-implement $ARGUMENTS
```
Pre-phases will restore context automatically.

---

## Success Criteria

- **TASKS_COMPLETE**: All plan tasks executed
- **TYPES_PASS**: Type-check exits 0
- **LINT_PASS**: Lint exits 0
- **TESTS_PASS**: All green
- **BUILD_PASS**: Build succeeds
- **AC_VERIFIED**: Every AC item has a named passing test
- **QUALITY_VERIFIED**: Quality review ✅ PASS or ⚠️ NEEDS WORK (all 🔴 violations fixed)
- **REPORT_CREATED**: Report with Intelligence Summary and AC coverage table
- **PLAN_ARCHIVED**: Plan in completed/
- **SESSION_SAVED**: Final session in vault at `~/Documents/Obsidian-Vault/02-Notes/Sessions/{TICKET}-{BRANCH}.md` using Obsidian MCP
- **SCOPE_DEFENDED**: Drift log shows no unintended additions
