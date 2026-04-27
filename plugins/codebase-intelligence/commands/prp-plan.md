---
name: prp-plan
description: >
  Enhanced prp-plan. Extends prp-core:prp-plan with: cross-session memory (session-memory),
  Jira context injection (Atlassian MCP), session-memory skill,
  personal knowledge base consultation (ask-kb + consult-kb), verified library docs (Context7), and continuous requirements grounding (drift-guard). Use exactly as prp-core:prp-plan — pass a feature description, Jira ticket, or .prd.md path.
argument-hint: <feature description | JIRA-TICKET | path/to/prd.md>
---

<objective>
Transform "$ARGUMENTS" into a battle-tested implementation plan.

**Core Principle**: PLAN ONLY — no code written. Create a context-rich document that enables
one-pass implementation success.

**Non-negotiable**: Every decision in this plan must trace to an acceptance criterion.
The drift-guard skill enforces this at every phase gate. When in doubt, do less — not more.

**Execution Order**:
MEMORY → JIRA → ANCHOR → DETECT → PARSE → EXPLORE → KB → CONTEXT7 → RESEARCH → DESIGN → ARCHITECT → GENERATE

**Skill + Agent roster**:
- `codebase-intelligence:session-memory` — prior session context
- `codebase-intelligence:drift-guard` — requirements anchor, enforced at every gate
- `codebase-intelligence:codebase-search` — Serena (LSP) + SocratiCode (semantic)
- `codebase-intelligence:ask-kb` — personal KB patterns and principles
- `codebase-intelligence:consult-kb` — KB review of proposed architecture
- `codebase-intelligence:context7-research` — verified library docs, no hallucination
- `codebase-intelligence:codebase-explorer` — WHERE code lives, implementation patterns
- `codebase-intelligence:codebase-analyst` — HOW integration points work, data flow
- `codebase-intelligence:web-search-hook` — external docs (runs AFTER Context7 + KB, gaps only)
</objective>

<context>
CLAUDE.md rules: @CLAUDE.md

**Directory Discovery**:
- `ls -la` and `ls -la */ 2>/dev/null | head -50`
- Identify project type from config files (package.json, pyproject.toml, Cargo.toml, go.mod)
- Do NOT assume `src/` exists — discover actual structure first.
</context>

<process>

<!-- ═══════════════════════════════════════════════════════════════════
     PRE-PHASES — codebase-intelligence layer
     ═══════════════════════════════════════════════════════════════════ -->

## Pre-Phase I: MEMORY — Restore prior context

Execute the session-memory skill to restore or create session context:

```
Skill(session-memory)
```

Follow the skill's SESSION START protocol:
1. Extract ticket ID from branch name or `$ARGUMENTS`
2. Load existing session from Obsidian vault (if exists)
3. Create new session with frontmatter (if new)
4. Report session status and ask user for next action

The skill handles:
- Vault-based session persistence at using Obsidian MCP `~/Documents/Obsidian-Vault/02-Notes/Sessions/`
- Frontmatter metadata (ticket, branch, date, phase, keywords, tags)
- FTS5 search index at `~/.claude/memory/{TICKET}/session_index.db`

**PRE-PHASE-I CHECKPOINT:**
- [ ] session-memory skill executed
- [ ] Session context loaded or created
- [ ] User confirmed next action

---

## Pre-Phase II: JIRA — Inject ticket context

If Atlassian MCP is available and a ticket ID was found:

1. `get_issue(ticket_id)` → full issue
2. Extract: summary, description, acceptance criteria, labels, priority, story points
3. Scan all comments for: fail, reject, QA, blocked, doesn't pass, acceptance criteria
4. QA failures found → print: "⚠️ QA failure detected ({date}): {one-line summary}"

If unavailable: skip silently, note "Jira context unavailable" in plan.

**PRE-PHASE-II CHECKPOINT:**
- [ ] Jira ticket context fetched (or skipped with note)
- [ ] Acceptance criteria captured
- [ ] QA failures identified

