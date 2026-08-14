---
name: prp-plan
description: >
  Transforms a feature description, Jira ticket, or PRD into an implementation plan with session memory, Jira injection, KB consultation, Context7 verification, and drift-guard at every phase gate.
  Pass a feature description, JIRA-TICKET, or path/to/prd.md.
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
- `codebase-intelligence:codebase-search` — Serena (LSP structural)
- `codebase-intelligence:ask-kb` — personal KB patterns and principles
- `codebase-intelligence:consult-kb` — KB review of proposed architecture
- `codebase-intelligence:context7-research` — verified library docs, no hallucination
- `codebase-intelligence:codebase-explorer` — WHERE code lives, implementation patterns
- `codebase-intelligence:codebase-analyst` — HOW integration points work, data flow
- `codebase-intelligence:web-search-hook` — external docs (runs AFTER Context7 + KB, gaps only)
</objective>

## Model capability (read first)

Tier semantics, the PRP invariant set, the evidence-first rule, and Model Routing: `../shared/model-tier.md`.

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

`Skill(codebase-intelligence:session-memory)` → SESSION START protocol.

```
Skill(session-memory)
```

Follow the skill's SESSION START protocol:
1. Extract ticket ID from branch name or `$ARGUMENTS`. If no ticket found, derive from git root: `basename $(git rev-parse --show-toplevel 2>/dev/null || pwd)`
2. Build session filename suffix: if branch is non-descriptive (main/master/develop/development/HEAD/trunk), slugify $ARGUMENTS → first 4–5 words, kebab-case (e.g. "add pdf export" → "add-pdf-export"). Else use branch name (strip ticket prefix).
3. Load existing session from Obsidian vault (if exists)
4. Create new session with frontmatter (if new)
5. Report session status and ask user for next action

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

If Atlassian MCP available and ticket ID found: `get_issue(ticket_id)` → extract summary, description, AC, labels, priority. Scan comments for: fail, reject, QA, blocked, doesn't pass. Print QA failures as `⚠️ QA failure ({date}): {summary}`. If unavailable: note and skip.

**PRE-PHASE-II CHECKPOINT:** Jira fetched (or skipped) · AC captured · QA failures noted

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

**GATE**: AMBIGUOUS requirements → STOP and ask before proceeding.

---

## Phase 1.5: UNKNOWNS - Enumerate and route open questions

Before any exploration, enumerate EVERY open question the AC does not resolve. For each unknown, classify and route it:

| Unknown type | Route |
|---|---|
| Library / API behaviour or signature | Context7 verification (Phase 3A) |
| Codebase pattern / "how do we do X here" | ask-kb (Step 2D) + codebase search (Phase 2) |
| Requirement / product intent (what should it do) | STOP + ask the user — do not guess |

Anything still unresolved after routing is logged **verbatim** as an explicit assumption in the `## Intelligence Context` section (Phase 6) under the "Assumptions (unresolved unknowns)" list. Never silently resolve an unknown by inventing an answer.

**GATE**: A requirement-type unknown is blocking → STOP and ask the user before proceeding to Phase 2.

**PHASE_1.5_CHECKPOINT:**
- [ ] Every unknown enumerated
- [ ] Each unknown routed (library/API→Context7 · pattern→ask-kb · requirement→STOP+ask user)
- [ ] every unknown resolved or logged as assumption

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

### Step 2C — Serena enrichment

Follow `codebase-intelligence:codebase-search` → Execution flow steps 2–3.

- **Serena (LSP)**: resolve all agent-mentioned symbols to exact file:line via `find_symbol`, `get_symbol_references`

---

### Step 2D — KB pattern consultation

Follow skill: `codebase-intelligence:ask-kb`.

For the primary domains touched by this feature:
> "What patterns and principles apply to {feature/domain}?"
> "Are there documented anti-patterns for {primary approach}?"

If KB has relevant content → add `## KB Principles` section to discovery notes.
If KB is silent → note "KB not consulted for this domain" and continue.

---

### Step 2E-i — Collect evidence

Gather raw evidence ONLY — File:Lines, Code Snippet, Source. NO conclusions, NO pattern naming, NO drift verdicts at this step.

| Category | File:Lines | Code Snippet | Source |
|---|---|---|---|
| NAMING | `src/X/service.ts:10` | `export function createThing()` | explorer |
| ERRORS | `src/X/errors.ts:5` | `class ThingNotFoundError` | serena |
| FLOW | `src/X/service.ts:40` | `input→validate→persist` | analyst |
| SEMANTIC | `src/Y/handler.ts:80` | `validateToken(req)` | serena |
| MEMORY | `src/Z/service.ts:30` | `parseDocument()` entry | memory |
| KB | — | "Prefer explicit error types" | ask-kb |

Source values: `explorer` · `analyst` · `serena` · `memory` · `ask-kb`

