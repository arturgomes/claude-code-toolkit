---
name: prp-epic
description: >
  Run a whole epic to PRs, unattended. Takes a Jira epic key, or an umbrella plan that lists several
  small plans (and/or tickets) toward one goal. Each child runs as its own detached headless
  `claude -p` process — a ticket through /prp-orchestrate, a plan through /prp-implement — N at a time
  in a sliding window, in dependency order. A watchdog kills and relaunches a hung child once, then
  parks it as needs-human and keeps going with the rest. PR CI is watched and gets one auto-fix run.
  State lives in one vault ledger, so any session can take over. Never merges. One tick per call:
  drive it with /loop. `--status` is a read-only dashboard.
argument-hint: <EPIC-KEY | path/to/umbrella.md> --base <branch> [--parallel 3] [--hung-min 25] [--unblock-on merged|ci-green|pr-open] [--dry-run] [--status]
---

# /prp-epic — epic orchestrator (one tick per invocation)

Arguments: `$ARGUMENTS`.

You are a **scheduler, not a worker**. You never implement a child, never run lint/typecheck/tests,
never wait on a child. Each child runs as its own detached headless process started by `SUP launch`;
you start them, watch them, record what you saw, and go back to sleep. Everything you know lives in
the **ledger**, so a fresh session can take over mid-epic.

Start it with:

```
/loop /codebase-intelligence:prp-epic <EPIC-KEY | path/to/umbrella.md> --base <branch>
```

`/loop` with no interval is what makes `ScheduleWakeup` (step 8) fire the next tick. A bare call runs
exactly one tick.

## Model capability (read first)

Tier semantics: `../shared/model-tier.md`. Mandatory at every tier **here**: `--base` required, the
fixed retry budgets, park-one-child-never-the-epic, never merge, the ledger as the single source of
truth with you as its only writer, and the vault-persistence contract.

## Setup (every tick)

```bash
SUP="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/scripts/epic.sh}"
[ -x "$SUP" ] || SUP=$(ls -d ~/.claude/plugins/cache/*/codebase-intelligence/*/scripts/epic.sh 2>/dev/null | sort -V | tail -1)
ROOT=$(pwd -P)                # first tick only; later ticks read root: from the ledger
export EPIC_ROOT="$ROOT"      # every SUP call
```

- `RUNS = ~/.claude/epic-runs/<KEY>/` — pid, exit, log, prompt per child. Owned by `SUP`; process
  bookkeeping, not run state, so it is not a vault artifact.
- `LEDGER = 02-Notes/Sessions/epic-<KEY>.md` — the run state, a vault note per
  `../shared/vault-persistence.md`. You are its **only writer**; whole-note overwrite each tick.
  Every child's own session/state notes are written by that child's run, never by you.

## Input: two modes, one child table

**Jira mode** — the argument matches `[A-Z][A-Z0-9]*-[0-9]+`. `KEY` = the epic key. Load the Jira MCP
tools with one ToolSearch (`+jira search` / `getJiraIssue`; use whichever Atlassian server is
connected). Fetch the issue; if its type is not Epic, **stop** and say a single ticket belongs to
`/prp-orchestrate`. Children: JQL `parent = <KEY> ORDER BY rank ASC` (older boards:
`"Epic Link" = <KEY>`), fields `summary,status,issuetype,issuelinks` only — even so a 14-child epic
returns ~77k characters, so when the result spills to a file, extract key / status category / inward
`Blocks` keys with `python3` or `jq`, never by reading it. Every child **runs** its own ticket key. `deps` = keys in `Blocks` links where
the child is the `inwardIssue` side ("is blocked by"). A dep outside the epic that is not Done makes
the row `blocked`, note `waits on <KEY>`. Status category Done → `skipped`.

**Umbrella mode** — the argument is a `.md` path (a plan that comprises several smaller plans toward
one goal). `KEY` = the file's stem with `.md`, `.plan`, `.epic` stripped, kebab-cased. The children
come from a `## Children` table in that file:

```markdown
## Children
| id | runs | deps |
|---|---|---|
| tokens | plans/tokens.plan.md | |
| rails | plans/reporting-rails.plan.md | tokens |
| SEATHQ-12 | SEATHQ-12 | tokens, rails |
```

- `id`: a ticket key or a kebab slug, unique. Pick a slug that will appear in the child's branch or
  worktree name: the watchdog finds a child's commits that way, and otherwise sees only its log. `runs`: a plan path (relative to the umbrella file) or a
  ticket key; empty means "the id is the ticket". `deps`: other ids, comma-separated.