---

## Pre-Phase III: ANCHOR — Establish the requirements anchor

Follow skill: `codebase-intelligence:drift-guard` → The Anchor Document.

Write this now, before any discovery or design:

```
TASK ANCHOR
───────────────────────────────────────────────
Ticket:  {JIRA-TICKET}
Summary: {one-line description}
Type:    {NEW_CAPABILITY | BUG_FIX | ENHANCEMENT | REFACTOR}

Acceptance Criteria (verbatim — do not paraphrase):
  1. {AC item 1}
  2. {AC item 2}
  ...

Hard boundaries (NOT in scope):
  {to be defined in Phase 5 — placeholder for now}
───────────────────────────────────────────────
```

**This anchor is fixed for this session.** Every phase gate re-states it.

**GATE**: AC missing or vague → STOP. Ask the user to specify at least one testable AC
before continuing. A plan without clear AC will drift by definition.

**PRE-PHASE-III CHECKPOINT:**
- [ ] Anchor written with ≥1 testable AC
- [ ] AC is observable (pass/fail determinable)

---

<!-- ═══════════════════════════════════════════════════════════════════
     STANDARD PHASES — with codebase-intelligence injected at marked points
     ═══════════════════════════════════════════════════════════════════ -->

## Phase 0: DETECT - Input Type Resolution

| Input Pattern | Type | Action |
|---|---|---|
| Ends with `.prd.md` | PRD file | Parse PRD, select next pending phase |
| Ends with `.md` + "Implementation Phases" | PRD file | Parse PRD, select next pending phase |
| Existing file path | Document | Read and extract feature description |
| Free-form text | Description | Use directly |
| Empty/blank | Conversation | Use conversation context |

If PRD detected: read file, find next pending phase with dependencies complete, extract context, report to user.

**PHASE_0_CHECKPOINT:**
- [ ] Input type determined
- [ ] Feature description ready
- [ANCHOR] {ticket} — AC: {AC list}

---

## Phase 1: PARSE - Feature Understanding

Extract: core problem, user value, feature type (NEW_CAPABILITY | ENHANCEMENT | REFACTOR | BUG_FIX), complexity (LOW | MEDIUM | HIGH), affected systems.

Formulate user story:
```
As a <user type>
I want to <action/goal>
So that <benefit/value>
```

**DRIFT CHECK**: Does the user story match the TASK ANCHOR? Reconcile any mismatch now.

**PHASE_1_CHECKPOINT:**
- [ ] Problem statement specific and testable
- [ ] User story maps to ≥1 AC item
- [ ] Complexity has rationale
- [ANCHOR] {ticket} — AC: {AC list}

**GATE**: AMBIGUOUS requirements → STOP and ask before proceeding.

---

## Phase 2: EXPLORE - Codebase Intelligence

### Step 2A — Memory pre-fill

Follow `codebase-intelligence:codebase-search` → Execution flow step 1.
Mark cached areas `[FROM MEMORY]`. Only search uncached areas.

---

### Step 2B — Parallel agents (codebase-intelligence)

Launch simultaneously using multiple Task tool calls:

**Agent 1: `codebase-intelligence:codebase-explorer`**
```
Find all code relevant to: [feature description].
LOCATE: similar implementations, naming conventions, error handling patterns,
logging patterns, type definitions, test patterns, configuration, dependencies.
Return ACTUAL code snippets from codebase with file:line references.
```

**Agent 2: `codebase-intelligence:codebase-analyst`**
```
Analyze implementation details for: [feature description].
TRACE: entry points, data flow, state changes, contracts, patterns in use.
Document with precise file:line references. No suggestions or improvements.
```

---

### Step 2C — Two-tier enrichment

Follow `codebase-intelligence:codebase-search` → Execution flow steps 2–3.

