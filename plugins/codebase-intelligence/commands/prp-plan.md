---
description: >
  Enhanced prp-plan with codebase intelligence. Extends prp-core:prp-plan with:
  cross-session memory (task-memory skill), live Jira ticket context (Atlassian MCP),
  and two-tier codebase search (Serena + SocratiCode) injected into Phase 2 EXPLORE.
  Use exactly as you would /prp-plan — pass a feature description or path to a .prd.md file.
argument-hint: <feature description | JIRA-TICKET | path/to/prd.md>
---

<objective>
Transform "$ARGUMENTS" into a battle-tested implementation plan through systematic codebase
exploration, pattern extraction, strategic research, AND persistent memory + semantic search.

**Core Principle**: PLAN ONLY — no code written. Create a context-rich document that enables
one-pass implementation success.

**Execution Order**: MEMORY FIRST → JIRA CONTEXT → CODEBASE (structural + semantic + agents) → RESEARCH.

**Agent Strategy** (same as prp-core, augmented):
- `prp-core:codebase-explorer` — finds WHERE code lives and extracts implementation patterns
- `prp-core:codebase-analyst` — analyzes HOW integration points work and traces data flow
- `prp-core:web-researcher` — strategic web research with citations and gap analysis

**Intelligence Layer** (added by codebase-intelligence):
- `codebase-intelligence:task-memory` skill — load prior session findings before any search
- `codebase-intelligence:codebase-search` skill — Serena (LSP) + SocratiCode (semantic) to
  enrich Phase 2 discovery table with exact file:line references and semantic neighbours
- Atlassian MCP — inject live Jira ticket context, acceptance criteria, QA failure comments
</objective>

<context>
CLAUDE.md rules: @CLAUDE.md

**Directory Discovery** (run these to understand project structure):
- List root contents: `ls -la`
- Find main source directories: `ls -la */ 2>/dev/null | head -50`
- Identify project type from config files (package.json, pyproject.toml, Cargo.toml, go.mod, etc.)

**IMPORTANT**: Do NOT assume `src/` exists. Discover the actual structure before proceeding.
</context>

<process>

<!-- ═══════════════════════════════════════════════════════════════════
     INTELLIGENCE PRE-PHASE — added by codebase-intelligence plugin
     Runs BEFORE the standard prp-core phases
     ═══════════════════════════════════════════════════════════════════ -->

## Pre-Phase I: MEMORY — Load prior session context

Follow skill: `codebase-intelligence:task-memory` → **SESSION START protocol**

Steps:
1. Run `git branch --show-current` → store as {branch}
2. Extract Jira ticket ID: match `[A-Z]+-[0-9]+` from {branch} or from `$ARGUMENTS`
3. Check `~/.claude/memory/{TICKET}/{BRANCH}.md`

**If memory EXISTS:**
- Read last 3 sessions
- Print summary: last date · implementation status · open blockers
- Ask user: "📂 Prior context found for {TICKET}. Continue from last session, or start fresh?"
- If continuing: pre-populate discovery table with prior file:line findings (skip re-searching those areas)

**If memory DOES NOT EXIST:**
- Print: "🆕 No prior memory for {TICKET}. Running full discovery."
- Create empty memory file

**PRE-PHASE-I CHECKPOINT:**
- [ ] Branch and ticket ID determined
- [ ] Memory loaded (or confirmed absent)
- [ ] Prior findings pre-populated (or fresh start confirmed)

---

## Pre-Phase II: JIRA — Inject ticket context

**If Atlassian MCP is available and a ticket ID was found:**

1. Fetch issue: `get_issue(ticket_id)`
2. Extract and store:
   - Summary and full description
   - Acceptance criteria (from Description or dedicated AC field)
   - Labels, priority, story points
   - **All comments** — scan for QA/failure keywords: fail, reject, QA, blocked, acceptance, doesn't pass
3. If QA failure comments found, print:
   > "⚠️ QA failure detected in comments ({date}): {one-line summary}"
   > This will be included in the plan as a "QA Context" section.

**If Atlassian MCP is unavailable:**
- Skip silently — do not block planning
- Note in plan: "Jira context unavailable — acceptance criteria sourced from user input only"

