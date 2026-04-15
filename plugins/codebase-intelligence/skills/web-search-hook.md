---
name: web-search-hook
description: >
  Search local web cache before performing expensive web searches to reduce token consumption.
  Use this skill proactively when the user asks questions that might be answered from previously
  cached web content. Trigger on queries like "search for...", "find information about...",
  "what does the web say about...". Always check the cache FIRST before using WebSearch.
---

# web-search-hook

Intelligently check local cache before performing web searches to save tokens and time.

## When to Use

**ALWAYS** check cache first when:
- User asks a question that could be answered from web content
- User explicitly requests web search
- You're about to use the WebSearch tool
- User asks about topics you've previously researched

## Execution Flow

### Step 1: Check Cache
```bash
python3 /Users/artur/Documents/ai-tools/memory-central/fetch-web.py search "{query}" --skill-mode
```

### Step 2: Evaluate Results
- If `count > 0`: Use cached content (SKIP WebSearch)
- If `count == 0`: Proceed with WebSearch

### Step 3: Cache New Content (if WebSearch was used)
After using WebSearch for a URL:
```bash
python3 /Users/artur/Documents/ai-tools/memory-central/fetch-web.py cache "{url}" --vault ~/Documents/Obsidian-Vault --skill-mode
```

## Decision Logic

```
User query → Check cache with search-cache
  ↓
  ├─ CACHE HIT (count > 0)
  │  → Use cached markdown
  │  → Report: "✅ Using cached content (saved ~X tokens)"
  │  → SKIP WebSearch
  │
  └─ CACHE MISS (count == 0)
     → Use WebSearch tool
     → Extract URLs from results
     → Cache each URL using fetch-and-cache
     → Report: "✅ Cached for future use"
```

## Example Usage

**User**: "Search for Python asyncio best practices"

**Assistant workflow**:
1. Check cache: `search-cache "Python asyncio best practices"`
2. Results found → use cached content, skip WebSearch
3. Report: "Found 3 cached articles on Python asyncio. Using cached content to save tokens."

## Benefits

- **Token savings**: Avoid redundant WebSearch calls
- **Speed**: Instant results from local cache
- **Consistency**: Same URLs return same content
- **Searchability**: All web content indexed for future queries

## Notes

- Cache persists across sessions
- BM25 ranking ensures most relevant results first
- Cached content includes extracted keywords for better search
- Maximum 5 results by default (customizable)
- Cache stored in Obsidian vault for easy browsing
