# memory-central-web (vendored)

The web-cache subset of **memory-central**, authored by Artur Gomes and vendored here so the
`web-search-hook` skill is self-contained (no external `~/Documents/ai-tools/memory-central`
checkout required). Covered by this repository's MIT license.

## Contents
- `fetch-web.py` — CLI: `search` (FTS5/BM25 over the local cache) and `cache` (fetch + store a URL)
- `web_fetcher/` — HTTP fetch + HTML→markdown session
- `web_cache/` — SQLite FTS5 indexer, keyword/wikilink/tag extraction, vault writer

## Runtime
Run with `uv` so Python deps resolve ephemerally:

```bash
uv run --with click --with requests --with beautifulsoup4 --with html2text --with rank-bm25 \
  python fetch-web.py search "query" --skill-mode
```

## State (outside this dir)
- Cache index: `~/.claude/memory/WEB-CACHE-001/cache_index.db` (absolute path — shared with any
  standalone memory-central install)
- Cached notes: written into the Obsidian vault passed via `--vault`

## Updating
This is a vendored snapshot. To refresh from upstream memory-central, re-copy `fetch-web.py`,
`web_fetcher/`, and `web_cache/` (source only, no `__pycache__`).
