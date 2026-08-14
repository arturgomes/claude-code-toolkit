# Base-branch, merge-base, and changed-files detection

One canonical chain, because the copies had drifted: some fell straight back to `main`, others tried
`git remote show origin` first. A repo whose default branch is `develop` got a different answer
depending on which skill asked — and the skill that guessed `main` then diffed against the wrong base,
so its "changed files" list was whatever had landed on `develop` since the fork.

**Never hardcode `main`.** It is the last-resort fallback only.

## Detect the base branch

```bash
BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
[ -z "$BASE" ] && BASE=$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p')
[ -z "$BASE" ] && BASE=main   # last-resort fallback only
echo "base=$BASE"
```

`refs/remotes/origin/HEAD` is local and instant but absent on some clones (a bare `git clone --depth`,
or a remote added by hand). `git remote show origin` is authoritative but hits the network. Try them in
that order; falling back to `main` without trying the second is the bug this file exists to prevent.

An explicit `--base <branch>` from the caller **overrides all three** — no detection runs.

## Merge-base and the changed-file set

Always diff from the merge-base, never from the base tip: a base that moved ahead since the fork would
otherwise report other people's commits as this branch's changes.

```bash
MERGE_BASE=$(git merge-base HEAD "origin/$BASE")
CHANGED=$(git diff --name-only --diff-filter=ACMR "$MERGE_BASE"..HEAD)
```

`--diff-filter=ACMR` keeps Added / Copied / Modified / Renamed and **drops Deleted** — a linter or
typechecker handed a deleted path fails on a file that is correctly gone.

Filter by extension at the point of use, so the caller decides its own language scope:

```bash
CHANGED_TS=$(git diff --name-only --diff-filter=ACMR "$MERGE_BASE"..HEAD | grep -E '\.(ts|tsx)$' || true)
```

The trailing `|| true` matters: `grep` exits 1 on no matches, which reads as a command failure and
aborts a `set -e` script on the entirely normal case of "no TypeScript changed".

## Diff size

```bash
FILES=$(git diff --name-only "$MERGE_BASE"..HEAD | wc -l)
LOC=$(git diff --shortstat "$MERGE_BASE"..HEAD | awk '{print $4+$6}')
```

Related: `branch-rule.md` uses `$BASE` from here for its assertion.
