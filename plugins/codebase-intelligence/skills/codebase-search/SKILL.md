---
name: codebase-search
description: >
  Serena LSP structural codebase search with session-memory cache-aside.
  Auto-invoked by prp-plan/prp-implement; trigger manually on "find", "locate", "where is X", "how does Y work".
version: 2.0.1
---

# codebase-search

Serena LSP structural search over the codebase. Always checks session-memory before hitting the MCP server.

---

## Structural search via Serena MCP

Use for **precise, symbol-level** queries. Requires `serena` MCP. Tools: `find_symbol`, `get_symbol_references`, `search_for_pattern`, `find_files`, `get_symbol_definition`.

**Use Serena when:** query contains a symbol name, type name, file path, import path, or regex — Serena also resolves references, so it handles "who calls X" / "where is Y used" queries.

---

## Execution flow

1. **Check** session-memory first (cache HIT → return cached findings, skip MCP).
2. **Search** with Serena: resolve symbols/paths/regex, and follow references for usage/caller queries.
3. **Write** findings back to session-memory at SESSION END.

If the Serena MCP is unavailable, fall back to native grep/glob and note the limitation in output. Cap: ≤10 Serena calls per session.

---

## Output format

```
[SOURCE: MEMORY | SERENA]
File: <relative/path/to/file.ts>  Line: <N>
Summary: <what was found in one line>
Relevance: <why this matters for the current task>
```

If nothing is found: state that explicitly — **never fabricate file paths**.

---

## Integration

Auto-invoked by `prp-plan` Phase 2 (EXPLORE) and `prp-implement` Phase 0 (per-task pre-load). Findings merge into the discovery table or task pre-context as applicable — orchestration owned by the caller.