- **Serena (Tier 1)**: resolve all agent-mentioned symbols to exact file:line via `find_symbol`, `get_symbol_references`
- **SocratiCode (Tier 2)**: 3 semantic queries for intent/behaviour areas, top-3 results each

---

### Step 2D — KB pattern consultation

Follow skill: `codebase-intelligence:ask-kb`.

For the primary domains touched by this feature:
> "What patterns and principles apply to {feature/domain}?"
> "Are there documented anti-patterns for {primary approach}?"

If KB has relevant content → add `## KB Principles` section to discovery notes.
If KB is silent → note "KB not consulted for this domain" and continue.

---

### Step 2E — Merge into unified discovery table

| Category | File:Lines | Pattern Description | Code Snippet | Source |
|---|---|---|---|---|
| NAMING | `src/X/service.ts:10` | camelCase functions | `export function createThing()` | explorer |
| ERRORS | `src/X/errors.ts:5` | Custom error classes | `class ThingNotFoundError` | serena |
| FLOW | `src/X/service.ts:40` | Transform chain | `input→validate→persist` | analyst |
| SEMANTIC | `src/Y/handler.ts:80` | Related auth logic | `validateToken(req)` | socraticode |
| MEMORY | `src/Z/service.ts:30` | Prior finding | `parseDocument()` entry | memory |
| KB | — | Principle | "Prefer explicit error types" | ask-kb |

Source values: `explorer` · `analyst` · `serena` · `socraticode` · `memory` · `ask-kb`

---