**PRE-PHASE-II CHECKPOINT:**
- [ ] Jira ticket context fetched (or skipped with note)
- [ ] Acceptance criteria extracted
- [ ] QA failures identified (if any)

<!-- ═══════════════════════════════════════════════════════════════════
     STANDARD prp-core PHASES — unchanged from Wirasm/PRPs-agentic-eng
     ═══════════════════════════════════════════════════════════════════ -->

## Phase 0: DETECT - Input Type Resolution

**Determine input type:**

| Input Pattern | Type | Action |
|---------------|------|--------|
| Ends with `.prd.md` | PRD file | Parse PRD, select next phase |
| Ends with `.md` and contains "Implementation Phases" | PRD file | Parse PRD, select next phase |
| File path that exists | Document | Read and extract feature description |
| Free-form text | Description | Use directly as feature input |
| Empty/blank | Conversation | Use conversation context as input |

### If PRD File Detected:

1. Read the PRD file
2. Parse the Implementation Phases table — find rows with `Status: pending`
3. Check dependencies — only select phases whose dependencies are `complete`
4. Select the next actionable phase
5. Extract phase context (PHASE, GOAL, SCOPE, SUCCESS SIGNAL, PRD CONTEXT)
6. Report selection to user

### If Free-form or Conversation Context:
- Proceed directly to Phase 1 with the input as feature description

**PHASE_0_CHECKPOINT:**
- [ ] Input type determined
- [ ] If PRD: next phase selected and dependencies verified
- [ ] Feature description ready for Phase 1

---

## Phase 1: PARSE - Feature Understanding

**EXTRACT from input:**

- Core problem being solved
- User value and business impact
- Feature type: NEW_CAPABILITY | ENHANCEMENT | REFACTOR | BUG_FIX
- Complexity: LOW | MEDIUM | HIGH
- Affected systems list

**FORMULATE user story:**

```
As a <user type>
I want to <action/goal>
So that <benefit/value>
```

**PHASE_1_CHECKPOINT:**

- [ ] Problem statement is specific and testable
- [ ] User story follows correct format
- [ ] Complexity assessment has rationale
- [ ] Affected systems identified

**GATE**: If requirements are AMBIGUOUS → STOP and ASK user for clarification before proceeding.

---

## Phase 2: EXPLORE - Codebase Intelligence

<!-- ─────────────────────────────────────────────────────────────────
     AUGMENTED PHASE — codebase-intelligence adds Steps 2A and 2B
     before and after the standard agent launch
     ───────────────────────────────────────────────────────────────── -->

### Step 2A — MEMORY PRE-FILL (codebase-intelligence)

Before launching agents: check task-memory for areas already investigated.
Follow skill: `codebase-intelligence:codebase-search` → **Execution flow step 1**.

- For each area in the feature scope, check if a prior finding exists in memory
- Mark pre-filled areas with `[FROM MEMORY]` in the discovery table
- Only run agents and MCP searches for areas NOT already covered

---

### Step 2B — PARALLEL AGENTS (standard prp-core)

**Launch two agents in parallel using multiple Task tool calls in a single message:**

#### Agent 1: `prp-core:codebase-explorer`

```
Find all code relevant to implementing: [feature description].

LOCATE:
1. Similar implementations - analogous features with file:line references
2. Naming conventions - actual examples of function/class/file naming
3. Error handling patterns - how errors are created, thrown, caught
4. Logging patterns - logger usage, message formats
5. Type definitions - relevant interfaces and types
6. Test patterns - test file structure, assertion styles, test file locations
7. Configuration - relevant config files and settings
8. Dependencies - relevant libraries already in use

Categorize findings by purpose (implementation, tests, config, types, docs).
Return ACTUAL code snippets from codebase, not generic examples.
```

#### Agent 2: `prp-core:codebase-analyst`

```
Analyze the implementation details relevant to: [feature description].

TRACE:
1. Entry points - where new code will connect to existing code
2. Data flow - how data moves through related components
3. State changes - side effects in related functions
4. Contracts - interfaces and expectations between components
5. Patterns in use - design patterns and architectural decisions

Document what exists with precise file:line references. No suggestions or improvements.
```

---

### Step 2C — TWO-TIER ENRICHMENT (codebase-intelligence)

