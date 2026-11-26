---
name: prp-epic
description: >
  Run a whole epic to PRs, unattended. Takes a Jira epic key, or an umbrella plan that lists several
  small plans (and/or tickets) toward one goal. Each child runs as its own detached headless
  `claude -p` process — a ticket through /prp-orchestrate, a plan through /prp-implement — N at a time
  in a sliding window, in dependency order. A watchdog kills and relaunches a hung child once, then
  parks it as needs-human and keeps going with the rest. PR CI is watched and gets one auto-fix run.
  State lives in one vault ledger, so any session can take over. Never merges. One tick per call:
  drive it with /loop. `--status` is a read-only dashboard. `--create` writes the work list itself: a
  reviewable `<slug>.epic.md` from a goal, a Jira epic or a list of tickets, ordered as a chain that
  ships as one GitHub stack (`--ship stacked`) or as independent PRs.
argument-hint: <EPIC-KEY | path/to/x.epic.md> --base <branch> [--parallel 3] [--hung-min 25] [--unblock-on merged|ci-green|pr-open] [--ship stacked|independent] [--dry-run] [--status] | --create <goal | EPIC-KEY | KEY KEY ...> [--out path] [--ship stacked|independent]
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

## Create mode — `--create`: write the work list, then stop

`/prp-epic --create <goal | EPIC-KEY | KEY KEY …> [--out <path>] [--ship stacked|independent]` is a
**one-shot**, not a tick: no `/loop`, no ledger, no launch. It produces one `.epic.md` for a human to
review and ends. **It never runs the epic it just wrote** — a decomposition nobody read is the biggest
risk in this command, and every child it launches costs a full headless run.

1. **Gather.** Jira epic key → the children extraction of Jira mode below (key, status, `Blocks`);
   ticket keys → one `getJiraIssue` each, fields `summary,status,issuelinks` only; free-text goal →
   decompose it yourself into **vertical slices**, each independently verifiable and mergeable alone.
   Done tickets are listed as `skipped` rows, not dropped, so the file shows the whole history.
2. **Size.** Every item is XS–M (about one PR a reviewer can hold in their head). An L is split
   before the file is written; an item that cannot be split gets `needs-human` in a `Size:` line and
   the report says so, never shipped oversized. A prefactor goes first only when it makes the slices
   after it smaller or safer.
3. **Order.** `--ship stacked` (the default whenever the items are meant to land in sequence): force a
   single chain — each item's `deps` is exactly the item below it, riskiest-unknown first, so a
   surprise surfaces on layer 1 and not layer 6. `--ship independent`: real dependencies only, none
   invented, so the sliding window runs them in parallel.
4. **Write** per the format below. Default location: the vault, `02-Notes/Plans/<YYYY-MM>/<slug>.epic.md`
   via `create_or_update_note` (overwrite) — a plan is a vault artifact (`../shared/vault-persistence.md`).
   `--out <path>` writes that file instead, because you were told where. Scrub first (`../shared/secret-scrub.md`).
5. **Validate what you wrote**, by its on-disk path: `SUP children <file>`, plus `SUP stack-plan <file>`
   when `ship: stacked`. Exit 2 prints every defect: fix the file and validate once more; a file that
   still fails is reported, never left as if it were fine.
6. **Stop** and print: the table, the layer order (stacked), the path, and
   `Review it, edit freely, then: /loop /codebase-intelligence:prp-epic <path> --base <branch>`.

### The `.epic.md` format

```markdown
---
title: "Epic plan: <slug>"
type: epic-plan
schema_version: 1
ship: stacked | independent
created: <ISO-8601>
---
# <goal in one line>
## Children
| id | runs | deps |
|---|---|---|
| tokens | @item | |
| SEATHQ-12 | | tokens |
| rails | plans/rails.plan.md | SEATHQ-12 |
## Items
### tokens
- **Outcome:** <what is true when this merges, one sentence>
- **Acceptance:** <checklist lines, each observable>
- **Verify:** <at least one command, test or artifact check that proves it>
- **Size:** XS | S | M
- **Out of scope:** <what the next layer owns>
```

- `## Children` is the only part a script reads (`SUP children` / `stack-plan`). `runs`: a ticket key
  (empty = the id is the ticket), a plan path, or `@item` — the `### <id>` section below, handed to
  `/prp-orchestrate` as its goal. A ticket or plan child keeps its own source of truth; an `### <id>`
  section for it is optional context.
- **The file is the definition, never the state.** Run state stays in the vault ledger, which this
  command alone writes; a file two writers update gets conflicts and a progress view that lies. For
  the checklist view, `--status` prints each child as `[x] merged` / `[ ] queued` against this file.

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

