---
name: ask-kb
description: >
  Query the personal knowledge base (books + validated principles) for technical or strategic questions.
  Trigger on "how should I...", "what's the pattern for...", "what does [book] say about...", "consult my KB".
version: 3.0.0
---

# ask-kb

Answer questions by consulting the user's personal knowledge base — not from general knowledge.
The goal: **reproducible, cited answers** grounded in principles the user has already validated.

Retrieval is a **local FTS5 (BM25) index over the Obsidian vault**, served by the
`ultimate-obsidian` MCP (`search_kb`). No embedding model, no vector store — the index is a
disposable, machine-local, deterministic function of the markdown, so it is portable across
machines and never goes stale (kept fresh by MCP self-index-on-write + a SessionStart catch-up).

## Workflow

The index covers the whole vault except raw book-text mirrors (`/markdown/`) — i.e. the distilled
KB cards (`05-Knowledge-Base/domains/*/kb/`), `02-Notes`, plans, reports and sessions.

### Step 1 — Expand the query (recover semantic recall)

BM25 is lexical, so **do the semantic work in the query**: from the question, produce 4–10 terms —
the salient nouns/verbs **plus synonyms and near-equivalents** the KB might actually use. Example:
"how do I handle transient failures" → `retry backoff exponential idempotent transient timeout resilience circuit breaker`.

Keep terms space-separated in one string; `search_kb` tokenizes them, drops stopwords, ORs them,
and prefix-matches longer terms (so `retry` also hits `retries`/`retrying`). More matching terms
rank a chunk higher.

### Step 2 — Run search_kb

Call the MCP tool `mcp__ultimate-obsidian__search_kb` with `{ query: "<expanded terms>", limit: 6 }`.

Output is JSON: `{ "query": "...", "hits": [ { "text", "source_relpath", "heading_path", "domain", "score" } ] }`
— up to 6 BM25-ranked hits. `score` is `bm25()`: **more negative = more relevant** (already sorted best-first).

If the first pass is thin or off-topic, **iterate once**: broaden or swap synonyms and call `search_kb`
again. Optionally `read_note` a top hit's `source_relpath` to pull fuller context before answering.

### Step 3 — Parse hits and extract citations

For each hit:
- **Source**: book/domain from `source_relpath` segments (`.../domains/<domain>/kb/<book>/...`)
- **Section**: `heading_path` breadcrumb (e.g. `Core Principles > P10: Avoid DI in Aggregates`)
- **Content**: `text` field (the chunk body)
- **Rank**: order is best-first; note if `score` jumps sharply after hit 2 (a relevance cliff)

Use the top 3-4 hits.

### Step 4 — Formulate the Answer

- Cite every key claim: `[Source: {book-slug} — {heading_path}]`
- Cross-reference multiple hits when they converge on the same principle
- Note if hits are vault notes vs KB books (`source_relpath` prefix: `02-Notes/` vs `05-Knowledge-Base/`)

### Step 5 — Honest Gaps

If hits are irrelevant (weak scores, off-topic even after one re-query), say: "The KB index returned
low-confidence results for this topic. I can answer from general knowledge instead."

### Fallback (search_kb unavailable or empty)

If the MCP tool errors with "KB index not built", trigger a build once via
`mcp__ultimate-obsidian__reindex_kb` `{}` (incremental; `{ "force": true }` for a full rebuild), then
retry Step 2. If the MCP itself is unreachable:
1. Say: "KB index unavailable — falling back to flat-file search."
2. Find `kb-registry.yaml` at `$KB_ROOT/kb-registry.yaml` → `~/kb/kb-registry.yaml` → `./kb/kb-registry.yaml`
3. Score KBs by keyword match, read relevant markdown files, answer with flat-file citations.

---

## Output Format

```
## Answer

[Direct answer to the question, 2-5 sentences]

## From Your Knowledge Base

### [Principle/Pattern Name]
[Explanation grounded in KB content]

*Source: [Book Title] — [topic/section]*

### [Another Principle if applicable]
...

## Trade-offs & Considerations  (include only if KB documents trade-offs)

## Gaps  (include only if parts of the question were not in the KB)
```

For simple factual questions (1 concept, 1 source), a shorter format is fine — don't over-structure.