After agents complete: run Serena + SocratiCode to add exact symbol resolution and
semantic neighbours that static text analysis may have missed.

Follow skill: `codebase-intelligence:codebase-search` → **Execution flow steps 2–3**.

**Serena enrichment** (Tier 1):
- For every symbol name mentioned by the agents, resolve exact file:line via `find_symbol`
- For entry points identified, get callers via `get_symbol_references`
- For any file path mentioned, verify it exists via `find_files`

**SocratiCode enrichment** (Tier 2):
- Run 3 semantic queries covering the behavioural intent of the feature
- Take top-3 results per query
- Add any new files not already in the agent findings

---

### Merge All Results into Unified Discovery Table

Combine memory pre-fills, agent findings, Serena, and SocratiCode into one table:

| Category | File:Lines | Pattern Description | Code Snippet | Source |
|----------|------------|---------------------|--------------|--------|
| NAMING | `src/features/X/service.ts:10-15` | camelCase functions | `export function createThing()` | explorer |
| ERRORS | `src/features/X/errors.ts:5-20` | Custom error classes | `class ThingNotFoundError` | serena |
| LOGGING | `src/core/logging/index.ts:1-10` | getLogger pattern | `const logger = getLogger("domain")` | explorer |
| TESTS | `src/features/X/tests/service.test.ts:1-30` | describe/it blocks | `describe("service", () => {` | analyst |
| TYPES | `src/features/X/models.ts:1-20` | Type inference | `type Thing = typeof things.$inferSelect` | serena |
| FLOW | `src/features/X/service.ts:40-60` | Data transformation | `input → validate → persist → respond` | analyst |
| SEMANTIC | `src/features/Y/handler.ts:80-95` | Related auth logic | `validateToken(req.headers)` | socraticode |
| MEMORY | `src/features/Z/service.ts:30` | Prior session finding | `parseDocument()` entry point | memory |

**Source** values: `explorer` · `analyst` · `serena` · `socraticode` · `memory`

**PHASE_2_CHECKPOINT:**

- [ ] Memory pre-fill checked — prior findings reused where available
- [ ] Both prp-core agents launched in parallel and completed
- [ ] Serena symbol resolution run for all mentioned symbols
- [ ] SocratiCode semantic queries run (3 queries, top-3 each)
- [ ] Discovery table has Source column populated
- [ ] At least 3 similar implementations found with file:line refs
- [ ] Code snippets are ACTUAL (from codebase, not invented)

---

## Phase 3: RESEARCH - External Documentation

**ONLY AFTER Phase 2 is complete.**

Use Task tool with `subagent_type="prp-core:web-researcher"`:

```
Research external documentation relevant to implementing: [feature description].

FIND:
1. Official documentation for involved libraries (match versions from package.json: [list deps])
2. Known gotchas, breaking changes, deprecations for these versions
3. Security considerations and best practices
4. Performance optimization patterns

Return findings with direct links, key insights, gotchas, and conflicts with codebase patterns.
```

Format findings as versioned references with URL anchors and APPLIES_TO notes.

**PHASE_3_CHECKPOINT:**
- [ ] `prp-core:web-researcher` agent completed
- [ ] Documentation versions match package.json
- [ ] URLs include specific section anchors
- [ ] Gotchas documented with mitigation strategies

---

## Phase 4: DESIGN - UX Transformation

Create ASCII before/after diagrams showing the user experience transformation.
Document interaction changes in a table: Location · Before · After · User Impact.

**PHASE_4_CHECKPOINT:**
- [ ] Before state accurately reflects current behavior
- [ ] After state shows all new capabilities
- [ ] Data flows are traceable
- [ ] User value is explicit and measurable

---

## Phase 5: ARCHITECT - Strategic Design

For complex features: use `prp-core:codebase-analyst` to trace architecture at integration points.

Then document:
- `APPROACH_CHOSEN` and rationale
- `ALTERNATIVES_REJECTED` with specific reasons
- `NOT_BUILDING` — explicit scope limits

**PHASE_5_CHECKPOINT:**
- [ ] Approach aligns with existing architecture
- [ ] Dependencies ordered correctly
- [ ] Edge cases identified with mitigations
- [ ] Scope boundaries explicit and justified

---

## Phase 6: GENERATE - Implementation Plan File

