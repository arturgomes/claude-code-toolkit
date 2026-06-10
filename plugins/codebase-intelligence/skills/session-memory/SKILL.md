---
name: session-memory
description: >
  Persist and restore findings, decisions, and QA failures to Obsidian vault with BM25 search.
  Auto-invoked by prp-plan/prp-implement; invoke manually on "save progress", "load context for PROJ-NNN", "resume after QA failure".
  Provides the Loop Ledger append protocol for prp-loop.
version: 2.1.0
---

# session-memory

Cross-session memory in Obsidian vault (`~/Documents/Obsidian-Vault/02-Notes/Sessions/`)
with frontmatter metadata, wikilinks, and BM25 full-text search via SQLite FTS5 index.

## Memory file path

```
~/Documents/Obsidian-Vault/02-Notes/Sessions/<TICKET>-<SUFFIX>.md
```

Examples:
- `~/Documents/Obsidian-Vault/02-Notes/Sessions/PROJ-421-pdf-export.md`
- `~/Documents/Obsidian-Vault/02-Notes/Sessions/PROJ-388-bugfix-auth-timeout.md`
- `~/Documents/Obsidian-Vault/02-Notes/Sessions/my-project-add-pdf-export.md` ← fallback: {project-root-name}-{feature-slug}

**Index location**: `~/.claude/memory/<TICKET>/session_index.db`

---

## SESSION START — exact steps to execute

```bash
# 1. Get current branch
git branch --show-current
# → store result as {BRANCH}

# 2. Extract ticket ID from branch (e.g. feature/PROJ-421-pdf → PROJ-421)
# Match pattern [A-Z]+-[0-9]+ in branch name, or use $ARGUMENTS if provided.
# If no match, derive project root folder name:
#   basename $(git rev-parse --show-toplevel 2>/dev/null || pwd)
# e.g. /Users/artur/Documents/ai-tools/claude-code-toolkit → "claude-code-toolkit"
# → store result as {TICKET}

# 3. Build filename suffix {SUFFIX}:
# Non-descriptive branches (main, master, develop, development, HEAD, trunk):
#   → slugify feature description to kebab-case (3–5 words from $ARGUMENTS or task context)
#   e.g. "add project root tag fallback" → "project-root-tag-fallback"
# Descriptive branches (feature/PROJ-421-pdf-export, fix-auth-timeout, etc.):
#   → strip ticket prefix if present, use remainder as suffix
#   e.g. "feature/PROJ-421-pdf-export" → "pdf-export"
#   e.g. "fix-auth-timeout" → "fix-auth-timeout"
# Fallback (no description, generic branch): use "session"

# 4. Build vault-relative path
VAULT_REL="02-Notes/Sessions/{TICKET}-{SUFFIX}.md"
```

**HIERARCHY CHECK** (run once per new session before Step 4):
```
mcp__ultimate-obsidian__list_vault({ path: "02-Notes/Sessions" })
```
Confirms Sessions folder exists; verify new filename `{TICKET}-{SUFFIX}.md` is not a duplicate (SUFFIX = feature slug or branch).

**Step 4 — Check for prior session:**
```
mcp__ultimate-obsidian__check_exists({ filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md" })
```

**If EXISTS** (`exists: true`):
```
mcp__ultimate-obsidian__read_note({ filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md" })
```
- Print: `📂 Memory loaded for {TICKET} ({SUFFIX})`
- Display: frontmatter keywords, last session date, implementation status
- Search capability: call `search_sessions` with relevant keywords

**If DOES NOT EXIST** (`exists: false`):
- Print: `🆕 No prior memory for {TICKET}. Starting fresh.`
- Create the file:

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
  mode: "overwrite",
  content: `---
title: "Session: {TICKET} / {SUFFIX}"
ticket: {TICKET}
branch: {BRANCH}
date: {YYYY-MM-DD}
type: session-memory
phase: planning
keywords: []
tags: [#session, #{TICKET}]
---

# Session Memory: [[{TICKET}]] / {SUFFIX}

**Created**: {ISO-8601 datetime}
**Ticket**: {Jira URL if available, or TICKET value}

---
`
})
```

---

## SESSION END — exact steps to execute

**Step 1 — Append session block:**
```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
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

