---
name: session-memory
description: >
  Persist and restore investigation findings, implementation decisions, and QA failure notes
  to Obsidian vault with frontmatter, wikilinks, and BM25 search. Replaces task-memory with
  vault-based architecture. Invoked automatically by prp-plan and prp-implement, or manually
  when asked to "save progress", "load context for PROJ-NNN", "what did we find last time",
  or when resuming after a QA failure.
user-invocable: true
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

# 3. Build vault path
VAULT_PATH=~/Documents/Obsidian-Vault/02-Notes/Sessions/{TICKET}-{BRANCH}.md

# 4. Check for prior session file
ls "$VAULT_PATH" 2>/dev/null
```

**If file EXISTS:**
```bash
# Read frontmatter and last session
head -50 "$VAULT_PATH"
```
- Print: `📂 Memory loaded for {TICKET} ({BRANCH})`
- Display: frontmatter keywords, last session date, implementation status
- **Search capability**: "Want to search past decisions? Ask: 'Search sessions for {keyword}'"

**If file DOES NOT EXIST:**
- Print: `🆕 No prior memory for {TICKET}. Starting fresh.`
- Create the file with frontmatter:

```bash
cat > "$VAULT_PATH" << 'EOF'
---
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
EOF
```

---

## SESSION END — exact steps to execute

Append a dated entry to vault file with keyword extraction:

```bash
# 1. Prepare session content
SESSION_CONTENT="
## Session: {ISO-8601 datetime}

### Investigated
- {file:line} — {one-line finding}

### Decisions
- {decision and rationale}

### Implementation status
- [x] {completed item}
- [ ] {pending item}

### QA / Failures
- {what failed, test name or error — or \"none\"}

### Next steps
- {exact file:line to resume from}
"

# 2. Append to vault file
cat >> "$VAULT_PATH" << 'EOF'
$SESSION_CONTENT
EOF

# 3. Extract keywords and update frontmatter
python3 /Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/tools/session_indexer.py \
  --extract-keywords "$VAULT_PATH"

# 4. Index session for BM25 search
python3 /Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/tools/session_indexer.py \
  --index-session "$VAULT_PATH"
```

**Keyword extraction logic**:
- Extract from: Investigated, Decisions, Implementation status sections
- Top 10 keywords by BM25 score
- Update frontmatter `keywords: []` list
- Add to FTS5 index for search

---

## SEARCH SESSIONS — keyword search across all sessions

When user asks: "Search sessions for {keyword}", "What did we decide about {topic}", "Find sessions about {feature}":

```bash
# 1. Determine ticket context (if any)
# If user specifies ticket → search only that ticket's index
# Otherwise → search all ticket indices

# 2. Query FTS5 index
python3 /Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/tools/session_indexer.py \
  --search "{keyword}" \
  --ticket {TICKET or "all"} \
  --limit 5

# 3. Display results:
# For each match, show:
# - Session title (TICKET/BRANCH)
# - Date
# - Matching snippet (with keyword highlighted)
# - Link: [[TICKET-BRANCH]]
```

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

```bash
# 1. Load memory (SESSION START above)
head -50 "$VAULT_PATH"

# 2. Read "Implementation status" and "QA / Failures" sections

# 3. Search related sessions for context
python3 /Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/tools/session_indexer.py \
  --search "{ticket} QA failure" \
  --limit 3

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
# Run migration script (one-time)
/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/tools/migrate-task-memory.sh --execute

# This will:
# 1. Backup ~/.claude/memory/ to tarball
# 2. Convert each TICKET/BRANCH.md to vault format with frontmatter
# 3. Move to ~/Documents/Obsidian-Vault/02-Notes/Sessions/
# 4. Build FTS5 index for all migrated sessions
# 5. Preserve all existing data (no data loss)
```

---

## Dependencies

- **Obsidian vault**: `~/Documents/Obsidian-Vault/` (must exist)
- **Python 3.13+**: For keyword extraction and indexing
- **session_indexer.py**: `/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/tools/session_indexer.py`
- **SQLite FTS5**: Built into Python 3 (no additional install)
- **rank_bm25**: `pip install rank-bm25` (for keyword extraction)

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
| Operations | Bash cat/mkdir/ls | Python + skill API |

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