**OUTPUT_PATH**: `.claude/PRPs/plans/{kebab-case-feature-name}.plan.md`

Create directory if needed: `mkdir -p .claude/PRPs/plans`

The plan must include all standard prp-core sections PLUS these intelligence sections:

<!-- ─────────────────────────────────────────────────────────────────
     ADDED SECTIONS — codebase-intelligence injects these into the
     plan template between "Summary" and "Mandatory Reading"
     ───────────────────────────────────────────────────────────────── -->

```markdown
## Intelligence Context

**Ticket**: <JIRA-TICKET> — <ticket summary>
**Branch**: <current branch>
**Memory sessions loaded**: <N sessions / none>

### Acceptance Criteria (from Jira)
<extracted AC — or "not available" if Jira MCP absent>

### QA Context (prior failures)
<summarised QA failure notes from Jira comments — or "none">

### Prior Session Decisions
<last session's "Decisions" section if available — or "none">

### Discovery Source Summary
| Category | File:Line | Source |
|----------|-----------|--------|
| <category> | <path:line> | memory / serena / socraticode / explorer / analyst |
```

<!-- End of added sections — the rest is standard prp-core plan template -->

Followed by all standard prp-core plan sections:
- User Story · Problem Statement · Solution Statement · Metadata
- UX Design (before/after ASCII diagrams)
- Mandatory Reading table
- Patterns to Mirror (with actual code snippets)
- Files to Change
- NOT Building (scope limits)
- Step-by-Step Tasks (atomic, ordered, each with VALIDATE command)
- Testing Strategy
- Validation Commands (6 levels)
- Acceptance Criteria
- Completion Checklist
- Risks and Mitigations

</process>

<!-- ═══════════════════════════════════════════════════════════════════
     POST-GENERATION — codebase-intelligence memory save
     ═══════════════════════════════════════════════════════════════════ -->

<post_generation>

## Post-Phase: SAVE — Persist to task-memory

Follow skill: `codebase-intelligence:task-memory` → **SESSION END protocol**

Append to `~/.claude/memory/{TICKET}/{BRANCH}.md`:

```markdown
## Session: <ISO date> — Planning

### Investigated
<all file:line findings from the discovery table>

### Decisions
<APPROACH_CHOSEN and scope limits from Phase 5>

### Implementation status
- [ ] Plan generated: .claude/PRPs/plans/<feature>.plan.md
- [ ] Implementation not started

### Next steps
- Run: /prp-implement .claude/PRPs/plans/<feature>.plan.md
```

</post_generation>

<o>
**OUTPUT_FILE**: `.claude/PRPs/plans/{kebab-case-feature-name}.plan.md`

**If input was from PRD file**, also update the PRD status (in-progress) and link the plan.

**REPORT_TO_USER** after creating plan:

```markdown
## Plan Created ✅

**File**: `.claude/PRPs/plans/{feature-name}.plan.md`
**Ticket**: {JIRA-TICKET} — {summary}
**Memory**: {N prior sessions loaded / fresh start}
**Jira AC**: {extracted / unavailable}
**QA Context**: {failures found / none}

**Discovery sources**:
- 📁 Memory: {N} cached findings reused
- 🔬 Serena: {N} symbols resolved
- 🧠 SocratiCode: {N} semantic matches
- 🤖 Agents: {N} patterns from explorer/analyst

**Complexity**: {LOW/MEDIUM/HIGH} — {rationale}
**Scope**: {N} files CREATE · {M} files UPDATE · {K} tasks
**Confidence**: {score}/10

**Next step**: `/prp-implement .claude/PRPs/plans/{feature-name}.plan.md`
```
</o>

<verification>
**FINAL_VALIDATION before saving plan:**

- [ ] Intelligence Context section present (ticket, memory, Jira AC, QA context)
- [ ] Discovery table has Source column and at least one memory/serena/socraticode entry
- [ ] All patterns from agents documented with actual code snippets
- [ ] External docs versioned to match package.json
- [ ] Every task has at least one executable validation command
- [ ] Tasks ordered by dependency (top-to-bottom executable)
- [ ] No placeholders — all content is specific and actionable
- [ ] Memory saved to `~/.claude/memory/{TICKET}/{BRANCH}.md`
</verification>
