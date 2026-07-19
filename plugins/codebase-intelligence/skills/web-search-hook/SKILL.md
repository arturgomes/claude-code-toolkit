---
name: web-search-hook
description: >
  Check local web cache before any WebSearch call to avoid redundant requests and token cost.
  Trigger proactively on "search for...", "find information about...", "what does the web say about...".
version: 2.1.0
---

# web-search-hook

Intelligently check local cache before performing web searches to save tokens and time.

## When to Use

Always check cache before invoking WebSearch — for any query that could be answered from web content.

## Execution Flow

The web-cache tool is **vendored inside this plugin** (`vendor/memory-central-web/`, no external
checkout required). Resolve its path once, and run it with `uv` so its Python deps are pulled
ephemerally — nothing to install. The cache index lives at `~/.claude/memory/WEB-CACHE-001/` and
cached notes go to your Obsidian vault.

```bash
# Resolve the vendored tool dir once; reuse the printed path below.
MCWEB="$(dirname "$(find ~/.claude -type f -path '*codebase-intelligence/vendor/memory-central-web/fetch-web.py' 2>/dev/null | head -1)")"
UV_WITH='--with click --with requests --with beautifulsoup4 --with html2text --with rank-bm25'
```

### Step 1: Check Cache
```bash
cd "$MCWEB" && uv run $UV_WITH python fetch-web.py search "{query}" --skill-mode
```

### Step 2: Evaluate Results
- If `count > 0`: Use cached content (SKIP WebSearch)
- If `count == 0`: Proceed with WebSearch

### Step 3: Cache New Content (if WebSearch was used)
After using WebSearch for a URL:
```bash
cd "$MCWEB" && uv run $UV_WITH python fetch-web.py cache "{url}" --vault ~/Documents/Obsidian-Vault --skill-mode
```

## Notes

- Max 5 results per query (customizable via flags)
- Cache lives in Obsidian vault — searchable in normal vault search