**Umbrella mode** — the argument is a `.md` path: a `.epic.md` from `--create`, or a hand-written plan
that comprises several smaller plans toward one goal. `KEY` = the file's stem with `.md`, `.plan`, `.epic` stripped, kebab-cased. The children
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
plans and builds); an `@item` → the same command with the item's `### <id>` section as its goal; a plan
path → `/codebase-intelligence:prp-implement` (the plan already exists, so refinement would only add a
stop nobody can answer).

`--base` is **required**: it is where every child's PR lands (`main` or an epic integration branch).
Missing → stop and ask; never guess a PR target. With an epic branch, children base on it and a
dependent waits until its dep is merged into it (`--unblock-on merged`, the default).

## Shipping shape: independent PRs or one stack

`ship` comes from the `.epic.md` frontmatter; `--ship` overrides it. Jira mode is always `independent`
(its `Blocks` links are a DAG, not a chain): to stack a Jira epic, run `--create <EPIC-KEY> --ship
stacked` first, review the chain, then run the file.

**`independent`** (default): every PR targets `--base`; a dependent waits per `--unblock-on` (default
`merged`). Everything outside this section describes this shape unless it says *stacked*.

**`stacked`** — the children are one chain that lands as one GitHub stack, built on the `gh stack`
machinery `/prp-orchestrate` Phase 1.9 / 5.9 already uses. Fall back to `independent`, saying why once,
when `SUP stack-plan <file>` exits 2 (fork, fan-in, several roots or a cycle), `gh stack --help`
fails, or the repo is a fork. The differences:

- **Base per layer.** Layer 1 targets `--base`; layer *k* is built **from layer *k−1*'s branch** and its
  PR targets that branch. The ledger `branch` column is how a layer finds its parent. A stacked child
  never merges its parent in: it sits on top of it.
- **Unblock is `ci-green`, not `merged`.** The point is not to wait for a human merge between layers;
  `merged` would serialise on review latency. `--unblock-on pr-open` is faster still but costs: a
  CI-fix on layer *k* rewrites the branch under every layer above it, each then needing a restack.
- **Link once, when the chain is complete.** On the tick where every layer has a PR (`pr-open` or
  later) and `stack_linked` is false: `gh stack link --base <base> <pr-url> …` bottom → top, then
  `gh stack view --json` and require layer 1 on the trunk and every other layer on the one below —
  a mismatch is `needs-human`, never patched around. Then `stack_linked: true`. Per-layer PR bodies
  are already written by each child's own `pr-description` run.
- **Restack when a layer merges.** Merging is bottom-up and the human's. When layer *k* turns `merged`
  and layer *k+1* is still open, launch **one restack run** for *k+1* (prompt below; status
  `restacking`, `restacks` budget **1**): a squash merge leaves *k+1* carrying *k*'s old commits, so
  it needs `git rebase --onto`, a `--force-with-lease` push and `gh pr edit --base`. A conflict, or a
  second need, is `needs-human`. The scheduler itself never rebases.
- **A parked layer parks everything above it**, which is correct: nothing can sit on a layer that does
  not exist. Fixing it and resetting its row to `queued` resumes the chain.
- **`parallel` is 1 in effect.** A chain has one ready layer at a time.
- **Never `gh stack merge`** from here: only when the human asks.

## Hard rules

- Never merge a PR, delete a branch or worktree, edit Jira, or run `git stash`. Jira is read-only here.
- Never rebase, reset or force-push from the scheduler: a restack is a child run, never your own command.
- Never run lint, typecheck, build or tests yourself, and never `cd`: absolute paths only.
- Retry budget is fixed: **one** automatic relaunch per child, **one** CI-fix run, **one** restack run. Then `needs-human`.
- A child needing a human parks **that child only**. Keep going with the rest.
- Prompt files are `.txt` under `RUNS`. Never write markdown scratch files; durable state is the ledger.
- Pre-write scrub before every ledger write: `../shared/secret-scrub.md`.
- `--create` writes exactly one file and launches nothing; it never chains into a run.
- `--dry-run`: steps 1–2 only. Print the child table (and the layer order if stacked), the ready set, and the prompt for the first
  ready child. Write nothing, launch nothing.
- `--status`: the read-only dashboard below. Never writes, launches, kills or schedules.

## Tick procedure

**1. Load tools (one ToolSearch call):** `mcp__ultimate-obsidian__read_note`,
`mcp__ultimate-obsidian__create_or_update_note`, `mcp__ultimate-obsidian__check_exists`,
`mcp__ultimate-obsidian__search_sessions`, plus the Jira tools in Jira mode. `ScheduleWakeup` comes
with `/loop`.

**2. Read or build the ledger.** `check_exists` then `read_note` on LEDGER.
- *Exists:* parse the table. Frontmatter keeps `mode`, `source`, `root`, `base`, `parallel`,
  `hung_min`, `unblock_on`, `ship`, `stack_linked`; arguments given now override them. In umbrella mode re-run
  `SUP children` (and `SUP stack-plan` when stacked) and append rows for any new child as `queued` (never drop or reorder existing rows).