### Step 2E-ii — Interpret

Only now interpret the collected evidence. Add a Pattern Description and a drift verdict per row (do not add rows that were not collected in 2E-i).

| Category | File:Lines | Pattern Description | Drift verdict | Source |
|---|---|---|---|---|
| NAMING | `src/X/service.ts:10` | camelCase functions | in-scope | explorer |
| ERRORS | `src/X/errors.ts:5` | Custom error classes | in-scope | serena |
| FLOW | `src/X/service.ts:40` | Transform chain | in-scope | analyst |
| SEMANTIC | `src/Y/handler.ts:80` | Related auth logic | in-scope | serena |
| KB | — | Principle | in-scope | ask-kb |

---

**DRIFT CHECK (drift-guard questions #1, #2, #5)**:
For every row: "Does changing this file serve ≥1 AC item?"
Remove rows that don't trace to any AC. Label them "Removed — out of scope."

**PHASE_2_CHECKPOINT:**
- [ ] Memory pre-fill checked
- [ ] Both codebase-intelligence agents completed in parallel
- [ ] Serena enrichment done
- [ ] KB consulted (result documented)
- [ ] Discovery table has Source column
- [ ] **DRIFT**: Every file in table traces to ≥1 AC

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

### Constitution check — the Phase -1 gates (run BEFORE the design is final)

Load the project constitution (`.claude/constitution.md`, or the preset's `constitution:` path). Absent
⇒ this whole subsection is a silent no-op. Present ⇒ run its three gates against the proposed design
and record the verdict **with evidence**, not adjectives:

```
G-SIMPLICITY       : ✅|⚠️|🔴 — new components: {list}
G-ANTI-ABSTRACTION : ✅|⚠️|🔴 — wrappers introduced: {name} · second consumer: {named, or none}
G-INTEGRATION-FIRST: ✅|⚠️|🔴 — contracts: {list} · contract tests failing first: {yes/no}
```

A 🔴 on a **ratified** constitution has exactly two legal resolutions: **change the design**, or
**carry the violation with a complete Complexity Tracking row**. Deleting the principle, widening a
threshold, or reclassifying a MUST as a SHOULD *in order to pass* is itself a 🔴 and a drift-guard Q5
failure — the same rule that forbids loosening a lint severity to clear the pre-PR gate. A `draft`
constitution produces ⚠️ only and blocks nothing.

Emit into the plan (empty table = the healthy state; all three columns mandatory):

```markdown
## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| 4th package `sync-worker` | back-pressure needs its own lifecycle | in-process queue loses jobs on deploy; measured 3% loss in staging |
```

"We needed it" is not an argument — it is the claim being tested. Name a **specific** simpler
alternative and a **concrete** reason it fails (a measurement, a hard constraint, a named requirement).

### Cross-boundary contracts (what the lanes must agree on before anyone writes code)

Identify every interface that crosses a boundary — a shared type, an endpoint request/response shape,
a DB schema delta, an event payload — and emit it as a first-class plan artifact:

```markdown
## Contracts

| id | interface | file | provides | consumes | contract test |
|---|---|---|---|---|---|
| K1 | `LastLoginPayload` | packages/core/src/types/user.ts | core-db | backend, frontend | `npm run test:run -- contracts/last-login` |
```

Write the contract files and their tests as **the first tasks in the plan**, ordered before any task
that consumes them, and require each contract test to **fail** against the pre-change code. A contract
test that is green before the feature exists is testing nothing. `/prp-orchestrate` freezes this set
before any worktree forks; `prp-implement` simply builds it first.

A contract with **no consumer** is a speculative interface — delete it (G-SIMPLICITY).

### Danger-zone paths

If any file in Files-to-Change lives under an **auth / payments / api / deploy** path, emit a line recommending a **localized CLAUDE.md** (or an inline warning comment) at that path documenting the constraint. Surface this recommendation as a **GOTCHA** on the relevant task so prp-implement loads it at its Step 3.0 (danger zone). Example:
> GOTCHA (danger zone): `src/payments/charge.ts` — add/update a localized CLAUDE.md here; idempotency keys required, never retry a charge blindly.

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

---

## Phase 6: GENERATE - Implementation Plan File

**GATE (blocking unknown)**: GENERATE refuses to produce the plan while any blocking (requirement-type) unknown from Phase 1.5 remains open. Resolve it with the user, or log it verbatim as an explicit assumption, before generating.

**Write protocol** — scrub, HIERARCHY CHECK, MCP-only write, month bucket, typed frontmatter, and the
omit-dangling-key rule are all `../shared/vault-persistence.md`. On the hierarchy check, also review the
existing plan names so this one stays consistent kebab-case with no duplicate.

**OUTPUT_PATH**: `02-Notes/Plans/{YYYY-MM}/{kebab-case-feature-name}.plan.md`, mode `overwrite`.

**FRONTMATTER_TEMPLATE**: Include at the start of every plan file:
```yaml
---
title: {kebab-case-feature-name}
type: plan
created: {YYYY-MM-DD}
schema_version: 1
source: Planning session (vault-native)
project: {project-root-name}
up: "[[{TICKET}]]"
implements: "[[{slug}.refinement]]"
tags:
  - prp
  - {project-root-name}
  - plan
  - {feature-category}
---
```

**This plan's typed relations** (semantics + the omit-dangling-key rule:
`../shared/vault-persistence.md`):

- `up` → the ticket node `03-Systems/tickets/{TICKET}.md`, else the project's subject MOC.
- `implements` → the refinement contract this plan was planned from (Step R), when there is one.
- `affects` → `03-Systems/` service / table nodes the plan will change, **only** those you can name from
  the Files-to-Change list. Do not guess at systems.

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

### Assumptions (unresolved unknowns)
- {unknown logged verbatim from Phase 1.5 — or "none"}

### KB Principles applied
- {principle} — *Source: {book/section}*
- {KB violation or tension noted} — *Source: {book/section}*

### Context7 Library Facts

**Constraint**: This section — and any KB signature block — may present ONLY Phase-3-confirmed signatures. Any API you need but did NOT verify in Phase 3 must be written literally as "UNVERIFIED — confirm at implement time". Never invent a signature and never present an unverified one as confirmed.

#### {library}@{version}
- `functionName(param: Type): ReturnType` — confirmed ✅
- `maybeOtherApi(...)` — UNVERIFIED — confirm at implement time
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

Every requirement must have ≥1 task. Every task must map to ≥1 requirement.

| Requirement | Story | Tasks | Gate |
|---|---|---|---|
| FR-001 {verbatim} | US1 (P1) | T003, T005 | `npm run test:run -- login` |
| SC-002 {verbatim} *(buildable)* | — | T009 | `npm run bench -- profile-p95` |
| US1/AC2 {verbatim} | US1 (P1) | T007 | `npm run test:run -- profile` |
```

When the input came from a `spec.md`, list **every** `FR-###`, every **buildable** `SC-###`, and every
acceptance scenario. `outcome`-tagged SCs (post-launch metrics, business KPIs) are tracked in the spec
and never become tasks — do not list them as uncovered work.

**DRIFT CHECK (drift-guard question #7)**:
Any requirement without a task → add the task NOW before finishing the plan.
Any task without a requirement mapping → remove it or justify it explicitly.

> This table is written by the planner, so it cannot be the last word on its own coverage.
> `/prp-orchestrate` re-derives it in a fresh context via `Skill(spec-analyze)` before any code is
> written — a gap found there routes back here, not into a worktree.

---

### Task template (Step-by-Step Tasks)

**Core Principle**: the plan is one complete brief — every task is self-contained and assumes NO unlogged chat context. An executor reading only this file must be able to complete the task.

Each task MUST carry:
- **Why (AC + intent):** which AC this task serves + the intent behind it (not just the mechanical step).
- **MIRROR:** the existing pattern / `file:line` to imitate.
- **IMPORTS:** the exact imports/modules required.
- **AC mapping:** the AC item id(s) this task satisfies.
- **Expected gate command:** the executable command that verifies this task passes (e.g. `pnpm test path/to.spec.ts`, `grep -q "symbol" file`).
- **Gotchas:** known traps, danger-zone warnings, ordering constraints.
- **Steps:** explicit, numbered implementation steps.

By default, keep explicit, detailed, prescriptive steps. If the executor is a confirmed top-tier long-horizon model (per Model Routing, below), tasks MAY be expressed as goal+constraints instead of prescriptive micro-steps; otherwise keep explicit steps.

**Parallel execution note**: lanes are single-writer-per-file — no two parallel tasks may write the same file. Assign each file to exactly one lane.

Three fields make that mechanical instead of aspirational, and downstream consumers depend on all
three: `/prp-orchestrate` **derives each lane's territory from the union of its tasks' `files:`** (which
is what lets `spec-analyze` *prove* disjointness rather than trust an assertion), slices rounds by
`story:`, and schedules concurrency by `parallel:`.

```
task:
  id: T{n}
  title: {imperative summary}
  story: US1                     # owning user story from spec.md (or `foundational` for shared groundwork)
  parallel: true|false           # [P] — no shared file and no dependency on another in-flight task
  files: [src/auth/session.ts]   # EXACT paths this task writes. Union per lane == that lane's territory.
  why: {FR-id + intent}          # Why (requirement + intent)
  ac_mapping: [FR-001, US1/AC2, SC-002]
  mirror: `src/X/service.ts:10` — {pattern}
  imports: [ ... ]
  expected_gate: `{executable command}`
  gotchas: [ {trap or danger zone} ]
  steps:
    1. ...
    2. ...
```

**Order tasks so the plan is deliverable in slices**: contract tasks first, then the `foundational`
tasks every story needs, then all of `US1`'s tasks (P1 — the MVP), then `US2`'s, and so on. Keep the
foundational block as small as it can be: everything parked there blocks every story, so work only P2
needs belongs to P2's slice. A plan ordered this way can be stopped after any story and still leave
something that works.

---

### Model Routing

Definition, tier meanings, and the single-tier fallback: `../shared/model-tier.md`. It used to be
defined here and referenced from elsewhere, which made a command file the owner of a rule that fifteen
files depend on.

What this phase owns: **tag every generated task with its blast radius**, so the downstream executor can
route it without re-deriving the risk.

```
Blast radius: green|yellow|red
```

A `red` task additionally carries the human gate into the plan — `prp-implement` stops on it rather
than routing around it with a stronger model.

---

### Worktree note (add to every generated plan)

Emit this one-line note in the plan (under Metadata or the Completion Checklist) so the downstream
implementer knows the execution environment:

```markdown
> **Execution environment**: implementation runs inside a fresh git worktree on a new branch off
> the detected base branch (via `Skill(codebase-intelligence:worktree-lifecycle)` → ENTER), and the
> worktree is torn down on user satisfaction (EXIT: save-before-delete, confirm-before-remove).
> Falls back to an in-place branch if worktree support is unavailable.
```

---

Then all standard plan sections:
User Story · Problem Statement · Solution Statement · Metadata · UX Design (before/after ASCII) ·
Mandatory Reading · Patterns to Mirror · **Constitution Check** · **Complexity Tracking** ·
**Contracts** · Files to Change · NOT Building · Step-by-Step Tasks · **AC Traceability** ·
Testing Strategy · Validation Commands (6 levels) · Acceptance Criteria checklist ·
Completion Checklist · Risks and Mitigations

### Repo copy of the planning artifacts (dual-write)

The vault copy stays the searchable index. **Also** write the plan into the working repo so intent
ships in the PR next to the code and a teammate can review both in one diff:

```
specs/<TICKET-or-slug>/
├── spec.md                  # the refinement contract (written by Skill(refinement))
├── plan.md                  # this file
├── tasks.md                 # the Step-by-Step Tasks block, standalone (checkboxes; converge appends here)
├── contracts/               # the cross-boundary interfaces + their contract tests
└── checklists/requirements.md
```

Skip the repo copy when the caller passed `--no-repo-specs`, when the preset sets
`spec_artifacts: vault`, or when the repo is not the artifact's subject (a planning-only run). Default
is **both**. Never write into a repo you were not asked to change.

</process>

<post_generation>

## Post-Phase: SAVE — Persist to session-memory

`Skill(codebase-intelligence:session-memory)` → SESSION END protocol. Include: Investigated (file:line findings), Decisions (APPROACH_CHOSEN + scope exclusions), KB findings (violations/tensions/principles), Context7 findings (confirmed signatures), Drift decisions, Implementation status (plan path + "not started"), Next steps (prp-implement command).

</post_generation>

<o>
**OUTPUT_FILE**: `~/Documents/Obsidian-Vault/02-Notes/Plans/{YYYY-MM}/{kebab-case-feature-name}.plan.md` (saved via Obsidian MCP — the month bucket, per `../shared/vault-persistence.md`)

If PRD input: update phase status to `in-progress`, link plan.

**REPORT_TO_USER**: Report plan file path, ticket, complexity/confidence score, AC count, drift gates passed, source counts (Memory/Serena/KB/Context7/Web), and next command:
`/codebase-intelligence:prp-implement ~/Documents/Obsidian-Vault/02-Notes/Plans/{YYYY-MM}/{feature-name}.plan.md`
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
- [ ] Each task carries Why (requirement + intent), MIRROR, IMPORTS, AC mapping, expected gate command, and gotchas
- [ ] Each task carries `story:`, `parallel:`, and exact `files:` — the fields territory derivation and slicing depend on
- [ ] Tasks ordered contracts → foundational → US1 → US2 …, so the plan is deliverable in slices
- [ ] Constitution Check ran (or was a documented no-op); every carried violation has a complete 3-column Complexity Tracking row
- [ ] Contracts table lists every cross-boundary interface, each with a consumer and a contract test that fails first
- [ ] Brief-completeness: no task assumes unlogged chat context.
- [ ] no unverified API signature presented as confirmed.
- [ ] Every blocking unknown from Phase 1.5 is resolved or logged as an assumption
- [ ] Drift guard: seven-question check ✅ ON TRACK at Phase 5
- [ ] Session saved via session-memory skill to vault
- [ ] Return REPORT_TO_USER with the next command so the user knows what to do next when clearing the session.
</verification>
