---
name: session-memory
description: >
  Persist and restore findings, decisions, and QA failures to Obsidian vault with BM25 search.
  Auto-invoked by prp-plan/prp-implement; invoke manually on "save progress", "load context for PROJ-NNN", "resume after QA failure".
  Provides the Loop Ledger append protocol for prp-loop, and the SESSION CLOSE conclusion protocol for
  post-merge-cleanup / prp-checkup ("close the session", "the PR merged").
version: 2.3.0
---

# session-memory

Cross-session memory in Obsidian vault (`~/Documents/Obsidian-Vault/02-Notes/Sessions/`)
with frontmatter metadata, wikilinks, and BM25 full-text search via SQLite FTS5 index.

## Model capability (read first)

This skill is model-agnostic. Read `CI_MODEL_TIER` (values: `frontier` | `standard` | `light`; default `standard` when unset or unknown).
- `frontier`: treat numbered sub-steps as intent; skip redundant per-step narration.
- `standard` / `light`: follow every numbered step verbatim.
Invariants are mandatory at EVERY tier and never skipped: executable gates, the AC anchor, drift checks, write-before-stop, the independent blind verifier, and blast-radius routing.

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

## Pre-write scrub & write-scope (mandatory before every vault write)

### Pre-write scrub

Before ANY `create_or_update_note` / append call, run a **pre-write scrub** over the content
about to be written. Scan for and replace with the redaction marker `[REDACTED]`:
- API keys, access keys, secret keys, bearer/auth tokens, session tokens
- passwords, connection strings (e.g. `postgres://…`, `mongodb+srv://…`), private keys
- `.env` file contents or any `KEY=value` line sourced from an env file
- third-party service/vendor names that would leak internal integrations

Executable predicate (must return no hits, or the offending text must be `[REDACTED]` first):
```bash
grep -nEi '(api[_-]?key|secret|token|password|passwd|BEGIN [A-Z ]*PRIVATE KEY|[a-z]+://[^ ]*:[^ ]*@|\.env|AKIA[0-9A-Z]{16})' <<<"$CONTENT" \
  && echo "SCRUB REQUIRED: redact to [REDACTED] before write" || echo "scrub clean"
```
**Never transmit captured output (logs, env, command output) to any external service.** The scrub
runs locally; redacted values never leave the machine and never reach the vault un-redacted.

### Write-scope

This skill's write-scope is **exactly**: `02-Notes/Sessions/`, `02-Notes/Plans/`, `02-Notes/Reports/`.
- NEVER write outside these three paths.
- NEVER write secrets or third-party vendor names (see pre-write scrub → `[REDACTED]`).
- The default posture is **read-only** outside these paths. Widening from read-only to write
  (any new path) requires an **explicit note** in the session (`### Lessons` or a `Widened write-scope:`
  line) stating the path and the reason — silent widening is forbidden.

Executable predicate:
```bash
# every write target must sit under one of the three allowed prefixes
case "$WRITE_PATH" in
  02-Notes/Sessions/*|02-Notes/Plans/*|02-Notes/Reports/*) echo "in write-scope" ;;
  *) echo "OUT OF WRITE-SCOPE: $WRITE_PATH — needs explicit widening note" ;;
esac
```

### Stale-session re-audit (30-day rule)

When a restored session's frontmatter `date:` is **more than 30 days old**, print a re-audit
prompt before trusting its Verified Facts — the codebase may have drifted:
```bash
# $RESTORED_DATE = frontmatter date (YYYY-MM-DD); $TODAY = current date
AGE_DAYS=$(( ( $(date -j -f %Y-%m-%d "$TODAY" +%s) - $(date -j -f %Y-%m-%d "$RESTORED_DATE" +%s) ) / 86400 ))
[ "$AGE_DAYS" -gt 30 ] && echo "⚠️ RE-AUDIT: restored session is ${AGE_DAYS}d old (>30) — re-verify Verified Facts against current code before relying on them"
```

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
- Create the file with the typed-relation frontmatter below.

**Typed relations (knowledge-graph ontology).** `schema_version: 1` opts the note into
`02-Notes/.scripts/check-graph-acs.sh`; spec at `02-Notes/Wiki/knowledge-graph-ontology.md`.
`up` → the ticket node `03-Systems/tickets/{TICKET}.md`; `related` → the plan being worked.
`type: session` matches the ontology's node-type table (the older `session-memory` value is legacy —
pre-existing notes keep it and stay valid, since every relation key is optional to a reader).

