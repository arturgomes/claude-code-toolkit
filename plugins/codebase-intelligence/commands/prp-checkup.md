---
name: prp-checkup
description: >
  Sweep the PRs you authored that have merged since the last checkup, and finish each one: remove its
  worktree, delete its branch locally and on the remote, and close its session-memory note with a
  conclusion. Keeps a ledger so each PR is cleaned exactly once. Merged PRs only — closed-unmerged
  ones are reported, never deleted. Dry-run by default-safe: the plan is shown and confirmed before
  anything is removed.
argument-hint: "[--since <YYYY-MM-DD>] [--all] [--repo <owner/name>] [--dry-run] [--yes] [--include-abandoned] [--limit <n>]"
---

# /prp-checkup — finish the PRs that merged while you moved on

Every other command in this plugin ends at "PR opened". The PR then merges, and its branch, its remote
copy, its worktree directory, and its open-ended session note all quietly survive — one set per
ticket, accumulating until `git branch` is unreadable and the vault is full of sessions that never
concluded. This command is the sweep that closes them.

It is **read-only until you confirm.** It reads GitHub for what merged, reads git for what still
exists locally, prints the plan, and only then asks.

## Step 1 — Resolve the author and the repo set

```bash
AUTHOR=$(gh api user --jq .login)
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)   # or --repo <owner/name>
```

The author is **you** — `@me` in GitHub's search grammar. This command never cleans up after other
people: their branches are not yours to delete, and their session notes do not exist on your machine.

`--repo <owner/name>` targets a different repo (it must be checked out locally for the worktree and
branch steps to have anything to do; without a local checkout only the GitHub-side report is
meaningful). A multi-repo preset run is swept one repo at a time — run the command in each.

## Step 2 — Read the ledger: what "since the last execution" means

The ledger is a **vault note**, one per repo, per the contract in `../shared/vault-persistence.md`:

```
02-Notes/Sessions/prp-checkup-<repo>.md
```

It holds frontmatter plus a single fenced `json` block, written whole-note `overwrite` through the
`ultimate-obsidian` MCP. It is **not** `<repo>/.claude/prp-checkup.json`: this ledger is the
idempotency key for *destructive* actions, and a repo-local copy means your laptop and your desktop
disagree about which branches are already deleted. A vault note is machine-independent by
construction, so the window and the `processed[]` set mean the same thing everywhere.

```json
{
  "lastRunAt": "2026-07-28T09:14:02Z",
  "processed": [
    { "pr": 412, "branch": "feature/PROJ-421-pdf-export", "mergedAt": "2026-07-27T16:02:11Z",
      "actions": ["worktree:removed", "branch:deleted", "remote:deleted", "session:closed"] }
  ]
}
```

- **Absent ledger** (first run) → default the window to the last **30 days** rather than all history.
  A first run on a long-lived repo would otherwise propose deleting hundreds of branches, which is
  exactly the kind of plan nobody reads before approving. Say that the window was defaulted, and point
  at `--all` / `--since`.
- `--since <YYYY-MM-DD>` overrides the window. `--all` removes it entirely.
- `processed[]` is the idempotency key: a PR already in it is skipped even if it falls in the window,
  so re-running the command twice is a no-op the second time.
- The ledger is written **after** the actions, recording what actually happened — including skips and
  their reasons. Never write it in advance.

**A failed vault write is a blocker, not a warning** — stop and report rather than falling back to a
local file, because a local ledger is precisely the disagreement this replaced. If the vault is
unreachable, the safety predicates still re-check everything from GitHub, so the cost of *not* running
is a deferred sweep, never a wrong deletion.

## Step 3 — List the merged PRs in the window

```bash
gh pr list --repo "$REPO" --author "@me" --state merged --limit "${LIMIT:-100}" \
  --search "merged:>=$SINCE" \
  --json number,title,headRefName,headRefOid,mergedAt,url,baseRefName
```