**DRIFT CHECK (drift-guard questions #1, #2, #5)**:
For every row: "Does changing this file serve ≥1 AC item?"
Remove rows that don't trace to any AC. Label them "Removed — out of scope."

**PHASE_2_CHECKPOINT:**
- [ ] Memory pre-fill checked
- [ ] Both codebase-intelligence agents completed in parallel
- [ ] Serena + SocratiCode enrichment done
- [ ] KB consulted (result documented)
- [ ] Discovery table has Source column
- [ ] **DRIFT**: Every file in table traces to ≥1 AC
- [ANCHOR] {ticket} — AC: {AC list}

---

## Phase 3: RESEARCH - External Documentation

**Only after Phase 2. Codebase patterns come first.**

### Step 3A — Context7 library verification

Follow skill: `codebase-intelligence:context7-research`.

For every external library used in the implementation:
1. Read exact version from `package.json` (or equivalent)
2. `context7 → resolve-library-id` for the library
3. `context7 → get-library-docs` for the specific API area needed
4. Document confirmed signatures and gotchas

Add `## Context7 Library Facts` section to notes. Flag any API discrepancies with the plan.

### Step 3B — KB research check

Follow skill: `codebase-intelligence:ask-kb`.

For each topic to research, check KB first:
> "Does my KB already cover {topic} best practices or patterns?"

If KB covers it → use it, skip web search for that topic.
If KB is silent → proceed to web-researcher for that topic.

### Step 3C — Web researcher (gaps only)

Use Task tool `subagent_type="codebase-intelligence:web-researcher"` for topics NOT covered by Context7 or KB:

```
Research documentation for: [feature description].

Already verified via Context7: [libraries + confirmed API signatures].
Already covered by KB: [topics with KB source].

FIND for uncovered topics only:
1. Best practices and usage patterns
2. Gotchas not visible in API docs
3. Security considerations
4. Performance patterns

Return: direct doc links, key insights, gotchas with mitigations.
Do not re-document what Context7 or KB already covered.
```

**DRIFT CHECK (drift-guard question #5)**:
"Did research introduce scope not in the original AC?"
If yes → label "Future consideration: {topic}", do NOT include in the plan.

**PHASE_3_CHECKPOINT:**
- [ ] Context7 run for all external libraries
- [ ] Confirmed signatures in `Context7 Library Facts` section
- [ ] KB consulted for research topics
- [ ] Web researcher run for remaining gaps only
- [ ] **DRIFT**: No research-introduced scope in plan
- [ANCHOR] {ticket} — AC: {AC list}

---

## Phase 4: DESIGN - UX Transformation

Create ASCII before/after diagrams. Document interaction changes: Location · Before · After · User Impact.

**DRIFT CHECK (drift-guard question #3)**:
"Is the after-state more complex than the AC requires?"
If yes → simplify to the minimum that satisfies AC.

**PHASE_4_CHECKPOINT:**
- [ ] Before state accurate
- [ ] After state = minimum that satisfies AC (no more)
- [ ] Data flows traceable

---

## Phase 5: ARCHITECT - Strategic Design

For complex features: use `codebase-intelligence:codebase-analyst` to trace architecture at integration points.

### KB architecture review

Follow skill: `codebase-intelligence:consult-kb`.

Run the proposed approach against the KB:
> "Does this architecture violate documented principles or known anti-patterns?"

Document as: 🔴 Violation / 🟡 Tension / 🟢 Aligned / 💡 Suggestion

Then document:
- `APPROACH_CHOSEN` with rationale (cite codebase patterns AND KB principles)
- `ALTERNATIVES_REJECTED` with specific reasons
- `NOT_BUILDING` — explicit scope exclusions (update TASK ANCHOR boundaries now)

**DRIFT CHECK — full seven questions (drift-guard)**:
Run all seven questions against the proposed approach and file list.
Verdict MUST be ✅ ON TRACK before proceeding.

**PHASE_5_CHECKPOINT:**
- [ ] Approach aligns with codebase patterns AND KB principles
- [ ] KB review: violations/tensions documented
- [ ] Alternatives rejected with reasons
- [ ] NOT_BUILDING is explicit
- [ ] TASK ANCHOR boundaries updated
- [ ] **DRIFT**: Full seven-question check → ✅ ON TRACK
- [ANCHOR] {ticket} — AC: {AC list}

---

## Phase 6: GENERATE - Implementation Plan File

**HIERARCHY CHECK** — Before saving, list the target folder to confirm placement:
```
mcp__ultimate-obsidian__list_vault({ path: "02-Notes/Plans" })
```
Review existing plan names to ensure consistent kebab-case naming with no duplicates.

**OUTPUT_PATH**: Save via Obsidian MCP — do NOT use Write tool or bash:
```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Plans/{kebab-case-feature-name}.plan.md",
  content: "..."
})
```

**FRONTMATTER_TEMPLATE**: Include at the start of every plan file:
```yaml
---
title: {kebab-case-feature-name}
created: {YYYY-MM-DD}
source: Planning session (vault-native)
project: claude-code-toolkit
tags:
  - prp
  - claude-code-toolkit
  - plan
  - {feature-category}
---
```

---

### Intelligence Context section (add after Summary)

```markdown
## Intelligence Context

**Ticket**: {JIRA-TICKET} — {summary}
**Branch**: {branch}
**Memory sessions loaded**: {N / none}

### Acceptance Criteria (authoritative — do not deviate from these)
1. {verbatim AC 1}
2. {verbatim AC 2}

### QA Context (prior failures)
{QA failure notes — or "none"}

### Hard boundaries (NOT in scope)
- {item from NOT_BUILDING}

### KB Principles applied
- {principle} — *Source: {book/section}*
- {KB violation or tension noted} — *Source: {book/section}*

### Context7 Library Facts
#### {library}@{version}
- `functionName(param: Type): ReturnType` — confirmed ✅
- Gotcha: {gotcha from docs}

### Prior session decisions
{last session Decisions section — or "none"}

### Discovery source summary
| Category | File:Line | Source |
|---|---|---|
```

---

### AC Traceability table (add after Files to Change)

```markdown
## AC Traceability

Every AC must have ≥1 task. Every task must map to ≥1 AC.

| AC Item | Tasks |
|---|---|
| {AC 1 verbatim} | Task 3, Task 5 |
| {AC 2 verbatim} | Task 7 |
```

**DRIFT CHECK (drift-guard question #7)**:
Any AC without a task → add the task NOW before finishing the plan.
Any task without an AC mapping → remove it or justify it explicitly.

---

Then all standard plan sections:
User Story · Problem Statement · Solution Statement · Metadata · UX Design (before/after ASCII) ·
Mandatory Reading · Patterns to Mirror · Files to Change · NOT Building · Step-by-Step Tasks ·
Testing Strategy · Validation Commands (6 levels) · Acceptance Criteria checklist ·
Completion Checklist · Risks and Mitigations

</process>

<post_generation>

## Post-Phase: SAVE — Persist to session-memory

Execute the session-memory skill to save the planning session:

```
Skill(session-memory)
```

Follow the skill's SESSION END protocol to append this planning session:

```markdown
## Session: {ISO date} — Planning

### Investigated
{file:line findings from discovery table}

### Decisions
{APPROACH_CHOSEN, scope exclusions}

### KB findings
{violations, tensions, principles applied, consult-kb results}

### Context7 findings
{confirmed library signatures}

### Implementation status
- [ ] Plan saved via `mcp__ultimate-obsidian__create_or_update_note` to `02-Notes/Plans/{feature}.plan.md`
- [ ] Implementation not started

### Drift decisions
{any drift detected and resolved — or "none"}

### Next steps
- /codebase-intelligence:prp-implement ~/Documents/Obsidian-Vault/02-Notes/Plans/{feature}.plan.md
```

The skill will:
- Append session to `~/Documents/Obsidian-Vault/02-Notes/Sessions/{TICKET}-{BRANCH}.md`
- Extract and update keywords in frontmatter
- Rebuild FTS5 index at `~/.claude/memory/{TICKET}/session_index.db`

</post_generation>

<o>
**OUTPUT_FILE**: `~/Documents/Obsidian-Vault/02-Notes/Plans/{kebab-case-feature-name}.plan.md`

If PRD input: update phase status to `in-progress`, link plan.

**REPORT_TO_USER**:

```markdown
## Plan Created ✅

**File**: using Obsidian MCP `~/Documents/Obsidian-Vault/02-Notes/Plans/{feature-name}.plan.md`
**Ticket**: {JIRA-TICKET} — {summary}

### Requirements grounding
- AC items: {N} captured ✅
- AC traceability: all items covered ✅
- Drift checks passed: {N} gates ✅
- Drift removals: {N} items removed from scope

### Knowledge sources
- 📁 Memory: {N} cached findings
- 🔬 Serena: {N} symbols resolved
- 🧠 SocratiCode: {N} semantic matches
- 📚 KB ask-kb: {N} principles applied
- 📚 KB consult-kb: {violations}/{tensions} found
- 📖 Context7: {N} libraries, {N} signatures confirmed
- 🌐 Web researcher: {N} gap topics

**Complexity**: {LOW/MEDIUM/HIGH} · **Confidence**: {score}/10

**Next**: `/codebase-intelligence:prp-implement ~/Documents/Obsidian-Vault/02-Notes/Plans/{feature-name}.plan.md`
```
</o>

<verification>
- [ ] Intelligence Context section present (ticket, AC verbatim, KB, Context7, QA)
- [ ] AC Traceability table complete — every AC has ≥1 task
- [ ] Every task maps to ≥1 AC — no orphan tasks
- [ ] Context7 Library Facts present for all external libraries
- [ ] KB principles cited for architectural decisions
- [ ] NOT Building is specific and non-empty
- [ ] All patterns from agents are ACTUAL code snippets (not invented)
- [ ] Every task has an executable validation command
- [ ] Drift guard: seven-question check ✅ ON TRACK at Phase 5
- [ ] Session saved via session-memory skill to vault
- [ ] Return REPORT_TO_USER with the next command so the user knows what to do next when clearing the session.
</verification>
