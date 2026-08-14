---
name: post-merge-cleanup
description: >
  The finish checklist for a shipped unit of work, run AFTER its PR is merged: remove the worktree,
  delete the branch locally and on the remote, and close the session-memory note with a conclusion.
  Safety-gated — GitHub's merge state is the authority, nothing local-only is ever destroyed, and a
  stack layer is never deleted while a layer above it is unmerged. Used by /prp-checkup for a batch of
  merged PRs, and by prp-implement / prp-orchestrate for the single PR they just shipped. Invoke
  manually on "clean up after this PR", "the PR merged, tidy up", "delete the branch and close the
  session", "finish checklist".
version: 1.0.0
---

# post-merge-cleanup

The end of the lifecycle the rest of this plugin never reached. `worktree-lifecycle` EXIT removes a
worktree at *user satisfaction* — which is before the PR merges — and it deliberately touches neither
the branch nor the PR. So the branch, its remote copy, the worktree, and an open-ended session note
all survive the merge indefinitely. This skill is what closes them, and it runs **after** the merge,
never before.

Three actions, in this order, per merged PR:

1. **Worktree** — removed (checkout only).
2. **Branch** — deleted locally, then on the remote.
3. **Session-memory** — closed with a conclusion note (`session-memory` → SESSION CLOSE).

Order matters: you cannot delete a branch that a live worktree has checked out, and the session note
records what was cleaned up, so it is written last.

## Model capability (read first)

Tier semantics: `../../shared/model-tier.md`; here `frontier` may run the predicates in the cheapest
correct order. Mandatory at every tier **here**: **the merge authority check**, **the local-only-work check**, **the stack
guard**, **the clean-tree check**, and **confirmation before any remote deletion**. None of these has
a "it was obviously fine" exemption — they are the only thing standing between routine tidying and
deleting work that was never shipped.

---

## Eligibility — what may be cleaned up at all

| PR state | Action |
|---|---|
| **MERGED** | eligible for the full checklist |
| **CLOSED, not merged** | **report only.** The branch holds work that never landed anywhere. Never delete it as part of routine cleanup. Surfaced to the user as "abandoned — decide"; `--include-abandoned` makes it a per-item confirmed choice, never a batch default. |
| **OPEN** | not eligible. Register it as pending and move on. |

**GitHub is the merge authority, not git.** Under squash or rebase merging the branch's commits are
*not* ancestors of the base, so `git branch --merged` reports it as unmerged and `git branch -d`
refuses. That refusal is expected and is not evidence of unshipped work. The authoritative check:

```bash
gh pr view "$PR" --json state,mergedAt,mergeCommit,headRefName,headRefOid \
  --jq 'select(.state=="MERGED" and .mergedAt!=null) | "\(.headRefName) \(.headRefOid)"'
```
Empty output ⇒ not merged ⇒ **stop, clean nothing** for this PR.

---

## Safety predicates — all must pass before anything is deleted

Run these per PR. Any failure skips that PR's destructive steps, records the reason, and continues
with the next PR. A skip is a normal outcome, not an error.

### P1 — Nothing exists locally that was never pushed

The single most important check. The PR merged whatever was at `headRefOid`; anything on the local
branch beyond that SHA was never in the PR and would be destroyed silently.

```bash
LOCAL=$(git rev-parse --verify --quiet "refs/heads/$BRANCH") || LOCAL=""
[ -z "$LOCAL" ] && echo "no local branch — skip local delete, remote/session steps still apply"
[ -n "$LOCAL" ] && { [ "$LOCAL" = "$HEAD_REF_OID" ] \
  && echo "P1 ok: local tip == merged PR head" \
  || { echo "P1 STOP: local branch has commits not in the merged PR:";
       git log --oneline "$HEAD_REF_OID..$BRANCH"; }; }
```
A P1 failure is **never** resolved with `-D`. Report the extra commits and leave the branch alone.

### P2 — The worktree is clean

```bash
git -C "$WORKTREE" status --porcelain | head -1 | grep -q . \
  && echo "P2 STOP: uncommitted work in $WORKTREE" || echo "P2 ok: clean"
```
Never `git worktree remove --force` to get past this. Uncommitted work in a worktree whose PR merged
is work someone started *after* shipping — it is the most valuable thing in the directory.

### P3 — Stack guard: no layer is deleted under a layer that still depends on it

A stacked PR chain merges bottom-up. Deleting a merged bottom layer's branch while a layer above it is
still open orphans that PR's base.