**Step 2 — Index + extract keywords:**
```
mcp__ultimate-obsidian__index_note({
  vault_path: "~/Documents/Obsidian-Vault/02-Notes/Sessions/{TICKET}-{SUFFIX}.md"
})
```
`index_note` updates frontmatter `keywords:` (top 10 by term frequency from Investigated/Decisions/Implementation status) and rebuilds the FTS5 index in `~/.claude/memory/{TICKET}/session_index.db` in one call.

---

## LOOP LEDGER — append protocol (used by prp-loop)

Optional section. Only present in sessions driven by `prp-loop`; SESSION START/END are
unchanged whether or not it exists.

**Step 1 — First attempt only**: append the table header after the LOOP CONTRACT block
(the contract is appended by the `loop-contract` skill):

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
  mode: "append",
  content: `
## Loop Ledger

| n | timestamp | gate | verifier | diff summary | next move |
|---|---|---|---|---|---|
`
})
```

**Step 2 — Every attempt** (including drift-failed and gate-failed attempts): append one row:

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
  mode: "append",
  content: `| {n} | {ISO-8601} | {PASS exit 0 | FAIL exit N | not-run} | {PASS | FAIL | —} | {files +N/-N, one-line gist} | {next move} |
`
})
```

**Step 3 — On loop exit**: run SESSION END (above) as normal, then `index_note` — ledger
rows are indexed and searchable like any session content.

**Restore rule** (SESSION START in a prp-loop run): if the loaded session contains
`## LOOP CONTRACT` + `## Loop Ledger`, report the last row's `n` and `next move` —
the loop resumes at iteration `n + 1` and must not retry approaches the ledger shows failed.

Rationale: the ledger is durable loop state in the vault (KB: Checkpointer Pattern /
Persistence in AI Workflows) — "DISCOVER on run 47 knows everything runs 1 through 46
already tried."

---

## SEARCH SESSIONS — keyword search across all sessions

When user asks: "Search sessions for {keyword}", "What did we decide about {topic}", "Find sessions about {feature}":

```
mcp__ultimate-obsidian__search_sessions({
  query: "{keyword}",
  ticket: "{TICKET or omit for all}",
  limit: 5
})
```

Queries `~/.claude/memory/*/session_index.db` (SQLite FTS5), returns BM25-ranked results.

**Output format:**
```
🔍 Search results for "{keyword}":

1. [[PROJ-421-feature-pdf]] — 2026-04-10
   "Investigated src/pdf/generator.ts:42 — **pdf** rendering with puppeteer"

2. [[PROJ-388-bugfix-auth]] — 2026-04-08
   "Decision: Use JWT tokens for **authentication**, not session cookies"
```

---

## QA FAILURE resume protocol

```
# 1. Load memory (SESSION START above)
mcp__ultimate-obsidian__read_note({ filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md" })

# 2. Read "Implementation status" and "QA / Failures" sections from returned content

# 3. Search related sessions for context
mcp__ultimate-obsidian__search_sessions({ query: "{ticket} QA failure", limit: 3 })

# 4. Fetch fresh QA comments from Jira MCP — search for: fail, reject, QA, blocked, doesn't pass, acceptance

# 5. Synthesise + print:
# "In the previous session [date], X was implemented.
#  The QA failure reports: Y.
#  Related sessions: [[TICKET-BRANCH1]], [[TICKET-BRANCH2]]
#  Likely root cause: Z.
#  Resuming from: <file:line>."

# 6. Append new session entry (SESSION END protocol)
```

---

## Token efficiency rules

- **Load**: Read frontmatter + last session only (first 50 lines)
- **Search**: Return top 5 BM25-ranked results, not all sessions
- **Write**: Store file:line refs, not code snippets — one line per finding
- **Wikilinks**: Use [[TICKET-SUFFIX]] for cross-references (Obsidian clickable)
- **Keywords**: Auto-extracted, not manually curated
- Never store secrets, tokens, or credentials

---

## Dependencies

Vault: `~/Documents/Obsidian-Vault/`. MCP `ultimate-obsidian` provides `create_or_update_note`, `read_note`, `check_exists`, `list_vault`, `index_note`, `search_sessions`.
