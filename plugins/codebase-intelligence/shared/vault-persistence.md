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
| **Orchestration state** (machine-readable run state) | `02-Notes/Sessions/<TICKET>-<SUFFIX>.state.md` | **overwrite** |
| **`pre-pr-gate` receipt** | `receipts[]` inside that same `.state.md` | **overwrite** |
| Refinement contract | `02-Notes/Plans/<slug>.refinement.md` | overwrite |
| Plan | `02-Notes/Plans/<YYYY-MM>/<slug>.plan.md` | overwrite |
| PRD | `02-Notes/Specs/<slug>.prd.md` | overwrite |
| Report — implementation, loop, doubt, audit, review, convergence, analysis | `02-Notes/Reports/<YYYY-MM>/<slug>-report.md` | overwrite |
| PR description (**before** the PR is opened) | `02-Notes/pr-descriptions/<YYYY-MM-DD>-<TICKET>-<slug>[-<repo>].md` | overwrite |
| Cleanup ledger (`/prp-checkup`) | `02-Notes/Sessions/prp-checkup-<repo>.md` | overwrite |
| Ticket node | `03-Systems/tickets/<TICKET>.md` | append |
| Service / table node | `03-Systems/…` from `_templates/system.md` | append |
| Drafted external comms (Jira comment bodies, review replies) | the session note, or beside the plan in `02-Notes/Plans/` | append |

**Overwrite vs append is not a preference.** A note holding one machine-readable document
(`.state.md`, a receipt, a plan) is always a whole-note overwrite of one full instance — an appended
JSON document is an unparseable file. A note holding a history (a session, a ledger of attempts, a
ticket node) is always append, so the earlier rows survive.

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

Exactly two things legitimately live outside the vault:

1. **Artifacts a repo owns by contract** — `specs/<slug>/spec.md`, `plan.md`, `tasks.md`,
   `contracts/`, `checklists/`, and `.claude/constitution.md`, so intent ships in the PR next to the
   code. These are **dual-written**: the repo copy ships, the vault copy stays searchable and
   graph-linked.
2. **Caches rebuildable from the vault** — `~/.claude/memory/<TICKET>/session_index.db` (the FTS5
   index, rebuilt by `reindex_kb`), `~/.claude/memory/WEB-CACHE-001/` (an index over notes that are
   themselves in the vault), and single-phase extraction scratch such as `/tmp/epub_extracted/`.

Anything that is neither of those is a leak. The test is one question: **would a second context need
to read this?** If yes, it cannot live in one worktree's `.claude/`.

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
   write; treat an unconfirmed write as no write.

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

Writes are confined to these prefixes:

```bash
case "$WRITE_PATH" in
  02-Notes/Sessions/*|02-Notes/Plans/*|02-Notes/Reports/*|\
  02-Notes/Specs/*|02-Notes/pr-descriptions/*|03-Systems/*) echo "in write-scope" ;;
  *) echo "OUT OF WRITE-SCOPE: $WRITE_PATH — needs an explicit widening note" ;;
esac
```

The default posture outside them is **read-only**. Widening to a new path requires an **explicit note
in the session** (`### Lessons`, or a `Widened write-scope:` line) naming the path and the reason.
Silent widening is forbidden — including "the folder obviously should exist".

### Stale-session re-audit (30-day rule)

A restored session whose frontmatter `date:` is more than 30 days old gets a re-audit prompt before
its Verified Facts are trusted; the codebase may have drifted underneath them.

```bash
# $RESTORED_DATE = frontmatter date (YYYY-MM-DD); $TODAY = current date
AGE_DAYS=$(( ( $(date -j -f %Y-%m-%d "$TODAY" +%s) - $(date -j -f %Y-%m-%d "$RESTORED_DATE" +%s) ) / 86400 ))
[ "$AGE_DAYS" -gt 30 ] && echo "⚠️ RE-AUDIT: restored session is ${AGE_DAYS}d old (>30) — re-verify Verified Facts against current code before relying on them"
```
