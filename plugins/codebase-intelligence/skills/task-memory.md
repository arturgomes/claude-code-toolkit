---
name: task-memory
description: >
  Persist and restore investigation findings, implementation decisions, and QA failure notes
  across sessions keyed by Jira ticket + git branch. Invoked automatically by the enhanced
  prp-plan and prp-implement commands. Also invoke manually when asked to "save progress",
  "load context for PROJ-NNN", "what did we find last time", or when resuming after a QA failure.
user-invocable: true
---

# task-memory

Cross-session memory for development tasks. All data lives in `~/.claude/memory/` — never
inside any project directory, never committed to git.

## Memory file path

```
~/.claude/memory/<JIRA-TICKET>/<git-branch>.md
```

Examples:
- `~/.claude/memory/PROJ-421/feature-pdf-export.md`
- `~/.claude/memory/PROJ-388/bugfix-auth-timeout.md`
- `~/.claude/memory/PROJ-512/main.md`  ← fallback when branch has no ticket prefix

---

## SESSION START protocol

Run at the start of every planning or implementation session:

```
1. Run: git branch --show-current  → store as {branch}
2. Extract ticket: match [A-Z]+-[0-9]+ from {branch}, or from user input
3. Build path: ~/.claude/memory/{TICKET}/{BRANCH}.md
4. If file EXISTS:
     - Read full contents
     - Print: "📂 Memory loaded for {TICKET} ({branch})"
     - Summarise: last session date · implementation status · open blockers
     - Ask: "Continue from last session, or start fresh?"
5. If file DOES NOT EXIST:
     - Print: "🆕 No prior memory for {TICKET}. Starting fresh."
     - mkdir -p ~/.claude/memory/{TICKET}/
     - Create file with the EMPTY TEMPLATE below
```

## SESSION END protocol

Append a dated entry after every significant milestone or at natural end:

```markdown
## Session: <ISO-8601 date and time>

### Investigated
- <file:line> — <one-line finding>
- <file:line> — <one-line finding>

### Decisions
- <decision and rationale>

### Implementation status
- [x] <completed item>
- [ ] <pending item>

### QA / Failures
- <what failed, test name or error, what was tried>

### Next steps
- <exact file:line to resume from, what needs doing>
```

---

## QA FAILURE resume protocol

When the user returns after a QA rejection (possibly weeks later):

```
1. Load memory file (SESSION START protocol)
2. Read "Implementation status" and "QA / Failures" sections from prior sessions
3. Fetch fresh QA failure details from Jira (Atlassian MCP — search comments for
   keywords: fail, reject, QA, blocked, doesn't pass, acceptance)
4. Cross-reference prior implementation with the new failure details
5. Synthesise and print:
   "In the previous session [date], X was implemented.
    The QA failure reports: Y.
    Likely root cause: Z.
    Resuming from: <file:line>."
6. Append new session entry titled "## Session: <date> — QA Resume"
```

---

## Empty template (created on first use)

```markdown
# Memory: <JIRA-TICKET> / <branch>

Created: <ISO date>
Ticket: <full Jira URL if available>

---
<!-- Sessions appended below by task-memory skill -->
```

---

## Token efficiency rules

- On load: read only the last 3 sessions by default; load all only when explicitly asked
- On write: store file:line references, not full code snippets
- One-line limit per finding — enough to locate, not enough to reproduce
- Never store secrets, tokens, or credentials
- Memory files are plain Markdown only — no JSON, no binary