Also list the abandoned ones — reported, never acted on by default:
```bash
gh pr list --repo "$REPO" --author "@me" --state closed --limit "${LIMIT:-100}" \
  --search "closed:>=$SINCE -is:merged" \
  --json number,title,headRefName,closedAt,url
```

If `gh` is unauthenticated or absent, stop and say so — `gh auth login`. There is no local fallback:
git cannot tell you whether a PR merged, and guessing from `git branch --merged` is exactly the
mistake that deletes squash-merged work.

## Step 4 — Run the cleanup protocol per PR

For each merged PR in the window and not in `processed[]`, follow
`Skill(codebase-intelligence:post-merge-cleanup)`. It owns the safety predicates and the three
actions; this command owns the batch, the window, and the ledger. Do not reimplement its checks here —
a second copy of a safety rule is a second place for it to be wrong.

The short version of what it enforces, so the plan you print is honest about it:

- **P1** — the local branch tip must equal the merged PR's `headRefOid`. Extra local commits ⇒ skip.
- **P2** — the worktree must be clean. Uncommitted work ⇒ skip.
- **P3** — no open PR may still target this branch (the stacked-PR guard) ⇒ skip.
- **P4** — never a base or protected branch.

## Step 5 — Print the plan, then confirm once

Print the table before doing anything:

```
Checkup — arturgomes/seathq-fe · window: since 2026-07-28 (last checkup) · 4 merged PRs

PR    branch                        merged      worktree                 will do
#412  feature/PROJ-421-pdf-export   Jul 27      ../fe-worktrees/pdf…     remove wt · delete local+remote · close session
#418  feature/PROJ-430-auth         Jul 29      —                        delete local+remote · close session
#421  fix/PROJ-433-timeout          Jul 30      ../fe-worktrees/timeout  SKIP — P1: 2 commits not in the merged PR
#425  chore/PROJ-435-deps           Aug 01      —                        delete local · remote already gone · close session

Also found (no action): #427 spike/throwaway — closed unmerged, 6 days ago.
```

Then **one** confirmation for the batch, naming the remote deletions explicitly — those are the
outward-facing, non-undoable part. `--yes` skips the prompt (for a cron or a loop); `--dry-run` stops
here and never asks. Anything the user declines is recorded as skipped, with the reason `declined`.

Per-item confirmation is only required for `--include-abandoned`, where each closed-unmerged branch is
its own decision because its work exists nowhere else.

## Step 6 — Write the ledger and report

Read the ledger note, add every PR handled this run to `processed[]` with the actions that actually ran
(including `skipped:<predicate>`), set `lastRunAt`, and write the whole note back — read-modify-write
in one `overwrite`, never an append, since an appended JSON document is unparseable. Then print the
one-row-per-PR result table from `post-merge-cleanup`.

A run that cleaned nothing still updates `lastRunAt` **only** if it examined the window successfully — a
run that failed to reach GitHub must not advance the window, or the PRs it never saw are skipped
forever.

Also write the run's outcome to `02-Notes/Reports/<YYYY-MM>/prp-checkup-<YYYY-MM-DD>-<repo>-report.md`
when anything was actually cleaned: what merged, what was deleted, and any `Carried forward` Open
Failure that outlived its ticket. A sweep that deleted branches and left no narrative record is the
persistence failure `vault-persistence.md` §5 describes.

## Suggested cadence

Weekly, or at the start of a day. `/loop` can drive it, but it should not run unattended with `--yes`
until you have watched a few runs and agree with what it proposes.

## What this command does NOT do

- Never cleans up PRs authored by anyone else.
- Never deletes the branch of a **closed-unmerged** PR without a per-item confirmation.
- Never merges, closes, reopens, or comments on a PR; never pushes code; never touches the base branch.
- Never force-removes a dirty worktree and never `-D` a branch carrying commits the PR did not include.
- Never advances `lastRunAt` on a failed run.
- Does not delete session notes — it closes them (`SESSION CLOSE`), which is append-only.
- Never writes `<repo>/.claude/prp-checkup.json`, or any other local mirror of the ledger. An
  unreachable vault stops the sweep; it does not fall back to a file one machine can see.
