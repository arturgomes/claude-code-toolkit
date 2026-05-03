---
name: ask-kb
description: >
  Query a personal knowledge base built from books, ebooks, and validated principles to answer
  technical or strategic questions. Use this skill whenever the user asks "how should I...",
  "what's the pattern for...", "what does [book] say about...", "according to my KB...", or
  any question that should be answered from documented principles rather than improvised.
  Also trigger when the user says "consult my KB", "check my knowledge base", "what do my
  books say about X", or references specific sources like "Clean Code", "DDIA", "Playing to Win".
  Prefer this over answering from general knowledge when the user has a KB configured —
  consistent, source-backed answers beat improvised ones.
version: 2.0.1
---

# ask-kb

Answer questions by consulting the user's personal knowledge base — not from general knowledge.
The goal: **reproducible, cited answers** grounded in principles the user has already validated.

## Workflow

The obsidian-vault DB covers all KB domains (software-architecture, engineering-practices,
llm-engineering, ml-data, functional-programming, engineering-leadership, software-craft)
plus 02-Notes and 04-Claude-Sessions — 26,380 chunks total. Paths are baked into the Step 1
command — do not look elsewhere.

### Step 1 — Run bookrag query-hybrid

```bash
uv run --directory ~/Documents/ai-tools/skills-mono-repo \
  bookrag query-hybrid "<question>" \
  --db ~/Documents/ai-tools/skills-mono-repo/master-kb/domains/obsidian-vault/bookrag.db \
  --settings ~/Documents/ai-tools/skills-mono-repo/bookrag/config/settings.toml \
  --stdout
```

Output is JSON: `{ "query": "...", "hits": [ { "text", "source_relpath", "heading_path", "rrf_score", ... } ] }`

Returns up to 6 ranked hits (dense + BM25 + RRF fusion).

### Step 2 — Parse hits and extract citations

For each hit:
- **Source**: extract book/domain from `source_relpath` path segments
- **Section**: use `heading_path` (already formatted as breadcrumb, e.g. `Core Principles > Explanation`)
- **Content**: `text` field (≈1200 chars of the relevant chunk)
- **Rank**: `rrf_score` — higher = more relevant

Use the top 3-4 hits. If scores drop sharply after hit 2, note the gap.

### Step 3 — Formulate the Answer

- Cite every key claim: `[Source: {book-slug} — {heading_path}]`
- Cross-reference multiple hits when they converge on the same principle
- Note if hits are from vault session notes vs KB books (source_relpath prefix tells you)

### Step 4 — Honest Gaps

If hits are irrelevant (low rrf_score, off-topic), say: "Bookrag returned low-confidence results — outside the obsidian-vault domains. I can answer from general knowledge instead." (Domains listed at top of Workflow.)

### Fallback (bookrag unavailable)

If `uv` is not found or the DB path does not exist:
1. Say: "bookrag unavailable — falling back to kb-registry.yaml"
2. Find `kb-registry.yaml` at: `$KB_ROOT/kb-registry.yaml` → `~/kb/kb-registry.yaml` → `./kb/kb-registry.yaml`
3. Read and score KBs by keyword match, read relevant markdown files
4. Answer with flat-file citations

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
