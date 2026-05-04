---
name: codebase-search
description: >
  Two-tier codebase search using Serena (LSP/structural) and SocratiCode (semantic/vector).
  Follows a cache-aside pattern: check session-memory first, search only on a miss, always write
  findings back. Invoked automatically during prp-plan Phase 2 and prp-implement Phase 0.
  Also invoke manually when asked to "find", "locate", "search", "where is X", or
  "how does Y work" about the codebase.
version: 2.0.1
---

# codebase-search

Two-tier search over the codebase. Always checks session-memory before hitting the MCP servers.

---

## Tier 1 — Structural search via Serena MCP

Use for **precise, symbol-level** queries. Requires `serena` MCP. Tools: `find_symbol`, `get_symbol_references`, `search_for_pattern`, `find_files`, `get_symbol_definition`.

**Use Tier 1 when:** query contains a symbol name, type name, file path, import path, or regex.

---

## Tier 2 — Semantic search via SocratiCode MCP

Use `semantic_search` for **intent-based, natural language** queries (e.g. "where is auth validation handled"). Requires `socraticode` MCP.

**Use Tier 2 when:** query describes behaviour, a concept, or intent rather than a concrete symbol.

---

## Execution flow

1. **Check** session-memory first (cache HIT → return cached findings, skip MCP).
2. **Select tier**: symbol/path/regex → Tier 1; intent/behaviour → Tier 2; complex → Tier 1 first, fill gaps with Tier 2.
3. **Write** findings back to session-memory at SESSION END.

If either MCP is unavailable, fall back to the available tier and note the limitation in output. Caps: ≤10 Serena calls and ≤5 SocratiCode queries (top-3) per session.

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

## Integration

Auto-invoked by `prp-plan` Phase 2 (EXPLORE) and `prp-implement` Phase 0 (per-task pre-load). Findings merge into the discovery table or task pre-context as applicable — orchestration owned by the caller.
