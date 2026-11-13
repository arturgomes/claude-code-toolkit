# The vault is the system of record

The single definition of what gets persisted, where, and when. Every command and skill in this plugin
cites this file instead of restating it.

Reading the vault without writing back is the most common way a run loses its value: the next session
re-derives what this one already proved. **A run that produces findings and writes no vault note has
failed its persistence contract, even if the code shipped.**

## 1. Every durable artifact is a vault note, written the moment it exists

Not at shutdown. Not "once I've got the whole picture". Context can end at any point, and an
unwritten finding is a lost finding.

| Artifact | Vault path | Mode |
|---|---|---|
| Session memory | `02-Notes/Sessions/<TICKET>-<SUFFIX>.md` | append |
| **Step log** — panel lens outputs, subagent reports, any intermediate markdown | `02-Notes/Sessions/<TICKET>-<SUFFIX>.steps.md` | append |
| **Orchestration state** (machine-readable run state) | `02-Notes/Sessions/<TICKET>-<SUFFIX>.state.md` | **overwrite** |
| **`pre-pr-gate` receipt** | `receipts[]` inside that same `.state.md` | **overwrite** |
| Refinement contract | `02-Notes/Plans/<slug>.refinement.md` | overwrite |
| Plan | `02-Notes/Plans/<YYYY-MM>/<slug>.plan.md` | overwrite |
| PRD | `02-Notes/Specs/<slug>.prd.md` | overwrite |
| Report — implementation, loop, doubt, audit, review, convergence, analysis | `02-Notes/Reports/<YYYY-MM>/<slug>-report.md` | overwrite |
| PR description (**before** the PR is opened) | `02-Notes/pr-descriptions/<YYYY-MM-DD>-<TICKET>-<slug>[-<repo>].md` | overwrite |
| Cleanup ledger (`/prp-checkup`) | `02-Notes/Sessions/prp-checkup-<repo>.md` | overwrite |
| Epic run ledger (`/prp-epic`) | `02-Notes/Sessions/epic-<KEY>.md` | overwrite |
| Ticket node | `03-Systems/tickets/<TICKET>.md` | append |
| Service / table node | `03-Systems/…` from `_templates/system.md` | append |
| Drafted external comms (Jira comment bodies, review replies) | the session note, or beside the plan in `02-Notes/Plans/` | append |

**Overwrite vs append is not a preference.** A note holding one machine-readable document
(`.state.md`, a receipt, a plan) is always a whole-note overwrite of one full instance — an appended
JSON document is an unparseable file. A note holding a history (a session, a ledger of attempts, a
ticket node) is always append, so the earlier rows survive.

**Step log blocks.** `<TICKET>-<SUFFIX>` is exactly the session note's (session-memory's naming step —
resolve or create the session note first; the step log is that path with `.md` → `.steps.md`). Frontmatter:
`type: steps`, `related: "[[<TICKET>-<SUFFIX>]]"`. Each entry is `## Step NN — {ISO-8601} — {phase} / {actor}`
(e.g. `## Step 03 — 2026-10-29T10:12:00Z — refinement / product-owner`) followed by the content verbatim,
after the scrub in `./secret-scrub.md`. `NN` is zero-padded to two digits, re-counted from the note
immediately before each append (`^## Step \d+`) — never from a cached count. One writer per note: the
orchestrating context appends parallel returns in arrival order; in a worktree fan-out only the mediator
writes it. Subagents return text and never append. The `.state.md` beside it is a different note:
machine-readable, overwrite.

**Match the existing folder convention by listing the target directory first** — never invent a
layout. Session notes follow `02-Notes/Sessions/_session-template.md`.

## 2. No local mirror. Ever.

**Never** write run state to `<repo>/.claude/*.json`, or any other local copy of an artifact from the
table above — not as a cache, not as a convenience, not as a fallback when the MCP is unreachable.

A repo-local file is:
- **invisible to the sibling worktrees** that must read it (this is what makes it a correctness bug,
  not a style preference),
- **invisible to the next session**,
- **invisible to your other machine**, and
- **destroyed with the checkout**.

