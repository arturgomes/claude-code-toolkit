---
name: codebase-search
description: >
  Two-tier codebase search using Serena (LSP/structural) and SocratiCode (semantic/vector).
  Follows a cache-aside pattern: check task-memory first, search only on a miss, always write
  findings back. Invoked automatically during prp-plan Phase 2 and prp-implement Phase 0.
  Also invoke manually when asked to "find", "locate", "search", "where is X", or
  "how does Y work" about the codebase.
user-invocable: true
---

# codebase-search

Two-tier search over the codebase. Always checks task-memory before hitting the MCP servers.

---

## Tier 1 — Structural search via Serena MCP

Use Serena for **precise, symbol-level** queries. Requires `serena` MCP configured.

| Query type | Serena tool to use |
|---|---|
| Where is function/class X defined? | `find_symbol` |
| Who calls function X? | `get_symbol_references` |
| Files matching a regex or literal | `search_for_pattern` |
| Files by name pattern | `find_files` |
| Full definition of a symbol | `get_symbol_definition` |

**Use Tier 1 when:** query contains a symbol name, type name, file path, import path, or regex.

---

## Tier 2 — Semantic search via SocratiCode MCP

Use SocratiCode for **intent-based, natural language** queries. Requires `socraticode` MCP configured.

| Query type | SocratiCode tool |
|---|---|
| "Where is auth validation handled?" | `semantic_search` |
| "Find all payment processing logic" | `semantic_search` |
| "Where do we transform API responses?" | `semantic_search` |

**Use Tier 2 when:** query describes behaviour, a concept, or intent rather than a concrete symbol.

---

## Execution flow

```
1. CHECK task-memory (task-memory skill → SESSION START)
   ├─ Cache HIT  → Return cached findings, skip MCP calls, note "from memory"
   └─ Cache MISS → Continue

2. SELECT tier:
   ├─ Symbol / path / regex  → Tier 1: Serena
   ├─ Intent / behaviour     → Tier 2: SocratiCode
   └─ Complex (both)         → Run Tier 1 first, fill gaps with Tier 2

3. WRITE findings to task-memory (SESSION END append)
```

---

## Output format

```
[SOURCE: MEMORY | SERENA | SOCRATICODE | BOTH]
File: <relative/path/to/file.ts>  Line: <N>
Summary: <what was found in one line>
Relevance: <why this matters for the current task>
```

If nothing found in either tier: state that explicitly — **never fabricate file paths**.

---

## Integration with prp-plan Phase 2

During prp-plan EXPLORE phase, this skill runs **after** the built-in
`codebase-intelligence:codebase-explorer` and `codebase-intelligence:codebase-analyst` agents. It enriches their
discovery table with two additions:

1. **Serena column** — exact file:line for every symbol they mentioned
2. **SocratiCode column** — semantic neighbours not found by static analysis

The merged result replaces the standard discovery table in the plan.

---

## Integration with prp-implement Phase 0

Before each task in the implementation loop, the skill checks task-memory for prior
findings about the files involved. Cache hits avoid redundant Serena calls mid-implementation.

---

## MCP requirements

Both MCPs are registered once via `claude mcp add --scope user` (Claude Code terminal)
and are then available globally across all projects. See the repo README for setup commands.

| MCP | Transport | Purpose |
|---|---|---|
| `serena` | stdio (Docker) | LSP structural search |
| `socraticode` | stdio (npx) | Semantic vector search |

If either is unavailable, fall back to the available tier and note the limitation in output.

---

## Token efficiency rules

- Never read entire files — use symbol lookups and targeted reads
- Max 10 Serena calls per planning session
- Max 5 SocratiCode queries per planning session, top-3 results each
- Summarise findings — do not dump raw content into the plan
