---
name: web-search-hook
description: >
  Check local web cache before any WebSearch call to avoid redundant requests and token cost.
  Trigger proactively on "search for...", "find information about...", "what does the web say about...".
version: 2.0.1
---

# web-search-hook

Intelligently check local cache before performing web searches to save tokens and time.

## When to Use

Always check cache before invoking WebSearch — for any query that could be answered from web content.

## Execution Flow

### Step 1: Check Cache
```bash
python3 ~/Documents/ai-tools/memory-central/fetch-web.py search "{query}" --skill-mode
```

### Step 2: Evaluate Results
- If `count > 0`: Use cached content (SKIP WebSearch)
- If `count == 0`: Proceed with WebSearch

### Step 3: Cache New Content (if WebSearch was used)
After using WebSearch for a URL:
```bash
python3 ~/Documents/ai-tools/memory-central/fetch-web.py cache "{url}" --vault ~/Documents/Obsidian-Vault --skill-mode
```

## Notes

- Max 5 results per query (customizable via flags)
- Cache lives in Obsidian vault — searchable in normal vault search