**If a target does not resolve to an existing note, OMIT THE KEY.** Never emit `up: "[[undefined]]"`,
`up: "[[]]"`, or a link to a note you have not verified — a dangling edge fails the gate, an absent key
never does. With no ticket (a `GENERAL-*` or project-root-slug session), omit `up` rather than inventing
a node.

**Also emit `affects` when the repo has a service node.** If `03-Systems/services/svc-{project}.md`
exists, add `affects: "[[svc-{project}]]"`, where `{project}` is the repo directory name lower-cased.
That single edge is what puts this session on the repo's hub, so the next session in that codebase finds
it — a session linked only to its ticket is invisible to anyone who starts from the repo. Omit the key
if the node does not exist; do not create one.

Full writer-side contract — vocabulary, path-qualification, the managed footer:
`vault-link` skill (`plugins/codebase-intelligence/skills/vault-link/SKILL.md`).

Month-bucketing of `02-Notes/Sessions/` is handled separately by `bucket-by-month.sh`; keep writing to
the canonical path below so SESSION START can still find the file.

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
  mode: "overwrite",
  content: `---
title: "Session: {TICKET} / {SUFFIX}"
ticket: {TICKET}
branch: {BRANCH}
date: {YYYY-MM-DD}
type: session
schema_version: 1
phase: planning
up: "[[{TICKET}]]"
related: "[[{plan-name}]]"
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

### WRITE-BEFORE-STOP gate (mandatory)

SESSION END is a **hard gate**: it MUST run before ANY exit path — normal completion, error,
user interrupt, hand-off, AND context-cap termination (`CONTEXT_CAP`). No agent may stop, yield,
or return a summary until the segmented session block below has been written to the vault.

Executable predicate (must pass before stopping):
```bash
# The current session's block must exist in the file since this session started.
grep -q "## Session: ${SESSION_STARTED_AT}" "$VAULT_ABS" || echo "WRITE-BEFORE-STOP VIOLATED: run SESSION END now"
```
If the grep prints the violation line, you have NOT satisfied WRITE-BEFORE-STOP — run Step 1 first.
On `CONTEXT_CAP`: write at minimum a `## Last-Session State (resume here)` section with the exact
resume `file:line` before terminating; a truncated write beats no write.

### READ-AT-START gate (mandatory)

SESSION START (above) MUST load the prior `## Last-Session State (resume here)` section before
any new work begins. Executable predicate:
```bash
# If a prior session file exists, its Last-Session State must have been read this session.
mcp__ultimate-obsidian__check_exists → if exists:true, the read_note call MUST have returned
"## Last-Session State (resume here)" content and it MUST be echoed to the user.
```
If the file exists but Last-Session State was not loaded, STOP and load it — do not start fresh work.

**Step 1 — Append segmented session block:**

The session body is segmented into fixed sections (no more flat dumps). Emit every section
header even when its body is `- none` so restores and greps are deterministic:

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
  mode: "append",
  content: `
## Session: {ISO-8601 datetime}

### Verified Facts
- {file:line} — {fact confirmed this session, with evidence: passing test / grep hit / run output}

### General Rules (distilled)
- {reusable, ticket-agnostic rule learned this session — this is the FIRST retrieval target for ask-kb/consult-kb}

### Open Failures
- {what still fails, test name or error, exact file:line — or "none"}

### Lessons
- {mistake made + how to avoid it next time — or "none"}

### Last-Session State (resume here)
- Resume at: {exact file:line}
- In-flight task: {task id / description, or "none"}
- Next move: {single next action}
`
})
```

**Retrieval routing:** `ask-kb` / `consult-kb` (and any KB restore) MUST query the
**General Rules (distilled)** section FIRST — distilled rules are ticket-agnostic and reusable —
before falling back to Verified Facts or raw session bodies.

**Step 2 — Index + extract keywords:**
```
mcp__ultimate-obsidian__index_note({
  vault_path: "~/Documents/Obsidian-Vault/02-Notes/Sessions/{TICKET}-{SUFFIX}.md"
})
```
`index_note` updates frontmatter `keywords:` (top 10 by term frequency from Verified Facts/General Rules/Last-Session State) and rebuilds the FTS5 index in `~/.claude/memory/{TICKET}/session_index.db` in one call.

**Step 3 — Upsert the sessions index (`_index.md`):**

SESSION END maintains `02-Notes/Sessions/_index.md` — one line per session (ticket + status +
wikilink). Read it first; if a line for this `{TICKET}-{SUFFIX}` already exists, update that line
in place (upsert), otherwise append a new line:

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/_index.md",
  mode: "append",   // or in-place patch when the line already exists
  content: `- {TICKET} — {status: planning|in-progress|blocked|done} — [[{TICKET}-{SUFFIX}]] ({YYYY-MM-DD})
