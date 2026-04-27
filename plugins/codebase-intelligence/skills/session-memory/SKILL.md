---
name: session-memory
description: >
  Persist and restore investigation findings, implementation decisions, and QA failure notes
  to Obsidian vault with frontmatter, wikilinks, and BM25 search. Replaces task-memory with
  vault-based architecture. Invoked automatically by prp-plan and prp-implement, or manually
  when asked to "save progress", "load context for PROJ-NNN", "what did we find last time",
  or when resuming after a QA failure.
version: 2.0.0
---

# session-memory

Cross-session memory stored in **Obsidian vault** (`~/Documents/Obsidian-Vault/02-Notes/Sessions/`)
with frontmatter metadata, wikilinks, and BM25 full-text search via SQLite FTS5 index.

## Memory file path

```
~/Documents/Obsidian-Vault/02-Notes/Sessions/<TICKET>-<BRANCH>.md
```

Examples:
- `~/Documents/Obsidian-Vault/02-Notes/Sessions/PROJ-421-feature-pdf-export.md`
- `~/Documents/Obsidian-Vault/02-Notes/Sessions/PROJ-388-bugfix-auth-timeout.md`
- `~/Documents/Obsidian-Vault/02-Notes/Sessions/PROJ-512-main.md` ← fallback when branch has no ticket prefix

**Index location**:
```
~/.claude/memory/<TICKET>/session_index.db
```

---

## SESSION START — exact steps to execute

```bash
# 1. Get current branch
git branch --show-current
# → store result as {BRANCH}

# 2. Extract ticket ID from branch name (e.g. feature/PROJ-421-pdf → PROJ-421)
# Match pattern [A-Z]+-[0-9]+ in branch name, or use value from $ARGUMENTS if provided
# If no match, use "GENERAL" as ticket

# 3. Build vault-relative path
VAULT_REL="02-Notes/Sessions/{TICKET}-{BRANCH}.md"
```

**HIERARCHY CHECK** (run once per new session before Step 4):
```
mcp__ultimate-obsidian__list_vault({ path: "02-Notes/Sessions" })
```
Confirms the Sessions folder exists and shows existing session files.
Use the listing to verify the new filename `{TICKET}-{BRANCH}.md` is not a duplicate.

**Step 4 — Check for prior session** using `check_exists` MCP tool:
```
mcp__ultimate-obsidian__check_exists({ filepath: "02-Notes/Sessions/{TICKET}-{BRANCH}.md" })
```

**If EXISTS (returns `exists: true`):**

Read the file using `read_note` MCP tool:
```
mcp__ultimate-obsidian__read_note({ filepath: "02-Notes/Sessions/{TICKET}-{BRANCH}.md" })
```
- Print: `📂 Memory loaded for {TICKET} ({BRANCH})`
- Display: frontmatter keywords, last session date, implementation status
- **Search capability**: call `search_sessions` MCP tool with relevant keywords

