# codebase-intelligence

Intelligence layer for prp-core. Adds memory, KB, Context7, and drift-guard to
`prp-plan` and `prp-implement` without removing any original prp-core logic.
v3.3.0 adds `prp-loop`: a bounded closed-loop runner with contract-mandated stop
rules and an independent verifier. v3.4.0 makes the loop self-improving: an optional
context-isolating subagent for each attempt (toggled per session), promotion of recurring
or gamed failures to durable `## Loop Constraints`, and a verifier that escalates scrutiny
with attempt count (grounded in `02-Notes/Telegram-Inbox/2026-06-18-*`).
v3.5.0 folds in 27 model-agnostic techniques mined from the `x-intel-2026-07` KB (52 sources),
making every skill work without Fable-5. Highlights: an UNKNOWNS discovery gate and a Model
Routing block in `prp-plan`; pasted-proof AC verification and per-task behavioral gates in
`prp-implement`; budget / wall-clock / accept-rate stops, a `green|yellow|red` blast-radius tier
(red always routes to a human gate), a deterministic drift pre-scan, dual-grade OUTCOME/TRAJECTORY
verdicts, and re-verified `## Verified Invariants` in `prp-loop`; and 5-stage segmented memory with
a write-before-stop gate plus an executable pre-write secret scrub in `session-memory`. Every
model-tier / effort / routing / worktree feature is capability-gated with a documented single-tier
no-op fallback — no single model is a dependency. Read `CI_MODEL_TIER` (`frontier|standard|light`,
default `standard`) to trade instruction verbosity for capability while keeping all invariants
mandatory at every tier.

---

## Phase injection map — prp-plan

```
Pre-Phase I    → session-memory: load 02-Notes/Sessions/<TICKET>-<branch>.md via Obsidian MCP
Pre-Phase II   → Atlassian MCP: Jira ticket, AC, QA failure comments
Pre-Phase III  → drift-guard: TASK ANCHOR with verbatim AC (GATE if AC missing)

Phase 0 gate   → [ANCHOR] re-stated
Phase 1 gate   → drift-guard: user story maps to ≥1 AC?

Phase 2:
  Step 2A      → session-memory: cache pre-fill
  Step 2B      → codebase-intelligence:codebase-explorer (enhanced — Serena + SocratiCode + KB)
               + codebase-intelligence:codebase-analyst (enhanced — Serena LSP-verified entry points)
  Step 2C      → codebase-search: Serena + SocratiCode enrichment (fills gaps agents missed)
  Step 2D      → ask-kb: personal KB patterns for feature domain
  Step 2E gate → drift-guard Q#1,2,5: every file must trace to ≥1 AC

Phase 3:
  Step 3A      → context7-research: verify all library APIs first
  Step 3B      → ask-kb: check KB before sending to web-researcher
  Step 3C      → codebase-intelligence:web-researcher (KB pre-check + Context7 + web for gaps)
  Gate         → drift-guard Q#5: no research-introduced scope in plan

Phase 4 gate   → drift-guard Q#3: after-state = minimum that satisfies AC

Phase 5:
  KB review    → consult-kb: architecture against KB principles (🔴/🟡/🟢/💡)
  Gate         → drift-guard: full 7 questions → ✅ ON TRACK required

Phase 6 plan:
  Added        → Intelligence Context section (ticket, AC verbatim, KB, Context7, QA)
  Added        → AC Traceability table (every AC → ≥1 task, every task → ≥1 AC)
  Gate         → drift-guard Q#7: every AC has a task?

Post-gen       → session-memory: save planning session
```

## Phase injection map — prp-implement

```
Pre-Phase I    → session-memory: restore prior context + task completion state
Pre-Phase II   → drift-guard: load TASK ANCHOR from plan

Per-task (Phase 3):
  3.0          → session-memory: per-file cache pre-load
  3.0b         → context7-research: pre-load confirmed library signatures
  3.1 (EVERY)  → drift-guard Q#1,4: before EVERY task — "which AC? adding anything extra?"
  3.3          → context7-research: verify API before writing library call
  3.4          → ask-kb: KB pattern for non-trivial implementation decisions
  3.7          → drift-guard: "while I'm here" stop signal
  3.8          → session-memory: save every ~3 tasks (crash-safe)

Phase 4.5      → drift-guard final gate: every AC verified with a named test

Phase 5.2 report:
  Added        → Intelligence Summary (memory, Context7, KB, drift stats)
  Added        → AC coverage table (every AC with test name and result)

Phase 5.5      → session-memory: final save (Context7 + KB findings preserved for future sessions)
```