If the vault write fails, **the phase stops and reports a blocker**. It does not degrade to a local
file — writing one "just to keep going" recreates exactly the bug this rule replaced. The trade is
deliberate and stated: state requires the MCP to be reachable, and an unreachable vault fails loudly
instead of drifting silently.

## 3. Write-before-report

A phase is not complete until its vault write returned OK. Never defer with "I'll save this at the
end". Report the write, then report the finding.

## 4. Scratch is scratch

The session scratchpad, `/tmp`, and repo-local staging dirs (`planning/`, `.planning/`,
`artur-documents/`, …) are ephemeral working space for a single phase. **Anything written there that a
future session would want must also be written to the vault before the phase closes.**

**Working markdown never goes to scratch.** Intermediate `*.md` — panel lens outputs, subagent
reports, drafts not destined for a repo path or a §1 vault path — is appended to the step log the moment
it exists; reading it back is `read_note`, not `cat`. Deliverable markdown (repo files, opt-in `specs/`,
`.claude/constitution.md`, auto-memory notes) is unaffected. Scratch remains for non-markdown working
files only. A PreToolUse guard hook (`hooks/scratch-guard/`) refuses `*.md` writes under `/tmp` or the
scratchpad — fail-open, path-based, so a checkout that itself lives under `/tmp` needs
`CI_SCRATCH_MD_GUARD=off` (also `0` / `false`).

**Every record is a vault note.** A record is anything a later session, another machine, or the user
would want to read: session memory, run state, gate receipts, plans, reports, PR descriptions, loop
ledgers, the write ledger, extracted findings. **No record may exist only in `~/.claude/`, `/tmp`,
the session scratchpad, or a repo-local directory** — not as a primary copy, not as a cache of one,
not "for now". The user must be able to see, edit, and sync every record from the vault.

Exactly three things legitimately live outside the vault:

1. **`.claude/constitution.md`** and **`.claude/CONSTRAINTS.md`** — a repo owns these by contract (git-tracked; `prp-plan` / `prp-implement` load them); no vault twin.
   `specs/<slug>/spec.md`, `plan.md`, `tasks.md`, `contracts/`, `checklists/` are **NOT** written by
   default — the vault copy is the only artifact written unless the caller explicitly opts in
   (`--repo-specs`, or preset `spec_artifacts: repo | both`) so intent ships in the PR next to the
   code. Default behavior across `refinement` / `prp-plan` / `mediator` / `spec-converge` /
   `spec-analyze` is **vault-only**; do not write a repo `specs/` copy on your own initiative.
2. **Indexes rebuildable from the vault** — the FTS5 index behind `search_kb`, `search_sessions`,
   `find_related_work` and `validate_note_links` (`~/.claude/kb/kb_index.db`, or `$CI_KB_INDEX`;
   rebuilt by `reindex_kb`, kept current by every MCP write), and the web-cache URL index
   `~/.claude/memory/WEB-CACHE-001/cache_index.db` (the cached pages themselves are vault notes).
   Deleting either loses nothing: `reindex_kb` rebuilds the first from the notes.
3. **Ephemeral working files** — `write_state` lock files (OS temp dir), and single-phase scratch such
   as `/tmp/epub_extracted/` or a benchmark's raw JSON. They are consumed inside the phase; whatever
   they produced that matters is written to the vault before the phase closes.

Anything else is a leak. The test is one question: **would a second context, or the user, need to
read this?** If yes, it is a record and it goes in the vault.

The old per-ticket `~/.claude/memory/<TICKET>/session_index.db` files are retired — the MCP no longer
reads them; session search is served from the vault index above.

## 5. A diagnosis-only run writes the most, not the least

When the outcome is "no code change needed" — a deploy-state problem, a stale environment, an
already-correct implementation — that conclusion plus its evidence is precisely what stops the next
person repeating the investigation. Record it as `## Verified Facts` + `## General Rules` +
`## Lessons`. **"Nothing to build" is never a reason to skip the note.**

## 6. Externally-verified facts get recorded with their command