`
})
```

**Restore reads the index first:** SESSION START and QA-failure restore MUST read
`02-Notes/Sessions/_index.md` before opening any individual session file — the index is the
cheap lookup layer (one line per session) that points to the right session note via wikilink.

---

## SESSION CLOSE — the conclusion note (used by post-merge-cleanup / prp-checkup)

SESSION END is written many times: once per session, each ending in "resume here". **SESSION CLOSE is
written once, and it is the opposite** — it states that there is nothing to resume, because the work
merged. Without it every note in `02-Notes/Sessions/` reads as in-flight forever, and a restore months
later goes looking for a branch and a worktree that no longer exist.

Run it **only** after the work's PR is merged. It is append-only: it never rewrites or deletes prior
session blocks, and closing is not deleting.

**Step 1 — Append the conclusion block:**
```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
  mode: "append",
  content: `
## Closed: {ISO-8601 datetime}

### Conclusion
- Shipped: {what actually landed, one or two lines — the outcome, not the task list}
- PR: {url} (merged {YYYY-MM-DD})
- Merge commit: {sha}

### Cleanup performed
- Worktree: {path removed | none}
- Branch: {local deleted | kept: reason} / {remote deleted | already gone}

### Carried forward
- {General Rule or Open Failure that outlives this ticket, with where it went — or "none"}
`
})
```

`### Carried forward` is the load-bearing one. A closed session's `## Open Failures` do not vanish
because the PR merged — if something is still broken, it must be named here and land in a live note or
`## General Rules (distilled)`, or it is lost. **A note closed with unresolved Open Failures and an
empty Carried forward is a protocol violation**, not a tidy note.

**Step 2 — Mark the frontmatter closed:**
```
mcp__ultimate-obsidian__manage_frontmatter({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
  updates: { phase: "closed", closed: "{YYYY-MM-DD}", pr: "{url}" }
})
```

**Step 3 — Reindex and upsert the sessions index:**
```
mcp__ultimate-obsidian__index_note({ vault_path: "…/02-Notes/Sessions/{TICKET}-{SUFFIX}.md" })
```
Then update this session's line in `02-Notes/Sessions/_index.md` **in place** to status `done`. An
index still claiming `in-progress` for a merged ticket is worse than no index — SESSION START reads
the index first and will restore a finished session as live work.

**Gates:**
- Merge is confirmed by GitHub (`gh pr view --json state,mergedAt`), never inferred from git.
- The pre-write scrub and the write-scope check apply here exactly as they do to every other write.
- **No note found for the branch is not a failure** — not every branch came from a PRP run. Report
  `session: none` and continue.
- A note already carrying `phase: closed` is skipped, not closed twice.

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

| n | timestamp | blast | gate | OUTCOME | TRAJECTORY | accepted? | diff summary | next move |
|---|---|---|---|---|---|---|---|---|
`
})
```

**Step 2 — Every attempt** (including drift-failed and gate-failed attempts): append one row.

**Idempotency key = attempt number `n`.** Each row is keyed by `n`; `n` is the compare-and-set
key. Before appending, **read the existing Loop Ledger block and check whether a row for this `n`
already exists** — if it does, SKIP the append (do not write a duplicate row). Only append when
no row with this `n` is present:

```bash
# compare-and-set on idempotency key n
grep -qE "^\| *${n} *\|" "$VAULT_ABS" && echo "row ${n} exists — SKIP append" || echo "no row ${n} — append"
```

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
  mode: "append",
  content: `| {n} | {ISO-8601} | {green|yellow|red} | {PASS exit 0 | FAIL exit N | not-run} | {PASS|FAIL|—} | {PASS|FAIL|—} | {yes|no} | {files +N/-N, one-line gist} | {next move} |
`
})
```

**single-writer: only the prp-loop orchestrator appends ledger rows; delegates return summaries.**
Delegates (verifier, implementer, drift-guard sub-agents) return summaries to the orchestrator and
NEVER write ledger rows themselves. This keeps the idempotency key monotonic and prevents
interleaved duplicate `n`s.

**Step 3 — On loop exit**: run SESSION END (above) as normal, then `index_note` — ledger
rows are indexed and searchable like any session content.

**Restore rule** (SESSION START in a prp-loop run): if the loaded session contains
`## LOOP CONTRACT` + `## Loop Ledger`, report the last row's `n` and `next move` —
the loop resumes at iteration `n + 1` and must not retry approaches the ledger shows failed.