## Loop capability — prp-loop (v3.4.0)

Closed-loop runner: re-attempts a goal until an executable gate passes AND an
independent fresh-context verifier confirms it — or a hard stop fires. Design
grounded in the loop-engineering corpus (`02-Notes/Telegram-Inbox/2026-06-10-*`):
minimum viable loop = one skill + one state file + one gate, maker-checker split,
hard stops mandatory.

```
Pre-Phase I    → session-memory: restore LOOP CONTRACT + Loop Ledger + Loop Constraints (resume at n+1)
Pre-Phase II   → loop-contract: 4-condition pre-check + contract (GATE: 🔴 NO GATE = refuse)
Pre-Phase III  → anchor: AC from plan's Intelligence Context, or contract Objective
Pre-Phase IV   → subagent mode: ask once (enable/disable attempt delegation), persist to contract

Phase L (per attempt):
  L.1          → drift-guard Q#1,4 — drift counts as a FAILED attempt (consumes budget)
  L.2          → contract + Loop Constraints reread (both decay across iterations)
  L.3          → ATTEMPT (prp-implement task conventions; ledger-aware: never retry
                 what attempts 1..n-1 already failed; optional fresh-context subagent if enabled)
  L.4          → GATE: contract's executable command, binary exit code
  L.5          → VERIFY: fresh-context sub-agent; sees contract + gate output + diff + attempt n
                 ONLY — never the maker's reasoning; checks vacuous passes, gamed gates, overfit;
                 scrutiny rises with n
  L.6          → session-memory: Loop Ledger row (durable state in vault)
  L.6b         → PROMOTE: recurring/gamed failure → durable Loop Constraints (self-improving)
  L.7          → DECIDE: success | MAX_ITER (default 5) | NO_PROGRESS (2 identical
                 failures) | CONTEXT_CAP (40%) | HUMAN_GATE (irreversible actions)

Phase R        → loop report (full ledger + honest exit status) + session-memory save
```

**When to use**: closed, binary-gated work — make failing tests pass, fix lint/build,
QA-failure retry, gate-verified refactors.
**When NOT to use** (loop-contract refuses or human stays in the chair): architecture,
auth/payments, deploys, judgment-call "done", diffs nobody will read.
**Not included by design**: scheduling/cron (loop must earn trust manually first),
fleet orchestration, auto-invocation from prp-implement.

---

## drift-guard: the seven questions

Run at every phase gate and before every implementation task:

1. **REQUIREMENT TRACE** — Does this directly serve an AC?
2. **SCOPE BOUNDARY** — Is this inside the files the plan identified?
3. **COMPLEXITY BUDGET** — More complex than the problem warrants?
4. **GOLD-PLATE CHECK** — More general/flexible/elegant than AC requires?
5. **RESEARCH DRIFT** — Did research introduce scope not in the original ticket?
6. **ARCHITECTURAL DRIFT** — Architectural decisions beyond what this task needs?
7. **AC COVERAGE** — Which AC does NOT yet have a corresponding task?

Verdict: ✅ ON TRACK (all pass) · ⚠️ DRIFT RISK (1-2) · 🔴 DRIFTING (3+, STOP)

---

## Context7 anti-hallucination contract

Before any external library call is written:
1. Library version read from `package.json`
2. `context7 → resolve-library-id`
3. `context7 → get-library-docs` for the specific API topic
4. Confirmed signature documented in plan's `Context7 Library Facts` section
5. Implementation uses only confirmed signatures

If Context7 is unavailable → flag response as **unverified**.

---

## Agents

These agents shadow the prp-core equivalents. When prp-plan calls `codebase-intelligence:codebase-explorer`, it gets our version — not prp-core's.

| Agent | Extends | What's added |
|---|---|---|
| `codebase-explorer` | `prp-core:codebase-explorer` | Step 0: memory pre-fill · Step 1: Serena LSP symbol resolution · Step 3: SocratiCode semantic queries · Step 4: KB pattern lookup · Source column in every output table |
| `codebase-analyst` | `prp-core:codebase-analyst` | Step 0: memory pre-fill · Step 1: Serena-first entry point resolution · Step 3: drift-guard scope boundary check · Source column in every output table |
| `web-researcher` | `prp-core:web-researcher` | Step 0: KB pre-check (skip web for covered topics) · Step 1: Context7 library API verification · Step 3: drift-guard scope check on research findings |
| `codebase-researcher` | — (standalone) | Full pre-planning research pass combining all three tiers |