A deployed sha, an API payload diff, a CI job conclusion, a cloud console error string: write the
exact command or query that produced it, so the next session re-verifies in one step instead of
rediscovering the method.

## 7. Shutdown emits a write ledger

The final phase lists every note created or updated, **by path** — session note, state note, plan,
report, and one line per PR description. **An empty ledger is a 🔴**: it means the run learned nothing
worth keeping, which is almost never true.

Build it from the MCP, not from memory: every write the `ultimate-obsidian` MCP performs is recorded in
the vault itself, one daily note per day at `02-Notes/Sessions/write-ledger/YYYY-MM/YYYY-MM-DD.md`.

```
mcp__ultimate-obsidian__get_write_ledger({ since: "<run start, ISO>" })
# → { count, empty, entries: [{ ts, tool, op, path, sha }] }   empty: true ⇒ 🔴
```

---

## The write protocol

**Use the `ultimate-obsidian` MCP. Never the `Write` tool, never bash redirection, never `mkdir`** —
those bypass the index, the frontmatter contract, and the scrub.

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/<Folder>/<...>.md",   # vault-relative, never absolute
  content:  "...",
  mode:     "overwrite" | "append" | "prepend",
})
```

Three steps, in order, every time:

1. **Pre-write scrub** — `secret-scrub.md`. Non-negotiable, runs before every write.
2. **HIERARCHY CHECK** — list the target folder before writing into it, so the note lands in the
   convention that already exists rather than a new one:
   ```
   mcp__ultimate-obsidian__list_vault({ path: "02-Notes/Reports" })
   ```
3. **Write, then verify the call returned OK.** A silent failure is indistinguishable from a skipped
   write; treat an unconfirmed write as no write. Write tools return `structuredContent`
   `{ ok, path, sha, warnings, redactions }` — `sha` is the note as read back, so a non-empty `sha` is
   the confirmation (`delete_note` returns no `sha`: its `OK: deleted <path>` text is the
   confirmation). Read `warnings` (out of write-scope, not month-bucketed) and fix the path rather than
   ignoring them.

The MCP also enforces the scrub and the scope/month rules at its own boundary (secret values are
redacted to `[REDACTED]`; `OBSIDIAN_WRITE_GUARD=strict` turns scope warnings into rejections). That is a
backstop, not a replacement for steps 1–2.

### Month buckets

`02-Notes/Plans/` and `02-Notes/Reports/` are bucketed by month: `<YYYY-MM>/`. A note dropped at the
folder root fails the vault's own `02-Notes/.scripts/check-acs.sh` AC1.

### Typed frontmatter (knowledge-graph ontology)

`schema_version: 1` opts the note into `02-Notes/.scripts/check-graph-acs.sh`. Spec:
`02-Notes/Wiki/knowledge-graph-ontology.md`. The typed relation keys are the graph edges:

- `up` / `documents` → the ticket node `03-Systems/tickets/<TICKET>.md`
- `implements` → the plan a report implements (the strongest edge a report has)
- `affects` → the `03-Systems/` service / table nodes **actually changed**, read off the real diff —
  never the plan's intentions
- `related` → sibling notes of the same run (a `.state.md` relates to its session note)

`project:` is the repo root folder name, from
`basename $(git rev-parse --show-toplevel 2>/dev/null || pwd)`.

**If no target resolves to an existing note, OMIT THE KEY.** Never emit `[[undefined]]`, `[[]]`, or a
link to a note you did not verify exists — every relation key is optional, and a dangling edge fails
the gate. Create a missing service node from `_templates/system.md` with a canonical `id`, or omit.

### Write-scope

The intended write prefixes:

```bash
case "$WRITE_PATH" in
  02-Notes/Sessions/*|02-Notes/Plans/*|02-Notes/Reports/*|\
  02-Notes/Specs/*|02-Notes/pr-descriptions/*|03-Systems/*) echo "in write-scope" ;;
  *) echo "OUT OF WRITE-SCOPE: $WRITE_PATH — needs an explicit widening note" ;;
esac
```

This `case` list is the agent's own pre-write check. It mirrors `DEFAULT_SCOPE` in
`ultimate-obsidian-mcp/src/writes.ts` (the MCP's repo, not this one), which is authoritative: if the two
disagree, the code wins. With a custom `OBSIDIAN_WRITE_SCOPE` this `case` list is stale; the env var is
what the MCP uses. The MCP applies the same rules at its own boundary, but by default (`warn`) it only
warns: an out-of-scope write **still succeeds**, with the message in the result (`warnings` for writes
and moves, `⚠` text lines for `delete_note`). `strict` blocks it before any byte is written. A result
carrying `warnings: ["outside write-scope: …"]` means the widening note (below) is missing: stop and
write that note or move the write to an in-scope path; do not ignore it. A delete or a move has already
run when its result comes back, so for those the warning is too late: run the `case` check above on the
delete path and on **both** move paths before calling, and treat an out-of-scope hit as a stop.

| Variable | Default | Effect |
|---|---|---|
| `OBSIDIAN_WRITE_GUARD` | `warn` | `warn`: an out-of-scope or non-month-bucketed write succeeds with a warning. `strict`: it throws before any byte is written. `off`: skips the scope and month-bucket checks. Any other value (`on`, `true`, `STRICT`) silently means `warn`. |
| `OBSIDIAN_WRITE_SCOPE` | the six prefixes above | Comma-separated vault-relative prefixes. **Replaces** the default list; it does not extend it. |

The `..`, scope and month-bucket checks cover every write tool (create, patch, replace, frontmatter,
`write_state`), the path of `delete_note`, and **both** the source and the destination of `move_note`.
`index_note` is the exception: it rewrites the note's `keywords:` frontmatter on disk with no path check,
so vet its path yourself. The checks run before any write (a few tools read the note first), so a
`strict` throw leaves the vault untouched. A path containing a `..` segment always throws, even with
`OBSIDIAN_WRITE_GUARD=off`. The month-bucket check applies only to a file directly under
`02-Notes/Plans/` or `02-Notes/Reports/` that is not inside a `YYYY-MM/` folder: it warns (a throw
under `strict`), while a nested `Plans/misc/x.md` does not. Because the source of a move and the path
of a delete are checked too, under `strict` a flat legacy `02-Notes/Plans/x.plan.md` (or a flat file
under `02-Notes/Reports/`) can neither be moved into a month folder nor deleted. The agent cannot
change the guard mode: stop and ask the user, who can run that one operation under `warn` or in the
Obsidian app. The MCP also scrubs secret values on write (`scrubSecrets` in the same `writes.ts`;
`OBSIDIAN_SECRET_SCRUB=off` disables it).

Where the warnings land: writes and moves report them in `warnings` (structuredContent) and as
`  ⚠ <warning>` lines in the text; `delete_note` has no structuredContent, so its warnings appear **only**
as `  ⚠ <warning>` lines in the result text. Read the text of a delete result: an `outside write-scope`
line there means the same as in `warnings`. A server built before the `delete_note` / move-source guard
(`ultimate-obsidian-mcp`, Nov 2026) does not check them, not even for a `../x.md` path, so always vet
those paths yourself; a newer build takes effect only after a rebuild and a restart of the MCP server.

Widening to a new path requires an **explicit note in the session** (`### Lessons`, or a
`Widened write-scope:` line) naming the path and the reason. Silent widening is forbidden — including
"the folder obviously should exist".

### Stale-session re-audit (30-day rule)

A restored session whose frontmatter `date:` is more than 30 days old gets a re-audit prompt before
its Verified Facts are trusted; the codebase may have drifted underneath them.

```bash
# $RESTORED_DATE = frontmatter date (YYYY-MM-DD); $TODAY = current date
AGE_DAYS=$(( ( $(date -j -f %Y-%m-%d "$TODAY" +%s) - $(date -j -f %Y-%m-%d "$RESTORED_DATE" +%s) ) / 86400 ))
[ "$AGE_DAYS" -gt 30 ] && echo "⚠️ RE-AUDIT: restored session is ${AGE_DAYS}d old (>30) — re-verify Verified Facts against current code before relying on them"
```
