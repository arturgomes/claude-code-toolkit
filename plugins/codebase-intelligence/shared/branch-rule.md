# The branch rule — never write on `main` / `master` / the base branch

**Every writer works on its own dedicated feature branch, forked from the up-to-date base of the repo
it is bound to. Never `main`, never `master`, never the detected base branch under any other name,
never another task's branch.**

This holds for every repo a run touches — including this toolkit itself — and has **no diff-size
exemption**. "It was a one-line change" is the sentence that precedes every commit that had to be
reverted off a protected branch.

## Assert it mechanically, before the first write

Judgment is not the control here; this predicate is. `$BASE` comes from
`git-base-detection.md`.

```bash
CUR=$(git branch --show-current)
case "$CUR" in
  main|master|"$BASE"|"") echo "🔴 STOP: on '$CUR' — no writes until branched"; exit 1 ;;
esac
```

The empty case catches **detached HEAD**, where `git branch --show-current` prints nothing. A detached
HEAD is not a safe place to write either — the commits become unreachable the moment anything
checks out.

Run the assertion **after** creating the worktree or branch, not only before. The three ways a writer
ends up on the base branch anyway:

1. **A silent fallback.** `git switch -c` failed, the serial fallback path continued, and HEAD stayed
   exactly where it was. *A fallback costs isolation, never the branch.*
2. **A repo already parked on an unrelated branch.** That is not permission to build there — fork from
   the detected base.
3. **Multi-repo runs.** One clean repo says nothing about the other two. Assert **per repo**.

## Consequences

- A writer that writes while its HEAD is the base branch is a **🔴 on its first round**, and its work
  does not merge.
- `pre-pr-gate` L8 backs this up at the other end: a commit on the base branch itself is a 🔴 that
  blocks the PR.
- `ship` refuses to stage anything before this assertion passes.
- **Never force-push a branch another branch is stacked on** — restack with `gh stack rebase` / `sync`
  instead.