- *Absent (first tick):* build the child table per the mode above, one row per child in order; stacked: in `SUP stack-plan` order.
- Every tick, run `SUP ci-delegation` and keep its output: this tick's delegation table (step 6). It
  reads `<root>/.claude/epic-ci-delegation.tsv`; no file means nothing is delegated and every check
  stays a local gate (format and verification rules: the header of `scripts/epic.sh`).

**3. Check every `running` / `ci-fixing` / `restacking` row.** For child C:
`SUP check <KEY> C <hung_min*60> $(SUP heartbeat-paths C)` (each path as its own argument).
- `running age=..` → record the heartbeat age, nothing else.
- `exited code=0` → `SUP result <KEY> C` (only the run's final result event counts, so a line quoted
  earlier cannot pass for the outcome). `status=pr-open` with `pr=` URL(s) → verify each with
  `gh pr view <url> --json state,baseRefName,headRefName` (always `--json`). Any `baseRefName` ≠
  `--base` → `needs-human`, note `pr-base-mismatch`. Otherwise → `pr-open`, store URL(s) and branch.
  `status=needs-human`, `none`, or `pr=none` → `needs-human`, note = the `reason=` text, else
  `no EPIC-RESULT line`. `status=failed` is handled like a non-zero exit. For a `ci-fixing` or `restacking` row, exit 0
  means back to `pr-open`.
- `exited code=<nonzero|unknown>` → **failed**: `runs` < 2 → relaunch (step 6, resume prompt); else `needs-human`.
- `hung age=..` → `SUP kill <KEY> C`, then treat as failed with reason `hung <age>s`. Never touch its worktrees.
- `unknown reason=no-pid-file` on a `running` row → the run never started: treat as failed.

**4. Watch CI on every `pr-open` / `ci-green` / `ci-red` row, then link the stack if due.** For each PR URL:
`gh pr view <url> --json state` and `gh pr checks <url> --json name,bucket,link` (raw JSON; wrapped
summaries have misreported before).
- All PRs `MERGED` → `merged`. *Stacked:* if the next layer is still open, it is due its restack run (step 6). A PR `CLOSED` unmerged → `needs-human`, note `pr-closed-unmerged`.
- Any check `bucket=fail` → `ci-red`. `fixes` = 0 → launch the CI-fix run (step 6), `fixes`=1, status
  `ci-fixing`. `fixes` ≥ 1 → `needs-human`, note = failing check names.
- Any `pending` → stay `pr-open`. All `pass`/`skipping` → `ci-green`.

**5. Unblock.** A `queued` row is **ready** when every dep is satisfied: status `merged` or `skipped`
(`--unblock-on ci-green` also accepts `ci-green`; `pr-open` accepts any open PR). *Stacked:* the
default is `ci-green`, and a ready layer's base is its parent's `branch`. A `queued` row with
a dep in `needs-human` → `blocked`, note `waits on <dep> (parked)`. Re-evaluate `blocked` rows each
tick; they return to `queued` when the parked dep resolves. **Deadlock:** rows are `queued` but none is
ready and nothing is `running`/`ci-fixing`/`restacking`/`pr-open`/`ci-green`/`ci-red` → a dependency cycle; mark
those rows `needs-human`, note `dependency cycle: <ids>`.

**6. Fill slots.** `slots = parallel − (rows running + ci-fixing + restacking)`. Launch up to `slots` ready rows in
order (plus any restack run a merged layer just made due), one `SUP launch` per child:
1. Write the prompt with the **Write** tool to `RUNS/C.prompt.txt` (templates below).
2. `SUP launch <KEY> C RUNS/C.prompt.txt`. Row → `running`, `runs`+1, note the pid.

**7. Write the ledger** (`create_or_update_note`, mode `overwrite`, whole note) and print the dashboard.
A failed vault write stops the tick; there is no local fallback (`../shared/vault-persistence.md`).

**8. Reschedule or finish.**
- Not finished: `ScheduleWakeup` with this exact invocation as the prompt; `delaySeconds` 300 while any
  row is `running`/`ci-fixing`/`restacking`, otherwise 900 (waiting on human merges).