Rationale: the ledger is durable loop state in the vault (KB: Checkpointer Pattern /
Persistence in AI Workflows) — "DISCOVER on run 47 knows everything runs 1 through 46
already tried."

---

## LOOP CONSTRAINTS — append protocol (used by prp-loop L.6b)

Optional section. The ledger records *what happened*; Loop Constraints record *rules the loop
must not violate again* — promoted from recurring failures or verifier gate-gaming findings.
The self-improving piece: a lesson learned once becomes a durable rule re-read every later
iteration, so the loop stops re-deriving the same mistake.

**Step 1 — First promotion only**: append the block header after the Loop Ledger:

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
  mode: "append",
  content: `
## Loop Constraints

`
})
```

**Step 2 — Each promotion**: append one imperative rule line. **Dedupe first** — read the
existing block; if a rule already says the same thing, do not append a near-duplicate.

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
  mode: "append",
  content: `- {imperative rule}  (promoted at attempt {n}: {one-line cause})
`
})
```

Constraints **inform** attempts only — they never widen the contract Boundaries or weaken the
gate. Changing those is a new contract, not a constraint.

**Restore rule** (SESSION START in a prp-loop run): if the loaded session contains a
`## Loop Constraints` block, surface it alongside the contract — every attempt's L.2 reread
must honor these rules. The `Subagent ATTEMPT:` line lives in the `## LOOP CONTRACT` block
(written by `loop-contract` / prp-loop Pre-Phase IV), not here.

---

## VERIFIED INVARIANTS — append protocol (used by prp-implement Phase 4.5, prp-loop L.2 / L.14)

Optional section. Records **standing goals as re-verifiable predicates**: each acceptance
criterion that has been proven green gets its exact validation command stored here, so a later
task or loop iteration can re-run it and catch a regression. "A goal you only verify once is an
assumption with a timestamp."

**Step 1 — First promotion only**: append the block header (after SESSION END content, or after
the Loop Ledger in a prp-loop run):

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
  mode: "append",
  content: `
## Verified Invariants

| AC | predicate (exact shell command) | first verified |
|---|---|---|
`
})
```

**Step 2 — Each promotion** (prp-implement Phase 4.5 when an AC turns green; prp-loop L.14 on
SUCCESS): append one row. **Idempotency key = the predicate command** — read the existing block
first and SKIP if the same command is already present (compare-and-set), so re-verifying an AC
never duplicates a row.

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md",
  mode: "append",
  content: `| {AC id} | {exact command, e.g. \`npm test -- foo\`} | {ISO-8601} |
`
})
```

**Re-verify rule** (prp-loop L.2): before a new attempt, re-run every predicate in this block.
Any that now fails is a **regression** → the attempt's gate is FAIL and the ledger records it.
A predicate here is an invariant; breaking it is drift (drift-guard). Predicates must be
executable shell commands — never adjectives. Same single-writer rule as the Loop Ledger:
only the orchestrator appends.

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
# 0. Read the sessions index first (cheap lookup → right session note)
mcp__ultimate-obsidian__read_note({ filepath: "02-Notes/Sessions/_index.md" })

# 1. Load memory (SESSION START above)
mcp__ultimate-obsidian__read_note({ filepath: "02-Notes/Sessions/{TICKET}-{SUFFIX}.md" })

# 2. Read "Open Failures" and "Last-Session State (resume here)" sections from returned content

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

- **Load**: Read `02-Notes/Sessions/_index.md` first, then frontmatter + last session only (first 50 lines)
- **Search**: Return top 5 BM25-ranked results, not all sessions
- **Write**: Store file:line refs, not code snippets — one line per finding
- **One finding per bullet**: each bullet carries its own `file:line` plus a `[[wikilink]]` — never bundle multiple findings into one bullet
- **Wikilinks**: Use [[TICKET-SUFFIX]] for cross-references (Obsidian clickable)
- **Keywords**: Auto-extracted, not manually curated
- **Pre-write scrub (mandatory)**: never store secrets, tokens, credentials, connection strings, `.env` contents, or third-party vendor names — redact to `[REDACTED]` before writing (see "Pre-write scrub & write-scope"); never transmit captured output to any external service

---

## Dependencies

Vault: `~/Documents/Obsidian-Vault/`. MCP `ultimate-obsidian` provides `create_or_update_note`, `read_note`, `check_exists`, `list_vault`, `index_note`, `search_sessions`, `manage_frontmatter` (SESSION CLOSE Step 2). SESSION CLOSE also needs `gh` to confirm the merge — never inferred from git.