- Parse it with `SUP children <file>` — never by eye. Exit 2 prints every defect (missing plan file,
  unknown dep, duplicate or bad id); relay them and **stop**: an umbrella that doesn't parse is the
  user's to fix.
- No `## Children` table? Do not invent one from prose. Print the format above and stop.

**Executor per child** (both modes): a ticket → `/codebase-intelligence:prp-orchestrate` (it grooms,
plans and builds); a plan path → `/codebase-intelligence:prp-implement` (the plan already exists, so
refinement would only add a stop nobody can answer).

`--base` is **required**: it is where every child's PR lands (`main` or an epic integration branch).
Missing → stop and ask; never guess a PR target. With an epic branch, children base on it and a
dependent waits until its dep is merged into it (`--unblock-on merged`, the default).

## Hard rules

- Never merge a PR, delete a branch or worktree, edit Jira, or run `git stash`. Jira is read-only here.
- Never run lint, typecheck, build or tests yourself, and never `cd`: absolute paths only.
- Retry budget is fixed: **one** automatic relaunch per child, **one** CI-fix run per child. Then `needs-human`.
- A child needing a human parks **that child only**. Keep going with the rest.
- Prompt files are `.txt` under `RUNS`. Never write markdown scratch files; durable state is the ledger.
- Pre-write scrub before every ledger write: `../shared/secret-scrub.md`.
- `--dry-run`: steps 1–2 only. Print the child table, the ready set, and the prompt for the first
  ready child. Write nothing, launch nothing.
- `--status`: the read-only dashboard below. Never writes, launches, kills or schedules.

## Tick procedure

**1. Load tools (one ToolSearch call):** `mcp__ultimate-obsidian__read_note`,
`mcp__ultimate-obsidian__create_or_update_note`, `mcp__ultimate-obsidian__check_exists`,
`mcp__ultimate-obsidian__search_sessions`, plus the Jira tools in Jira mode. `ScheduleWakeup` comes
with `/loop`.

**2. Read or build the ledger.** `check_exists` then `read_note` on LEDGER.
- *Exists:* parse the table. Frontmatter keeps `mode`, `source`, `root`, `base`, `parallel`,
  `hung_min`, `unblock_on`; arguments given now override them. In umbrella mode re-run
  `SUP children` and append rows for any new child as `queued` (never drop or reorder existing rows).
- *Absent (first tick):* build the child table per the mode above, one row per child in order.
- Every tick, run `SUP ci-delegation` and keep its output: this tick's delegation table (step 6). It
  reads `<root>/.claude/epic-ci-delegation.tsv`; no file means nothing is delegated and every check
  stays a local gate (format and verification rules: the header of `scripts/epic.sh`).

**3. Check every `running` / `ci-fixing` row.** For child C:
`SUP check <KEY> C <hung_min*60> $(SUP heartbeat-paths C)` (each path as its own argument).
- `running age=..` → record the heartbeat age, nothing else.
- `exited code=0` → `SUP result <KEY> C` (only the run's final result event counts, so a line quoted
  earlier cannot pass for the outcome). `status=pr-open` with `pr=` URL(s) → verify each with
  `gh pr view <url> --json state,baseRefName,headRefName` (always `--json`). Any `baseRefName` ≠
  `--base` → `needs-human`, note `pr-base-mismatch`. Otherwise → `pr-open`, store URL(s) and branch.
  `status=needs-human`, `none`, or `pr=none` → `needs-human`, note = the `reason=` text, else
  `no EPIC-RESULT line`. `status=failed` is handled like a non-zero exit. For a `ci-fixing` row, exit 0
  means back to `pr-open`.
- `exited code=<nonzero|unknown>` → **failed**: `runs` < 2 → relaunch (step 6, resume prompt); else `needs-human`.
- `hung age=..` → `SUP kill <KEY> C`, then treat as failed with reason `hung <age>s`. Never touch its worktrees.
- `unknown reason=no-pid-file` on a `running` row → the run never started: treat as failed.

**4. Watch CI on every `pr-open` / `ci-green` / `ci-red` row.** For each PR URL:
`gh pr view <url> --json state` and `gh pr checks <url> --json name,bucket,link` (raw JSON; wrapped
summaries have misreported before).
- All PRs `MERGED` → `merged`. A PR `CLOSED` unmerged → `needs-human`, note `pr-closed-unmerged`.
- Any check `bucket=fail` → `ci-red`. `fixes` = 0 → launch the CI-fix run (step 6), `fixes`=1, status
  `ci-fixing`. `fixes` ≥ 1 → `needs-human`, note = failing check names.