---

## MCP setup (Claude Code terminal)

All MCPs use `--scope user` — registered once, available in every project.
Run these commands in your terminal; Claude Code stores config in `~/.claude/`.

```bash
# Verify what's registered
claude mcp list

# Serena — LSP structural search
docker pull ghcr.io/oraios/serena:latest
claude mcp add serena \
  --scope user \
  --transport stdio \
  -- docker run --rm -i \
     --network host \
     -v "${HOME}/projects:/workspaces/projects" \
     ghcr.io/oraios/serena:latest \
     serena start-mcp-server --transport stdio

# SocratiCode — semantic vector search (auto-manages its own Docker stack)
claude mcp add socraticode \
  --scope user \
  --transport stdio \
  -- npx -y socraticode

# Context7 — verified library docs
claude mcp add context7 \
  --scope user \
  --transport http \
  https://mcp.context7.com/mcp

# Atlassian Jira
echo -n "email@company.com:api-token" | base64
claude mcp add atlassian \
  --scope user \
  --transport http \
  https://mcp.atlassian.com/v1/mcp \
  --header "Authorization: Basic <base64>"
```

---

## Skills

Quality and planning skills from CLAUDE.md shortcuts, now invocable as Claude Code skills:

| Skill | Source Shortcut | Phase Injection | Purpose |
|-------|-----------------|-----------------|---------|
| `product-spec` | QPO | Manual / Pre-planning | Generate comprehensive PRD from feature idea with 8-section structure |
| `technical-plan` | QPLAN | prp-plan Phase 4 (DESIGN) | Validate plan consistency with codebase patterns, minimal changes, DRY |
| `test-scenarios` | QUX | prp-plan Phase 5 (ARCHITECT) | Generate QA test cases (happy path, edge, error, performance, security) |
| `quality-review` | QCHECK | prp-implement After each task | Run full quality checklist (function + test + best practices) |
| `function-quality` | QCHECKF | prp-implement After writing function | Validate function against 20-point checklist (readability, complexity, design, types, testability, DRY, naming) |
| `test-quality` | QCHECKT | prp-implement After writing test | Validate test against 16-point checklist (structure, quality, coverage, property testing, integration) |

**Manual invocation**:
```bash
# Generate product spec
product-spec: Add LinkedIn scheduling feature

# Validate technical plan
technical-plan: path/to/plan.md

# Generate test scenarios
test-scenarios: Dark mode toggle feature

# Run comprehensive review
quality-review

# Review specific function
function-quality: path/to/file.ts:functionName

# Review test file
test-quality: path/to/test-file.spec.ts
```

**Future work**: Automatic phase injection into prp-plan/prp-implement workflows.

---

## Memory Architecture

**IMPORTANT**: As of v2.0, codebase-intelligence uses **vault-based session-memory** for all memory operations.

### Storage Location

```
~/Documents/Obsidian-Vault/02-Notes/Sessions/<TICKET>-<BRANCH>.md
```

Each session file contains:
- **Frontmatter**: ticket, branch, date, phase, keywords (auto-extracted), tags
- **Wikilinks**: `[[TICKET-BRANCH]]` for cross-referencing
- **BM25 Search**: Full-text search via SQLite FTS5 index

### Search Capability

```bash
python3 plugins/codebase-intelligence/tools/session_indexer.py \
  --search "authentication" \
  --limit 5
```

Returns top 5 BM25-ranked sessions across all tickets.

### Migration from Old session-memory

If you have existing memory in `~/.claude/memory/`:

```bash
# Backup is automatic — run once:
plugins/codebase-intelligence/tools/migrate-session-memory.sh --execute

# This will:
# 1. Backup ~/.claude/memory/ to tarball
# 2. Convert each TICKET/BRANCH.md to vault format with frontmatter
# 3. Move to ~/Documents/Obsidian-Vault/02-Notes/Sessions/
# 4. Build FTS5 index for all migrated sessions
# 5. Preserve all existing data (zero data loss)
```

### Commands Using Session Memory

- `/prp-plan` — Loads memory at start, saves at end with keyword extraction
- `/prp-implement` — Loads memory, saves progress every 3 tasks
- Agents (`codebase-explorer`, `codebase-analyst`) — Read memory for context pre-fill

### Dependencies

- **Obsidian vault**: `~/Documents/Obsidian-Vault/` (must exist)
- **Python 3.13+**: For keyword extraction and indexing
- **rank_bm25**: `pip install rank-bm25` (for BM25 scoring)
