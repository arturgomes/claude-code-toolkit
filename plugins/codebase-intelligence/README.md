# codebase-intelligence

A **standalone** PRP engineering toolkit. Ships its own `prp-plan`, `prp-implement`,
and `prp-loop` commands plus their agents, layered with memory, KB, Context7,
drift-guard, and a bounded self-verifying loop. Codebase search is **Serena LSP
structural search** (single tier). Cross-session memory lives in an Obsidian vault via
the `ultimate-obsidian` MCP. **No prp-core (or any other plugin) required.**

**Version history**
- **v3.12.0** — adds the **Orchestration layer**: a `/prp-orchestrate <goal | JIRA-TICKET | prd.md>` command plus the `refinement` and `mediator` skills and **9 generic role agents** (`product-owner`, `lead-engineer`, `project-manager`, `frontend-specialist`, `backend-specialist`, `core-db-specialist`, `qa-analyst`, `ux-specialist`, `pr-reviewer`) bound to repos/stacks via swappable `presets/*.yaml`. Flow: **Phase R refinement** (a grooming panel drives a Definition-of-Ready gate — refined ACs + scenarios + DoD-from-ACs, zero open assumptions; NOT READY ⇒ STOP + clarifying questions for the user) → **Phase 0 plan** (the unchanged `/prp-plan`: session-memory + Jira + codebase agents + ask-kb + Context7-before-web + drift-guard → durable `plan.md`) → **mediator** fans work to 2-5 specialists each in their own git worktree (no two ever touch the same code — disjoint territory map), judges every diff each round against the target repo's `.claude/` MUST/SHOULD/MUST-NOT/SHOULD-NOT rules and blocks merges on 🔴, and merges passing worktrees serially. Autonomous — stops for a human only on a requirement fork or a red blast-radius action. `prp-plan` / `prp-implement` / `prp-loop` and their 4 agents are **unchanged** and remain callable building blocks. Grounded in the `claude-code`, `claude-certification`, and `llm-engineering` KB domains.
- **v3.11.0** — adds the `worktree-lifecycle` skill: every implementation runs in a fresh git worktree off the detected base branch (ENTER), torn down on user satisfaction (EXIT: save-before-delete, confirm-before-remove). Wired into `prp-implement` (Phase 2 + Phase 7) and referenced by `prp-loop` (L.3); capability-gated with an in-place serial fallback.
- **v3.10.0** — adds `/doctor`: a read-only preflight that checks system tools (`git`/`uv`/`python3`), MCP servers (`ultimate-obsidian` required; `serena`/`context7`/Atlassian optional), the bookrag engine, and vendored tools — printing the exact fix for anything missing.
- **v3.9.0** — vendors the web-cache tool (`web-search-hook`): the web-only subset of memory-central (owner's own code) now lives in `vendor/memory-central-web/`, run via `uv` with ephemeral deps. No `~/Documents/ai-tools/memory-central` checkout required; cache index stays at `~/.claude/memory/WEB-CACHE-001/`.
- **v3.8.0** — removes the `~/Documents/ai-tools/skills-mono-repo` dependency: the `bookrag` KB engine is now **bootstrapped on first use** (`/setup-kb`) — the public upstream is cloned at a **pinned commit** and the owner's own deltas (obsidian-ingest + a Chroma batching fix) are applied as local patches. No third-party code is vendored; KB skills resolve the engine at runtime via `scripts/bookrag-home.sh`.
- **v3.7.0** — decoupled from prp-core: the plugin is now fully self-contained (its own prp-plan / prp-implement / prp-loop commands and agents; no `prp-core:` invocations). Adds the `ingest-web-doc-to-kb` skill (autonomous web→KB ingestion, no API key).
- **v3.3.0** — adds `prp-loop`: a bounded closed-loop runner with contract-mandated stop rules and an independent verifier.
- **v3.4.0** — makes the loop self-improving: an optional context-isolating subagent per attempt, promotion of recurring/gamed failures to durable `## Loop Constraints`, and a verifier whose scrutiny rises with attempt count.
- **v3.5.0** — folds in 27 model-agnostic techniques mined from the `x-intel-2026-07` KB (52 sources) so every skill works **without any single model** (e.g. Fable-5). Every model-tier / effort / routing / worktree feature is capability-gated with a documented single-tier no-op fallback. Also **removes SocratiCode** (search is now Serena-only) and the superseded Python memory tools (memory is now pure `ultimate-obsidian` MCP).

`CI_MODEL_TIER` (`frontier | standard | light`, default `standard`) trades instruction
verbosity for capability while keeping all invariants mandatory at every tier — see
[Model-agnostic design](#model-agnostic-design-v350).

---

## Phase injection map — prp-plan

```
Pre-Phase I    → session-memory: load 02-Notes/Sessions/<TICKET>-<SUFFIX>.md via Obsidian MCP
Pre-Phase II   → Atlassian MCP: Jira ticket, AC, QA failure comments
Pre-Phase III  → drift-guard: TASK ANCHOR with verbatim AC (GATE if AC missing)

Phase 0 gate   → [ANCHOR] re-stated
Phase 1 gate   → drift-guard: user story maps to ≥1 AC?
Phase 1.5      → UNKNOWNS: enumerate every open question the AC leaves; route each to
                 Context7 / ask-kb / STOP+ask; log unresolved ones as explicit assumptions

Phase 2:
  Step 2A      → session-memory: cache pre-fill
  Step 2B      → codebase-explorer (Serena LSP + memory + KB) + codebase-analyst (Serena LSP)
  Step 2C      → codebase-search: Serena enrichment (fills gaps the agents missed)
  Step 2D      → ask-kb: personal KB patterns for feature domain
  Step 2E      → 2E-i collect evidence (file:line only) → 2E-ii interpret + drift verdict
  Gate         → drift-guard Q#1,2,5: every file must trace to ≥1 AC

Phase 3:
  Step 3A      → context7-research: verify all library APIs first
  Step 3B      → ask-kb: check KB before sending to web-researcher
  Step 3C      → web-researcher (KB pre-check + Context7 + web for gaps)
  Gate         → drift-guard Q#5: no research-introduced scope in plan

Phase 4 gate   → drift-guard Q#3: after-state = minimum that satisfies AC

Phase 5:
  KB review    → consult-kb: architecture against KB principles (🔴/🟡/🟢/💡)
  Gate         → drift-guard: full checks → ✅ ON TRACK required

Phase 6 plan:
  Added        → Intelligence Context (ticket, AC verbatim, KB, Context7, QA, assumptions)
  Added        → AC Traceability table (every AC → ≥1 task, every task → ≥1 AC)
  Added        → Model Routing block + per-task "Why (AC + intent)" line
  Facts-only   → unverified APIs written "UNVERIFIED — confirm at implement time", never invented
  Gate         → drift-guard Q#7: every AC has a task? · refuses while a blocking unknown is open

Post-gen       → session-memory: save planning session
```

## Phase injection map — prp-implement

```
Pre-Phase I    → session-memory: restore prior context + task completion state
Pre-Phase II   → drift-guard: load TASK ANCHOR from plan

Per-task (Phase 3):
  3.0 / 3.0b   → session-memory cache pre-load + Context7 signatures; full-brief load when context fits
  3.1 (EVERY)  → drift-guard Q#1,4 + incident lookup (⚠️ prior incident on the changed files)
                 + reasoning-effort matched to complexity (no-op if the runtime has no such control)
  3.3          → context7-research: verify API before writing library call
  3.4          → ask-kb: KB pattern for non-trivial decisions (advisor tier, single-tier no-op)
  3.6          → per-task gate: type-check AND the AC-mapped behavioral test must pass
  3.7          → drift-guard: "while I'm here" stop signal
  3.8 / 3.8b   → session-memory save (per task boundary); record "mistake → rule" lessons
  3.7b         → doubt-driven adversarial review (one-shot at task ⌈N/2⌉)

Phase 4.5      → AC verification = pasted command + exit code + proving output (no narrative claims);
                 each green AC appended to a "## Verified Invariants" block in session-memory
Phase 5        → Intelligence Summary · AC coverage table · "## Lessons" · optional skillify (5.6)
                 all vault writes pass a pre-write secret scrub → [REDACTED]
```

## Loop capability — prp-loop (v3.5.0)

Closed-loop runner: re-attempts a goal until an executable gate passes **and** an
independent fresh-context verifier confirms it — or a hard stop fires.

```
Pre-Phase I    → session-memory: restore LOOP CONTRACT + Loop Ledger + Loop Constraints (resume at n+1)
Pre-Phase II   → loop-contract: 4-condition pre-check + Five-failure screen + contract
                 (GATE: 🔴 NO GATE, or missing budget = refuse). Requires: executable binary gate,
                 budget (tokens/turns), wall_clock_cap, min_accept_rate, Blast radius green|yellow|red
Pre-Phase III  → anchor: AC from plan's Intelligence Context, or contract Objective
Pre-Phase IV   → subagent mode: ask once (enable/disable attempt delegation)

Phase L (per attempt):
  L.1          → drift-guard Q#1,4 + classify Blast radius — drift counts as a FAILED attempt
  L.2          → reread contract + Loop Constraints; re-run "## Verified Invariants" (regression = FAIL)
  L.3 / L.3b   → ATTEMPT (ledger-aware; one logical change; optional fresh-context subagent);
                 No-op guard: empty diff / refusal-shaped response → recorded, does NOT burn no_progress
  L.4 / L.4b   → GATE (executable, binary) + gate-gaming pre-scan (.skip/.only/deleted tests/weak asserts)
  L.5          → VERIFY: fresh-context sub-agent (hard floor at EVERY tier; prefers a different model)
                 sees contract + gate output + diff (hunk-level if >300 lines) + attempt n ONLY —
                 never the maker's reasoning; emits OUTCOME: PASS|FAIL and TRAJECTORY: PASS|FAIL
  L.6 / L.6b   → Loop Ledger row (idempotent, single-writer) + promote recurring/gamed failure → Loop Constraints
  L.7          → DECIDE: SUCCESS (both OUTCOME+TRAJECTORY pass, non-red) | TIME_CAP | BUDGET_CAP |
                 LOW_YIELD | VERIFIER_STALL | NO_PROGRESS | CONTEXT_CAP | HUMAN_GATE (any red action)

Phase R        → loop report (full ledger, accept-rate, cost-per-accepted-change, honest exit) + save
```

**When to use**: closed, binary-gated work — make failing tests pass, fix lint/build, QA-failure retry, gate-verified refactors.
**When NOT to use** (loop-contract refuses or a human stays in the chair): architecture, auth/payments, deploys, judgment-call "done", diffs nobody will read, any **red** blast-radius action.
**Not included by design**: scheduling/cron (a loop is eligible for cadence only after ≥3 ledger-recorded SUCCESS runs with zero gaming flags, and never self-schedules), fleet orchestration, auto-invocation from prp-implement.

---

## Orchestration layer — prp-orchestrate (v3.12.0)

Goal-oriented, parallel, mediator-judged, collision-proof alternative to running the three commands
by hand. One goal → a coordinator that fans work to isolated specialists, enforces the target repo's
rule sources (`.claude/` + `CLAUDE.md` + `.github/` Copilot instructions, `applyTo`-scoped) and
no-code-collision automatically, and returns a merged, reviewed result — without per-phase checkpoints
or Y/N prompts.

```
user ─▶ /prp-orchestrate "<goal | JIRA-TICKET | prd.md>" [--preset <name>] [--plan <path>] [--base <branch>] [--groom-autonomous]
             │
        R REFINE → grooming panel (product-owner + project-manager + lead-engineer + QA lens):
             │   refined ACs + scenarios + DoD-from-ACs, ZERO open assumptions → Definition-of-Ready
             │   verdict.  NOT READY ⇒ STOP (no plan, no code) + meaningful questions for the user.
             ▼   (READY only)
        0 PLAN → the FULL /prp-plan (unchanged): session-memory + Jira injection +
             │   codebase agents + ask-kb + Context7 (BEFORE web) + drift-guard → plan.md
             │   (durable artifact; --plan <path> reuses an existing one)
             ▼
        ┌───────  MEDIATOR (coordinator + adversarial judge + merge-gate)  ──┐
        │  A Decompose  → project-manager MAPS plan.md → testable contract   │
        │                 + DISJOINT territory map (from the plan's lanes;    │
        │                   activate 2-5, never 7)                            │
        │  B Allocate   → one git worktree per specialist; assert territories │
        │                 pairwise-disjoint (AC-4) — abort if they intersect  │
        │  C Round-judge→ each round: monitor ▸ JUDGE every diff vs target    │
        │                 repo rule sources: .claude/ + CLAUDE.md + .github/  │
        │                 Copilot instructions (applyTo-scoped) as MUST/SHOULD/│
        │                 MUST-NOT/SHOULD-NOT (drift-guard Q1-8) ▸ 🔴 blocks   │
        │  D Verify     → qa-analyst behavioral gates; pr-reviewer adversarial│
        │                 fresh-context review (never self-evaluate)          │
        │  E Merge      → serial merge of passing worktrees; ux taste check   │
        │  F Shutdown   → clean handshake ▸ save files ▸ session-memory END    │
        └───────────────────────────┬────────────────────────────────────────┘
                                     ▼   merged + reviewed result
                    (human asked ONLY on requirement fork or red blast-radius:
                     auth / payments / deploy / db-migration)
```

- **Refines before it plans (DoR gate):** Phase R convenes a scrum-style grooming panel
  (`product-owner` + `project-manager` + `lead-engineer` + a QA lens) that turns the goal/ticket/PRD
  into refined ACs + scenarios + a Definition of Done **derived from the ACs**, with **zero open
  assumptions**. Binary verdict: **NOT READY ⇒ the flow STOPS — no planning, no coding** — and returns
  meaningful clarifying questions (ambiguity + why-it-blocks + options + impact) for the **user** to
  answer (or, on `--groom-autonomous`, the panel proposes ratifiable decisions, never silent
  assumptions). *We don't dive into code until the assignment is understood as a contract.*
- **Plans first, full rigor:** Phase 0 runs the **unchanged `/prp-plan`** on a Jira ticket, goal, or
  PRD — session-memory (Obsidian vault) + Jira injection + `codebase-explorer`/`codebase-analyst` +
  **ask-kb and Context7 before any web search** + drift-guard — producing a durable `plan.md`. The
  mediator then **maps that plan.md** (AC Traceability + owner-lanes) into the contract + territory
  map; it never substitutes an ad-hoc decomposition. `--plan <path>` reuses an existing plan. A ticket
  prefix infers the preset (`SEATHQ-9999` → `seathq`).
- **Interaction (AC-1):** no mandatory Y/N gates; `PHASE_N_CHECKPOINT` verbosity collapses to
  silent-unless-fail invariants; `ask-kb` / `context7-research` / `drift-guard` / `session-memory`
  are auto-invoked inside the flow.
- **Rule-aware judging (AC-2):** the mediator grades each diff against **all** of the target repo's
  rule sources — `CLAUDE.md`, `.claude/*.md`, and the **`.github/` Copilot instructions**
  (`.github/copilot-instructions.md` + `.github/instructions/*.instructions.md`, each applied only to
  files matching its `applyTo` glob; checklist IDs like `FQ-4` count as SHOULD) — as
  MUST/SHOULD/MUST-NOT/SHOULD-NOT. A MUST/MUST-NOT violation ⇒ 🔴 blocks that merge. A preset may
  point `rule_sources` at non-standard locations.
- **No-collision guarantee (AC-4):** one worktree per active specialist **plus** a mediator-owned
  disjoint file-territory map; merges are serial. State is durable JSON
  (`skills/mediator/references/orchestration-state.schema.json`) — the mediator is the sole writer.
- **Portable roles (AC-3):** the 7 agents contain no org specifics; a `presets/*.yaml` binds them to
  repos/stacks (ships a `seathq` preset). See `presets/README.md`.
- **Capability-gated (U-1/U-2):** agent teams enable via env `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
  and message via the `SendMessage` tool (confirmed, official docs); if absent, falls back to serial
  single-writer worktrees — every AC still holds, only parallelism is lost.
- **KB-grounded (AC-6):** design cites the `claude-code` (Agent Teams, Harness Patterns, Agent
  Decomposition), `claude-certification`, and `llm-engineering` (multi-agent systems) domains.

Building blocks unchanged: `prp-plan` / `prp-implement` / `prp-loop` and their 4 agents are reused,
not modified.

---

## Model-agnostic design (v3.5.0)

No skill depends on a single model. Read `CI_MODEL_TIER` (`frontier | standard | light`, default `standard` when unset/unknown):

- **`frontier`** — treat numbered sub-steps as intent; skip redundant per-step narration.
- **`standard` / `light`** — follow every numbered step verbatim.

**Invariants are mandatory at every tier and never skipped**: executable gates, the AC anchor, drift checks, write-before-stop, the independent blind verifier, and blast-radius routing.

Every capability-dependent feature has a documented fallback:

| Feature | If the capability is present | If absent (fallback) |
|---|---|---|
| Model Routing (executor / advisor / grader) | route by config tier | single-tier mode — all roles on one model (no-op) |
| Reasoning-effort matching | match effort to plan complexity | no-op |
| No-op / refusal guard | reroute to a configured fallback model | count as an ordinary failed attempt |
| Worktree isolation for spawned agents | isolate each in its own worktree | run serial (no parallel lanes) |
| Worktree lifecycle for an implementation run (`worktree-lifecycle` ENTER/EXIT) | fresh worktree off detected base; removed on EXIT after save + confirm | in-place branch — same flow, no separate checkout, nothing to remove |
| Instruction verbosity | trim on `frontier` | keep full scaffolding |

No model id, effort value (`xhigh`), or benchmark statistic is ever a required threshold.

---

## drift-guard: the gate

A **mechanical pre-scan runs first** — a forbidden-path glob derived from the anchor's
Boundaries/NOT-Building is checked against `git diff --name-only`; any hit is a deterministic
🔴 before any judgment. Then the judgment questions, run at every phase gate and before every task:

1. **REQUIREMENT TRACE** — Does this directly serve an AC?
2. **SCOPE BOUNDARY** — Is this inside the files the plan identified?
3. **COMPLEXITY BUDGET** — More complex than the problem warrants?
4. **GOLD-PLATE CHECK** — More general/flexible/elegant than AC requires?
5. **RESEARCH DRIFT** — Did research introduce scope not in the original ticket?
6. **ARCHITECTURAL DRIFT** — Architectural decisions beyond what this task needs?
7. **AC COVERAGE** — Which AC does NOT yet have a corresponding task?
8. **INCIDENT REPEAT** — Does this repeat a documented prior failure?

A previously-verified AC is an invariant — breaking it is drift.
Verdict: ✅ ON TRACK (all pass) · ⚠️ DRIFT RISK (1-2) · 🔴 DRIFTING (3+, STOP).

---

## Context7 anti-hallucination contract

Before any external library call is written:
1. Library version read from `package.json`
2. `context7 → resolve-library-id`
3. `context7 → get-library-docs` for the specific API topic
4. Confirmed signature documented in the plan's `Context7 Library Facts` section
5. Implementation uses only confirmed signatures

If Context7 is unavailable → flag the response as **unverified**.

---

## Agents

The plugin ships its own agents; `prp-plan` and `prp-implement` invoke them directly (`codebase-intelligence:codebase-explorer`, etc.). If a legacy `prp-core` is also installed, these take precedence — but nothing here requires it.

| Agent | Role | Capabilities |
|---|---|---|
| `codebase-explorer` | Locate WHERE code lives | memory pre-fill · Serena LSP symbol resolution · KB pattern lookup · Source column in every output table |
| `codebase-analyst` | Trace HOW code works | memory pre-fill · Serena-first entry-point resolution · drift-guard scope check · Source column |
| `web-researcher` | External research | KB pre-check (skip web for covered topics) · Context7 API verification · drift-guard scope check on findings |
| `codebase-researcher` | Pre-planning research | full pre-planning research pass (memory → Serena → structured file:line report) |

### Orchestration role specialists (v3.12.0)

Generic, portable role agents used by `/prp-orchestrate` — repo/stack binding comes from a
`presets/*.yaml`, never hard-coded in the bodies. Activate 2-5 per goal, never all 7.

| Agent | Harness role | Responsibility |
|---|---|---|
| `product-owner` | refinement panel | business intent + authors/challenges ACs + business scenarios; blocks readiness on vague/untestable ACs (no code) |
| `lead-engineer` | refinement panel | technical feasibility + edge/error cases + technical DoD; blocks readiness on unmade technical decisions (no code) |
| `project-manager` | planner / refinement | consumes plan.md → testable contract + disjoint territory map + AC traceability; also on the grooming panel (no code) |
| `frontend-specialist` | generator | UI/components/pages in its own worktree/territory; → qa, ux |
| `backend-specialist` | generator | APIs/services/handlers; consumes core contracts; → qa |
| `core-db-specialist` | generator | shared types/DB/migrations; transaction + identifier rules; db-migration = red; → backend, qa |
| `qa-analyst` | evaluator | writes + runs behavioral gates → pass/fail report; fresh context; → pr-reviewer |
| `ux-specialist` | design taste | before/after taste rubric on UI merges (advises, doesn't block); → frontend |
| `pr-reviewer` | adversarial evaluator | harsh fresh-context review of merged diff vs the repo's rule sources (`.claude/` + `CLAUDE.md` + `.github/` instructions) + conventions; → pm, mediator |

---

## MCP setup (Claude Code terminal)

All MCPs use `--scope user` — registered once, available in every project.

```bash
# Verify what's registered
claude mcp list

# Serena — LSP structural codebase search (the only search tier)
docker pull ghcr.io/oraios/serena:latest
claude mcp add serena \
  --scope user --transport stdio \
  -- docker run --rm -i --network host \
     -v "${HOME}/projects:/workspaces/projects" \
     ghcr.io/oraios/serena:latest \
     serena start-mcp-server --transport stdio

# ultimate-obsidian — vault-backed session memory, plans, reports (required)
#   Provides create_or_update_note, read_note, check_exists, list_vault,
#   index_note (FTS5), search_sessions. Point it at ~/Documents/Obsidian-Vault/.

# Context7 — verified library docs
claude mcp add context7 \
  --scope user --transport http \
  https://mcp.context7.com/mcp

# Atlassian Jira — ticket + AC + QA-failure comment injection
echo -n "email@company.com:api-token" | base64
claude mcp add atlassian \
  --scope user --transport http \
  https://mcp.atlassian.com/v1/mcp \
  --header "Authorization: Basic <base64>"
```

---

## Commands & skills

**Commands**: `/prp-plan` · `/prp-implement` · `/prp-loop` · `/prp-orchestrate` · `/setup-kb` · `/doctor`

| Skill | Purpose |
|---|---|
| `refinement` | Pre-planning Definition-of-Ready gate behind `/prp-orchestrate`: grooming panel (product-owner + project-manager + lead-engineer + QA lens) → refined ACs + scenarios + DoD-from-ACs, zero open assumptions; NOT READY ⇒ STOP + clarifying questions for the user |
| `mediator` | Coordinator + adversarial judge + serial merge-gate behind `/prp-orchestrate`: disjoint territory allocation, per-round `.claude/`-rules verdict, 🔴-blocks-merge, worktree-per-specialist, capability fallback |
| `drift-guard` | Anchor every decision to the AC — mechanical pre-scan + 8 drift questions, at every gate |
| `loop-contract` | Define/validate a Loop Contract (executable gate, budget, blast-radius, stop rules); refuse without a binary gate |
| `session-memory` | Persist/restore findings, decisions, failures to the vault (BM25); write-before-stop / read-at-start gates; Loop Ledger |
| `worktree-lifecycle` | ENTER a fresh worktree off the detected base for an implementation run; EXIT tears it down on user satisfaction (save-before-delete, confirm-before-remove); capability-gated with an in-place serial fallback |
| `codebase-search` | Serena LSP structural search with session-memory cache-aside |
| `context7-research` | Fetch version-specific library docs before writing any external API call |
| `web-search-hook` | Check the local web cache before any WebSearch to avoid redundant cost |
| `ask-kb` | Query the personal KB (books + validated principles) for technical/strategic questions |
| `consult-kb` | Review code/RFCs/ADRs against the KB for violations, tensions, aligned patterns |
| `kb-indexer` | Ingest ebooks/PDFs/docs into the KB (bookrag DB + registry) |
| `add-pdf-to-kb` | Ingest a single PDF/EPUB into a domain bookrag.db + create a vault reference note |
| `ingest-web-doc-to-kb` | Scrape a doc site/article + sub-pages, distill in-session (no API key), index into a domain, batched Chroma, vault note + master rebuild — fully autonomous |
| `index-kb-domains` | Wikilink all KB domains in the vault so the KB is graph-traceable |
| `benchmark-kb` | Benchmark bookrag retrieval (MRR / Recall@k / Precision@5) with optional regression check |
| `product-spec` | Generate a structured PRD (user stories, AC, constraints) from a feature idea |
| `technical-plan` | Validate a plan against codebase patterns for reuse, DRY, minimal change |
| `test-scenarios` | Generate prioritized QA scenarios (happy path, edge, error, perf, security) |
| `quality-review` | Full review: 20-item function quality + 16-item test quality + best practices |
| `function-quality` | Run the 20-item Function Quality Checklist on specific functions |
| `test-quality` | Run the 16-item Test Quality Checklist on test files |
| `doubt-driven` | Mid-flight adversarial review — a fresh-context agent tries to falsify the strongest claims |
| `skillify` | Extract a reusable SKILL.md draft from a completed plan + report pair |
| `prp-pr-review` | Triage GitHub PR comments via the SKEPTIC framework; apply only valid suggestions |
| `token-audit` | Audit a Claude Code setup for the 9 token-economy anti-patterns |
| `claude-md-init` | Scaffold a 12-rule CLAUDE.md behavioral contract |
| `ship` | Finalize and ship a completed change |

---

## Memory architecture

Cross-session memory is **vault-based**, served entirely by the `ultimate-obsidian` MCP
(no local Python tooling).

### Storage location

```
~/Documents/Obsidian-Vault/02-Notes/Sessions/<TICKET>-<SUFFIX>.md
```

`<TICKET>` = Jira id from the branch, or the git-root folder name when there is none.
`<SUFFIX>` = the branch (ticket prefix stripped), or the kebab-case plan/feature stem on
non-descriptive branches (`main`/`master`/`develop`/…). Each session file carries:

- **Frontmatter** — ticket, branch, date, phase, keywords (auto-extracted), tags
- **Segmented sections** — `## Verified Facts` · `## General Rules` · `## Open Failures` · `## Lessons` · `## Last-Session State (resume here)`
- **Loop sections** (prp-loop only) — `## Loop Contract` · `## Loop Ledger` · `## Loop Constraints`
- **Wikilinks** — `[[TICKET-SUFFIX]]` for cross-referencing
- **BM25 search** — SQLite FTS5 index at `~/.claude/memory/<TICKET>/session_index.db`

### Gates

- **WRITE-BEFORE-STOP** — a mandatory SESSION END write before any exit (including CONTEXT_CAP), so the next session resumes instead of restarting.
- **READ-AT-START** — SESSION START loads `## Last-Session State`.
- **Pre-write scrub** — every vault write is scanned for secrets/tokens/`.env`/connection strings → `[REDACTED]`; captured output never leaves the machine.
- **Single-writer / idempotent** — ledger rows are keyed by attempt `n` (compare-and-set); only the orchestrator appends.

### Search

Use the `ultimate-obsidian` MCP `search_sessions` (BM25-ranked, top-N) — e.g. "what did we
decide about authentication". Restore reads a per-folder `02-Notes/Sessions/_index.md` first.

### Commands using session memory

- `/prp-plan` — loads at start, saves at end with keyword extraction
- `/prp-implement` — loads at start, saves at each task boundary
- `/prp-loop` — restores + appends the Loop Ledger/Constraints every attempt
- Agents (`codebase-explorer`, `codebase-analyst`, `codebase-researcher`) — read memory for context pre-fill

### Dependencies

- **Obsidian vault**: `~/Documents/Obsidian-Vault/` (must exist)
- **`ultimate-obsidian` MCP**: provides all note + index + search operations
- **`bookrag` KB engine** (for the KB skills): bootstrapped by `/setup-kb` into
  `~/.codebase-intelligence/skills-mono-repo` (override via `CI_BOOKRAG_HOME`) — pinned public base +
  local patches, fetched on first use. Requires `git` + `uv`. Not vendored; not a personal checkout.
- **Optional MCPs**: `serena` (LSP codebase search), `context7` (library docs), `atlassian` (Jira injection)