**If DOES NOT EXIST (returns `exists: false`):**
- Print: `🆕 No prior memory for {TICKET}. Starting fresh.`
- Create the file using `create_or_update_note` MCP tool:

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{BRANCH}.md",
  mode: "overwrite",
  content: `---
title: "Session: {TICKET} / {BRANCH}"
ticket: {TICKET}
branch: {BRANCH}
date: {YYYY-MM-DD}
type: session-memory
phase: planning
keywords: []
tags: [#session, #{TICKET}]
---

# Session Memory: [[{TICKET}]] / {BRANCH}

**Created**: {ISO-8601 datetime}
**Ticket**: {Jira URL if available, or TICKET value}

---
`
})
```

---

## SESSION END — exact steps to execute

Append a dated entry to vault file, then index via MCP:

**Step 1 — Append session block** using `create_or_update_note` MCP tool:
```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{BRANCH}.md",
  mode: "append",
  content: `
## Session: {ISO-8601 datetime}

### Investigated
- {file:line} — {one-line finding}

### Decisions
- {decision and rationale}

### Implementation status
- [x] {completed item}
- [ ] {pending item}

### QA / Failures
- {what failed, test name or error — or "none"}

### Next steps
- {exact file:line to resume from}
`
})
```

**Step 2 — Index + extract keywords** using `index_note` MCP tool:
```
mcp__ultimate-obsidian__index_note({
  vault_path: "/Users/artur/Documents/Obsidian-Vault/02-Notes/Sessions/{TICKET}-{BRANCH}.md"
})
```
This replaces both `session_indexer.py --extract-keywords` and `--index-session`.
The tool updates the frontmatter `keywords:` field and rebuilds the FTS5 index in one call.

**Keyword extraction logic**:
- Runs inside the MCP server (`sqlite.ts`) — no Python required
- Top 10 keywords by term frequency from Investigated, Decisions, Implementation status
- Updates frontmatter `keywords: []` list in the vault file
- Adds/updates entry in `~/.claude/memory/{TICKET}/session_index.db` (SQLite FTS5)

---

## SEARCH SESSIONS — keyword search across all sessions

When user asks: "Search sessions for {keyword}", "What did we decide about {topic}", "Find sessions about {feature}":

Call the `search_sessions` MCP tool:
```
mcp__ultimate-obsidian__search_sessions({
  query: "{keyword}",
  ticket: "{TICKET or omit for all}",
  limit: 5
})
```

The tool queries `~/.claude/memory/*/session_index.db` (SQLite FTS5) and returns
BM25-ranked results. No Python or bash required.

**Output format**:
```
🔍 Search results for "{keyword}":

1. [[PROJ-421-feature-pdf]] — 2026-04-10
   "Investigated src/pdf/generator.ts:42 — **pdf** rendering with puppeteer"

2. [[PROJ-388-bugfix-auth]] — 2026-04-08
   "Decision: Use JWT tokens for **authentication**, not session cookies"

3. [[PROJ-512-main]] — 2026-04-05
   "QA Failure: **Auth** timeout not handled correctly in login flow"
```

---

## QA FAILURE resume protocol

When returning after a QA rejection:

```
# 1. Load memory (SESSION START above)
mcp__ultimate-obsidian__read_note({ filepath: "02-Notes/Sessions/{TICKET}-{BRANCH}.md" })

# 2. Read "Implementation status" and "QA / Failures" sections from the returned content

# 3. Search related sessions for context
mcp__ultimate-obsidian__search_sessions({ query: "{ticket} QA failure", limit: 3 })

# 4. Fetch fresh QA comments from Jira MCP
# Search comments for: fail, reject, QA, blocked, doesn't pass, acceptance

# 5. Synthesise and print:
# "In the previous session [date], X was implemented.
#  The QA failure reports: Y.
#  Related sessions found: [[TICKET-BRANCH1]], [[TICKET-BRANCH2]]
#  Likely root cause: Z.
#  Resuming from: <file:line>."

# 6. Append new session entry (SESSION END protocol)
```

---

## Token efficiency rules

- **Load**: Read frontmatter + last session only (first 50 lines)
- **Search**: Return top 5 BM25-ranked results, not all sessions
- **Write**: Store file:line references, not code snippets — one line per finding
- **Wikilinks**: Use [[TICKET-BRANCH]] for cross-references (Obsidian clickable)
- **Keywords**: Auto-extracted, not manually curated
- Never store secrets, tokens, or credentials

---

## Migration from task-memory

If migrating from old `~/.claude/memory/` structure:

```bash
# Run migration script (one-time, Node.js — no Python required)
node /Users/artur/Documents/ai-tools/ultimate-obsidian-mcp/scripts/migrate.js --execute

# This will:
# 1. Backup ~/.claude/memory/ to tarball
# 2. Convert each TICKET/BRANCH.md to vault format with frontmatter
# 3. Write to ~/Documents/Obsidian-Vault/02-Notes/Sessions/ via ultimate-obsidian MCP
# 4. Build FTS5 index for all migrated sessions via index_note MCP tool
# 5. Preserve all existing data (no data loss)
```

---

## Dependencies

- **Obsidian vault**: `~/Documents/Obsidian-Vault/` (must exist)
- **ultimate-obsidian MCP**: Running in Claude Code (`~/.claude/settings.json` → `ultimate-obsidian` entry)
  - Provides `create_or_update_note`, `read_note`, `index_note`, `search_sessions` tools
  - Handles all SQLite FTS5 indexing and BM25 search internally (TypeScript, no Python)
- **Node.js v20+**: Required only for the MCP server itself (already running)
- ~~Python 3.13+~~ — **not required** (replaced by MCP server)
- ~~session_indexer.py~~ — **deprecated** (replaced by `index_note` + `search_sessions` MCP tools)
- ~~rank_bm25~~ — **not required** (BM25 runs inside SQLite FTS5 in the MCP server)

---

## Advantages over task-memory

| Feature | task-memory (old) | session-memory (new) |
|---|---|---|
| Storage | Flat file `~/.claude/memory/` | Obsidian vault with frontmatter |
| Search | None (read last 3 sessions) | BM25 keyword search across all sessions |
| Cross-reference | None | Wikilinks `[[TICKET-BRANCH]]` |
| Metadata | None | Frontmatter: keywords, tags, phase, date |
| Cross-device sync | Manual file copy | Automatic (GDrive sync via memory-central) |
| Token cost | ~500 tokens (read full file) | ~200 tokens (frontmatter + last session) |
| Operations | Bash cat/mkdir/ls | MCP tool calls (TypeScript, no Python) |

---

## Example vault file

```markdown
---
title: "Session: PROJ-421 / feature-pdf-export"
ticket: PROJ-421
branch: feature-pdf-export
date: 2026-04-13
type: session-memory
phase: implementation
keywords: [pdf, puppeteer, export, rendering, implementation, completed]
tags: [#session, #PROJ-421, #implementation]
---

# Session Memory: [[PROJ-421]] / feature-pdf-export

**Created**: 2026-04-13T10:30:00Z
**Ticket**: https://jira.company.com/browse/PROJ-421

---

## Session: 2026-04-13T10:30:00Z

### Investigated
- src/pdf/generator.ts:42 — Puppeteer rendering pipeline
- src/pdf/templates/invoice.html:15 — CSS print styles for A4 layout

### Decisions
- Use Puppeteer instead of wkhtmltopdf for better CSS support
- Render at 1200px viewport for high-DPI export

### Implementation status
- [x] PDF generator service created
- [x] Invoice template with CSS print styles
- [ ] Integration tests for PDF output

### QA / Failures
none

### Next steps
- Write integration tests: tests/pdf/generator.test.ts

---

## Session: 2026-04-13T14:20:00Z

### Investigated
- tests/pdf/generator.test.ts:28 — Snapshot testing with jest-image-snapshot

### Decisions
- Use visual regression tests for PDF output quality

### Implementation status
- [x] PDF generator service created
- [x] Invoice template with CSS print styles
- [x] Integration tests for PDF output
- [x] All tests passing ✅

### QA / Failures
none

### Next steps
- PR ready: /prp-pr
```
