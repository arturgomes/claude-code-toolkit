---
name: task-memory
description: >
  Persist and restore investigation findings, implementation decisions, and QA failure notes
  across sessions keyed by Jira ticket + git branch. Invoked automatically by prp-plan and
  prp-implement. Also invoke manually when asked to "save progress", "load context for PROJ-NNN",
  "what did we find last time", or when resuming after a QA failure.
user-invocable: true
---

# task-memory

Cross-session memory stored globally in `~/.claude/memory/` — persists across all projects
and sessions, never inside any repo directory.

## Memory file path

```
~/.claude/memory/<JIRA-TICKET>/<git-branch>.md
```

Examples:
- `~/.claude/memory/PROJ-421/feature-pdf-export.md`
- `~/.claude/memory/PROJ-388/bugfix-auth-timeout.md`
- `~/.claude/memory/PROJ-512/main.md`  ← fallback when branch has no ticket prefix

---

## SESSION START — exact steps to execute

```bash
# 1. Get current branch
git branch --show-current
# → store result as {BRANCH}

# 2. Extract ticket ID from branch name (e.g. feature/PROJ-421-pdf → PROJ-421)
# Match pattern [A-Z]+-[0-9]+ in branch name, or use value from $ARGUMENTS if provided

# 3. Ensure memory directory exists
mkdir -p ~/.claude/memory/{TICKET}

# 4. Check for prior session file
ls ~/.claude/memory/{TICKET}/{BRANCH}.md 2>/dev/null
```

**If file EXISTS:**
```bash
cat ~/.claude/memory/{TICKET}/{BRANCH}.md
```
- Print: `📂 Memory loaded for {TICKET} ({BRANCH})`
- Summarise: last session date · implementation status · open blockers
- Ask: "Continue from last session, or start fresh?"

**If file DOES NOT EXIST:**
- Print: `🆕 No prior memory for {TICKET}. Starting fresh.`
- Create the file immediately:

```bash
cat > ~/.claude/memory/{TICKET}/{BRANCH}.md << 'EOF'
# Memory: {TICKET} / {BRANCH}

Created: {ISO date}
Ticket: {Jira URL if available}

---
EOF
```

---

## SESSION END — exact steps to execute

Append a dated entry to `~/.claude/memory/{TICKET}/{BRANCH}.md`:

```bash
cat >> ~/.claude/memory/{TICKET}/{BRANCH}.md << 'EOF'

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
EOF
```

---

## QA FAILURE resume protocol

When returning after a QA rejection:

```bash
# 1. Load memory (SESSION START above)
cat ~/.claude/memory/{TICKET}/{BRANCH}.md

# 2. Read "Implementation status" and "QA / Failures" sections

# 3. Fetch fresh QA comments from Jira MCP
# Search comments for: fail, reject, QA, blocked, doesn't pass, acceptance

# 4. Synthesise and print:
# "In the previous session [date], X was implemented.
#  The QA failure reports: Y.
#  Likely root cause: Z.
#  Resuming from: <file:line>."

# 5. Append new session entry
```

---

## Token efficiency rules

- Load: read only last 3 sessions by default; all only when explicitly asked
- Write: store file:line references, not full code snippets — one line per finding
- Never store secrets, tokens, or credentials