- Finished = no row is `queued`, `running`, `ci-fixing`, `restacking`, `pr-open`, `ci-green` or `ci-red`. Do **not**
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
ship: independent | stacked
stack_linked: false
updated: <ISO-8601>
---
# Epic run: <KEY>
| child | target | summary | status | deps | runs | fixes | restacks | branch | pr | heartbeat | note |
|---|---|---|---|---|---|---|---|---|---|---|---|
## CI delegation
<SUP ci-delegation output, verbatim, or "(none: every check stays local)">
## Log
<last 30 lines, newest last: "<HH:MM> <child> <old> -> <new> (<why>)">
```

Statuses: `queued` `running` `pr-open` `ci-green` `ci-red` `ci-fixing` `restacking` `merged` `needs-human` `blocked`
`skipped`. `hung` and `failed` are never stored: they resolve in the same tick to `running`
(relaunched) or `needs-human`. **Done means merged on GitHub** — not Jira status, not "the run ended".

## Prompt templates

Fill `{CHILD}`, `{TICKET}`, `{PROJECT}` (ticket prefix), `{PLAN}` (absolute plan path), `{BASE}`,
`{DELEGATION}` (one line per `delegated` row: `- <repo>: <check>`; if none,
`(none: every check stays local)`), `{REASON}`, `{PR_URLS}`, `{BRANCH}`, `{FAILED_CHECKS}`, `{PARENT_BRANCH}`, `{ITEM}` (the `### <id>` section verbatim).

**Main run** — first line by executor:
- ticket: `/codebase-intelligence:prp-orchestrate {TICKET} --jira-project {PROJECT} --base {BASE} --no-stack`
- item: `/codebase-intelligence:prp-orchestrate "{ITEM}" --base {BASE} --no-stack`
- plan: `/codebase-intelligence:prp-implement {PLAN} --base {BASE}`

then a blank line and:

```
{RESUME_BLOCK}EPIC RUN POLICY. Set by the user for this unattended run; it overrides the defaults of every skill this run invokes.
1. Unattended: nobody can answer a question. On a requirement fork, a red blast-radius action (auth, payments, deploy, db-migration), a NOT READY refinement verdict, or a red verdict that survives the round cap: record it in the vault session note, STOP, and start your final message with `NEEDS-HUMAN:` followed by the question(s). Never guess an answer.
2. Open the PR(s) against {BASE}. Never merge. Never delete a branch or worktree.{STACK_ITEM}
3. These checks run in PR CI, so do NOT run them locally (not in a pre-submit smoke, not in pre-pr-gate, not in its unused-import pass):
{DELEGATION}
   In the pre-pr-gate receipt write `delegated-to-ci` for each in place of an exit code. This supersedes the "never skipped" wording for exactly these repo/check pairs and nothing else: every other layer, and every check not listed, stays a local gate as written.
4. Lanes run one at a time. No `git stash`. One commit per task.
5. Your final message must contain exactly one line of the form `EPIC-RESULT: status=<pr-open|needs-human|failed> pr=<url[,url] or none> reason=<one line>`. The runner reads it; any closing notes may follow it.
{PLAN_ITEM}
```

`{STACK_ITEM}` is empty unless stacked and the layer is above 1. Then it is ` Branch your work from {PARENT_BRANCH}, not from {BASE}: this layer sits on top of it; never merge it in.` and `{BASE}` is filled with the parent's branch for that child, so the PR targets it.

`{PLAN_ITEM}` is empty for a ticket or item run. For a plan run it is the line below, because `prp-implement`
ends at its report and its PR step (`ship`) asks before commit, push and PR — questions nobody can
answer headless:
`6. When prp-implement reports complete, ship it with /codebase-intelligence:ship, PR base {BASE}. Every confirmation ship or worktree-lifecycle would ask is answered in advance: YES to stage, commit, push and open the PR; NO to removing the worktree. A plan without acceptance criteria to anchor on is a NEEDS-HUMAN stop (item 1), never a guess.`

`{RESUME_BLOCK}` is empty on the first run. On a relaunch it is:
`RESUME: a previous run of {CHILD} stopped ({REASON}). Restore session-memory for it first and continue from "Last-Session State (resume here)". Reuse the existing spec, plan and worktrees from its vault state note; do not redo finished work.`
followed by a blank line.

**Restack run** (stacked only; same policy block, items 1, 4, 5, plus):
```
Unattended restack. The layer below {CHILD} ({PARENT_BRANCH}) has merged into {BASE} and the squash left this branch carrying its old commits. Work only in {CHILD}'s existing worktree on branch {BRANCH}:
  git fetch origin && git rebase --onto origin/{BASE} {PARENT_BRANCH} {BRANCH}
  git push --force-with-lease origin {BRANCH}
  gh pr edit <url> --base {BASE}
PR(s): {PR_URLS}. On any conflict: git rebase --abort, change nothing, and finish with `EPIC-RESULT: status=needs-human pr=none reason=restack conflict in <files>`. Never resolve a conflict by dropping a change.
```

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
- **Checklist** (umbrella mode): the `.epic.md` children in file order, each `[x] merged`/`[x] skipped` or `[ ] <status>` — the progress view the file itself deliberately does not hold.
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

Merge (including `gh stack merge`), deploy, edit Jira, run the epic it just created (`--create` always
stops for review), stack a DAG (branching work ships `independent`), or run on a cloud schedule (the
vault and worktrees are local).