```bash
gh pr list --state open --base "$BRANCH" --json number,headRefName --jq 'length'
```
Non-zero ⇒ **P3 STOP**: open PRs still target this branch. Clean it up on a later run, after they
merge. (GitHub retargets a stack automatically on merge, so this normally resolves itself — the guard
is for the window before it does, and for non-stack PRs someone manually based on this branch.)

### P4 — Not the current HEAD, not the base, not protected

`$BASE` from `../../shared/git-base-detection.md`:

```bash
case "$BRANCH" in
  main|master|develop|"$BASE") echo "P4 STOP: refusing to delete a base branch" ;;
  *) echo "P4 ok" ;;
esac
git worktree list --porcelain | grep -q "^branch refs/heads/$BRANCH$" && echo "note: checked out in a worktree — remove the worktree first"
```

---

## Step 1 — Remove the worktree

Find the worktree holding this branch; there may be none (serial-fallback runs never made one).

```bash
WORKTREE=$(git worktree list --porcelain \
  | awk -v b="refs/heads/$BRANCH" '/^worktree /{w=$2} $0=="branch "b{print w}')
```

- Found, and P2 passed → `git worktree remove "$WORKTREE"` then `git worktree prune`.
- Not found → nothing to remove; still run `git worktree prune` to clear stale registrations left by
  a directory someone deleted by hand.
- Never `--force`.

## Step 2 — Delete the branch

**Local**, after P1–P4:
```bash
git branch -d "$BRANCH" 2>/dev/null \
  || { echo "-d refused (expected under squash/rebase merge)"; git branch -D "$BRANCH"; }
```
`-D` is permitted **only** because P1 already proved the local tip equals the merged PR head. Without
a passing P1 there is no `-D` — that is the whole reason P1 exists.

**Remote:**
```bash
git push origin --delete "$BRANCH" 2>&1 | grep -q "remote ref does not exist" \
  && echo "already deleted on remote (GitHub auto-delete)" || echo "remote branch deleted"
```
A missing remote ref is a success, not a failure — most repos delete the head branch on merge.

**Confirmation.** Remote deletion is outward-facing and is not undone by a local `git` command. Ask
before the first one in a batch and state exactly which branches are in scope; one confirmation covers
the batch. `--dry-run` prints the plan and deletes nothing. Never treat "the user ran the command" as
the confirmation for the deletions the command discovered.

## Step 3 — Close the session-memory note

`Skill(codebase-intelligence:session-memory)` → **SESSION CLOSE**. This is the conclusion the note
never got: what shipped, which PR carried it, and the fact that the branch and worktree are gone so a
future restore does not go looking for them.

Resolve the note from the branch exactly as SESSION START does (ticket from the branch name, suffix
from the remainder). **No note found is not a failure** — record `session: none` and move on; not every
branch came from a PRP run.

---

## Output — one row per PR, no prose

```
PR    branch                       worktree   branch(local/remote)   session
#412  feature/PROJ-421-pdf-export  removed    deleted / deleted      closed
#418  feature/PROJ-430-auth        none       deleted / already-gone closed
#421  fix/PROJ-433-timeout         SKIPPED    P1: 2 unpushed commits  untouched
#425  spike/throwaway              SKIPPED    closed unmerged — abandoned, decide
```

Every SKIPPED row states the predicate that stopped it. A run that skips everything is a valid,
useful result — it means nothing was safe to remove, and it says why.

## What this skill does NOT do

- Never runs before a PR is merged. Merge state comes from GitHub, never inferred from git.
- Never force-removes a dirty worktree, never `-D` a branch that failed P1, never deletes a branch a
  live worktree has checked out.
- Never deletes the branch of a **closed-unmerged** PR as part of a batch — that work exists nowhere
  else.
- Never deletes a base/protected branch, and never a layer under an open stacked PR.
- Never deletes the PR, the merge commit, the session note, or any repo content — only the worktree
  checkout, the branch refs, and the note's *open* status.
- Does not reopen, re-run, or re-gate anything. It is cleanup, not verification.

## Dependencies

`git` (`worktree`, `branch`, `push`, `rev-parse`, `log`), `gh` (`pr view`, `pr list`) authenticated.
`Skill(codebase-intelligence:session-memory)` for SESSION CLOSE. Called by
`/codebase-intelligence:prp-checkup` (batch) and by `prp-implement` / `prp-orchestrate`'s finish
checklist (single PR). Complements `worktree-lifecycle` EXIT, which handles the *pre-merge* half and
is unchanged by this skill.