- Any `pending` → stay `pr-open`. All `pass`/`skipping` → `ci-green`.

**5. Unblock.** A `queued` row is **ready** when every dep is satisfied: status `merged` or `skipped`
(`--unblock-on ci-green` also accepts `ci-green`; `pr-open` accepts any open PR). A `queued` row with
a dep in `needs-human` → `blocked`, note `waits on <dep> (parked)`. Re-evaluate `blocked` rows each
tick; they return to `queued` when the parked dep resolves. **Deadlock:** rows are `queued` but none is
ready and nothing is `running`/`ci-fixing`/`pr-open`/`ci-green`/`ci-red` → a dependency cycle; mark
those rows `needs-human`, note `dependency cycle: <ids>`.

**6. Fill slots.** `slots = parallel − (rows running + ci-fixing)`. Launch up to `slots` ready rows in
order, one `SUP launch` per child:
1. Write the prompt with the **Write** tool to `RUNS/C.prompt.txt` (templates below).
2. `SUP launch <KEY> C RUNS/C.prompt.txt`. Row → `running`, `runs`+1, note the pid.

**7. Write the ledger** (`create_or_update_note`, mode `overwrite`, whole note) and print the dashboard.
A failed vault write stops the tick; there is no local fallback (`../shared/vault-persistence.md`).

**8. Reschedule or finish.**
- Not finished: `ScheduleWakeup` with this exact invocation as the prompt; `delaySeconds` 300 while any
  row is `running`/`ci-fixing`, otherwise 900 (waiting on human merges).
- Finished = no row is `queued`, `running`, `ci-fixing`, `pr-open`, `ci-green` or `ci-red`. Do **not**
  reschedule. Print the final report: every `needs-human`/`blocked` row with its note and how to resume
  it (fix the cause, set the row back to `queued` with `runs` 0 in the ledger, start `/loop` again).
  After the merges, `/prp-checkup` cleans up branches, worktrees and session notes.

## Ledger format

```
---
title: "Epic run: <KEY>"
type: session
schema_version: 1
epic: <KEY>
mode: jira | umbrella
source: <epic key or absolute umbrella path>
root: <absolute project root>
base: <branch>
parallel: 3
hung_min: 25
unblock_on: merged
updated: <ISO-8601>
---
# Epic run: <KEY>
| child | target | summary | status | deps | runs | fixes | pr | heartbeat | note |
|---|---|---|---|---|---|---|---|---|---|
## CI delegation
<SUP ci-delegation output, verbatim, or "(none: every check stays local)">
## Log
<last 30 lines, newest last: "<HH:MM> <child> <old> -> <new> (<why>)">
```

Statuses: `queued` `running` `pr-open` `ci-green` `ci-red` `ci-fixing` `merged` `needs-human` `blocked`
`skipped`. `hung` and `failed` are never stored: they resolve in the same tick to `running`
(relaunched) or `needs-human`. **Done means merged on GitHub** — not Jira status, not "the run ended".

## Prompt templates

Fill `{CHILD}`, `{TICKET}`, `{PROJECT}` (ticket prefix), `{PLAN}` (absolute plan path), `{BASE}`,
`{DELEGATION}` (one line per `delegated` row: `- <repo>: <check>`; if none,
`(none: every check stays local)`), `{REASON}`, `{PR_URLS}`, `{BRANCH}`, `{FAILED_CHECKS}`.

**Main run** — first line by executor:
- ticket: `/codebase-intelligence:prp-orchestrate {TICKET} --jira-project {PROJECT} --base {BASE} --no-stack`
- plan: `/codebase-intelligence:prp-implement {PLAN} --base {BASE}`

then a blank line and:

```
{RESUME_BLOCK}EPIC RUN POLICY. Set by the user for this unattended run; it overrides the defaults of every skill this run invokes.
1. Unattended: nobody can answer a question. On a requirement fork, a red blast-radius action (auth, payments, deploy, db-migration), a NOT READY refinement verdict, or a red verdict that survives the round cap: record it in the vault session note, STOP, and start your final message with `NEEDS-HUMAN:` followed by the question(s). Never guess an answer.
2. Open the PR(s) against {BASE}. Never merge. Never delete a branch or worktree.
3. These checks run in PR CI, so do NOT run them locally (not in a pre-submit smoke, not in pre-pr-gate, not in its unused-import pass):
{DELEGATION}
   In the pre-pr-gate receipt write `delegated-to-ci` for each in place of an exit code. This supersedes the "never skipped" wording for exactly these repo/check pairs and nothing else: every other layer, and every check not listed, stays a local gate as written.
4. Lanes run one at a time. No `git stash`. One commit per task.
5. Your final message must contain exactly one line of the form `EPIC-RESULT: status=<pr-open|needs-human|failed> pr=<url[,url] or none> reason=<one line>`. The runner reads it; any closing notes may follow it.
{PLAN_ITEM}
```

`{PLAN_ITEM}` is empty for a ticket run. For a plan run it is the line below, because `prp-implement`
ends at its report and its PR step (`ship`) asks before commit, push and PR — questions nobody can
answer headless:
`6. When prp-implement reports complete, ship it with /codebase-intelligence:ship, PR base {BASE}. Every confirmation ship or worktree-lifecycle would ask is answered in advance: YES to stage, commit, push and open the PR; NO to removing the worktree. A plan without acceptance criteria to anchor on is a NEEDS-HUMAN stop (item 1), never a guess.`

`{RESUME_BLOCK}` is empty on the first run. On a relaunch it is:
`RESUME: a previous run of {CHILD} stopped ({REASON}). Restore session-memory for it first and continue from "Last-Session State (resume here)". Reuse the existing spec, plan and worktrees from its vault state note; do not redo finished work.`
followed by a blank line.

**CI-fix run** (same policy block, items 1, 3, 4, 5, plus):
```
/codebase-intelligence:prp-fix {CHILD}

Unattended CI repair. PR(s) {PR_URLS} failed these checks: {FAILED_CHECKS}.
Read the failing logs: get run ids from `gh pr checks <url> --json name,bucket,link`, then `gh run view <id> --log-failed`. Fix on the existing branch {BRANCH} in its existing worktree and push to that branch; do NOT open a new PR. Do not run delegated checks locally: CI is the oracle. Never loosen a rule, add eslint-disable / @ts-ignore / .skip, or edit CI to make it pass.
```

## Dashboard (end of every tick, and `--status`)

`--status` reads the ledger only (if absent: say the epic has not started, stop), then does a live
check — the ledger is only as fresh as the last tick — on each `running`/`ci-fixing` row with
`SUP check`, reporting the live verdict next to the ledger's. For each row that is not
`queued`/`skipped`, `search_sessions` with the child id and show the newest note's `phase` and the
first lines of its `Last-Session State (resume here)`. `_index.md` is best-effort under parallel runs;
the ledger is the truth.

Print, in order:
- **Progress:** `merged/total`, then counts per status.
- **Needs you:** every `needs-human`, `blocked`, `ci-red`, and any `running` row whose heartbeat age
  exceeds half of `hung_min` — each with child, note, and the exact next action.
- **In flight:** `running`/`ci-fixing`/`pr-open`/`ci-green`: PR links, heartbeat age, session `phase`.
- **Left:** `queued` rows with what each waits on.
- **Done:** `merged` and `skipped`, one line each.
- **Look closer:** `tail -f ~/.claude/epic-runs/<KEY>/<child>/log` for a live run.

## Before the first real run

- **Allow-list.** A headless child denies any tool prompt (`--permission-prompts none`) instead of
  waiting forever, so tools it needs must already be allowed in the project's settings. A denial shows
  up as `"permission_denials"` in the child's final result event.
- **Hung threshold.** `--hung-min` must exceed the slowest silent gate (a full test run writes nothing
  to the log). Too low kills healthy work.
- **Load.** `parallel` children each spawn their own agents. Start at 2 if the machine struggles.
- **SessionStart hooks run in every child** and add their context (and cost) to each one.
- **Not yet proven end to end:** that a headless `claude -p` honours a leading plugin slash command
  with MCP servers loaded, that the delegation policy wins over pre-pr-gate's own wording, and that
  every child emits the `EPIC-RESULT:` line. Do a `--dry-run`, then one live child, before a full epic.

## Does NOT do

Merge, deploy, edit Jira, decompose a free-text goal into children (write the umbrella plan first,
e.g. with `/prp-plan`), or run on a cloud schedule (the vault and worktrees are local).
