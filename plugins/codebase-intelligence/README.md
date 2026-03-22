# codebase-intelligence

Intelligence layer for prp-core. Adds memory, KB, Context7, and drift-guard to
`prp-plan` and `prp-implement` without removing any original prp-core logic.

---

## Phase injection map — prp-plan

```
Pre-Phase I    → task-memory: load ~/.claude/memory/<TICKET>/<branch>.md
Pre-Phase II   → Atlassian MCP: Jira ticket, AC, QA failure comments
Pre-Phase III  → drift-guard: TASK ANCHOR with verbatim AC (GATE if AC missing)

Phase 0 gate   → [ANCHOR] re-stated
Phase 1 gate   → drift-guard: user story maps to ≥1 AC?

Phase 2:
  Step 2A      → task-memory: cache pre-fill
  Step 2B      → prp-core:codebase-explorer + prp-core:codebase-analyst (unchanged)
  Step 2C      → codebase-search: Serena + SocratiCode enrichment
  Step 2D      → ask-kb: personal KB patterns for feature domain
  Step 2E gate → drift-guard Q#1,2,5: every file must trace to ≥1 AC

Phase 3:
  Step 3A      → context7-research: verify all library APIs first
  Step 3B      → ask-kb: check KB before sending to web-researcher
  Step 3C      → prp-core:web-researcher (gaps only, after Context7 + KB)
  Gate         → drift-guard Q#5: no research-introduced scope in plan

Phase 4 gate   → drift-guard Q#3: after-state = minimum that satisfies AC

Phase 5:
  KB review    → consult-kb: architecture against KB principles (🔴/🟡/🟢/💡)
  Gate         → drift-guard: full 7 questions → ✅ ON TRACK required

Phase 6 plan:
  Added        → Intelligence Context section (ticket, AC verbatim, KB, Context7, QA)
  Added        → AC Traceability table (every AC → ≥1 task, every task → ≥1 AC)
  Gate         → drift-guard Q#7: every AC has a task?

Post-gen       → task-memory: save planning session
```

## Phase injection map — prp-implement

```
Pre-Phase I    → task-memory: restore prior context + task completion state
Pre-Phase II   → drift-guard: load TASK ANCHOR from plan

Per-task (Phase 3):
  3.0          → task-memory: per-file cache pre-load
  3.0b         → context7-research: pre-load confirmed library signatures
  3.1 (EVERY)  → drift-guard Q#1,4: before EVERY task — "which AC? adding anything extra?"
  3.3          → context7-research: verify API before writing library call
  3.4          → ask-kb: KB pattern for non-trivial implementation decisions
  3.7          → drift-guard: "while I'm here" stop signal
  3.8          → task-memory: save every ~3 tasks (crash-safe)

Phase 4.5      → drift-guard final gate: every AC verified with a named test

Phase 5.2 report:
  Added        → Intelligence Summary (memory, Context7, KB, drift stats)
  Added        → AC coverage table (every AC with test name and result)

Phase 5.5      → task-memory: final save (Context7 + KB findings preserved for future sessions)
```

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

## Memory structure

```
~/.claude/memory/
├── PROJ-421/
│   └── feature-pdf-export.md     ← planning + implementation + QA resume sessions
├── PROJ-388/
│   └── bugfix-auth-timeout.md
└── PROJ-512/
    └── main.md                   ← fallback when branch has no ticket prefix
```

Each file accumulates dated session entries:
- Planning session: findings, decisions, KB results, Context7 facts
- Implementation sessions: per-task progress, deviations, drift removals
- QA resume sessions: failure context, what was tried, resumption point

A session interrupted mid-task restarts with full context. A QA failure weeks later
restores the entire investigation — no re-research needed.
