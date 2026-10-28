# Atomic commits, reverts, and the bounded adversarial pass

One task → one commit, made by whoever ran the task's gate, **after** that gate passes and **before**
control returns to the orchestrator. The branch becomes a readable sequence of green steps, and an
adversarial finding that says "wrong direction" has exactly one commit to undo.

## The commit protocol (inside the task's subagent / the specialist's worktree)

0. **Precondition.** The task starts on a tree that is clean *for its own files*:
   `git status --porcelain -- <files:>` prints nothing. Otherwise refuse the task and report — the
   orchestrator left something behind. Other paths (untracked scratch, a sibling's work in a shared
   checkout) are not this task's business and are never touched.
1. **Gate first.** The task's typecheck and behavioral gate (`expected_gate`) exit `0`. **No commit on
   a failed gate** — report the failure and leave the task's files as it found them:
   `git stash push -u -m "<task-id> failed attempt" -- <files:>` (the pathspec is mandatory — without
   it the stash swallows the whole tree, including work that is not this task's). Nobody pops it; it
   is the recoverable record of the attempt.
2. **Stage only the task's own `files:`.** Never `git add -A`, never a file outside the task.
3. **Subject from the task's `commit:` field** (prp-plan), in the repo's own convention — read
   `git log --oneline -20` for the style. A task without the field (an older plan, a mediator
   contract) derives it as `type(scope): <task title>`. Body optional: one line per non-obvious
   decision.
4. **No AI attribution, anywhere.** No `Co-Authored-By:` trailer naming an assistant, no
   "Generated with …" footer, no robot emoji, no mention of the assistant or tool that wrote the
   change — not in the subject, the body, the PR title, or the PR body. Authorship is the human's git
   identity. Write the message by hand with `git commit -m` (never through a template that appends
   trailers), then check it:

   ```bash
   # trailers are matched on the assistant's e-mail / product, not on a first name — a human
   # co-author called Claude is not a hit; a bare robot emoji is a hit only at line start
   AI_ATTRIBUTION='(co-authored|signed-off|assisted|generated)[- ]?(by|with)?:?[^<]*<[^>]*(anthropic|copilot|cursor|openai|codex)|noreply@anthropic\.com|generated[ -]?(with|by):? *\[?(claude|copilot|cursor|codex|chatgpt)|^[[:space:]]*🤖'
   git log -1 --format=%B | grep -qiE "$AI_ATTRIBUTION" && echo "🔴 strip the attribution: git commit --amend" || echo "attribution clean"
   ```

   The same predicate runs over every PR title and body before it leaves (`pr-description`), over
   `$MERGE_BASE..HEAD` in `ship` before the push, and again in `pre-pr-gate` L8. Amending your own
   unpushed HEAD is fine. An older unpushed commit is reworded without an interactive rebase:

   ```bash
   git rebase "$MERGE_BASE" --exec 'git commit --amend --no-edit -q -m "$(git log -1 --format=%B | grep -viE "$AI_ATTRIBUTION")"'
   ```

   A pushed commit is reworded only by the human (it needs a force-push, which these flows never do).
5. **Return the sha** (`git rev-parse --short HEAD`). The orchestrator verifies
   `git log -1 --format='%h %s'` names this task and `git status --porcelain -- <files:>` is empty
   before the task is marked done. A result that says "done" without a commit is not done.

Merges keep these commits — a true merge or fast-forward, **never a squash** — so a later revert has
one sha to name.

## Reverting a commit an adversarial reviewer rejects

Only a **REVERT** verdict undoes work: the reviewer says the *approach* is wrong, not that a line is
missing or a test is thin.

```bash
git revert --no-edit <sha>     # one per task commit, newest first
```

Never `git reset --hard`, never `--force`, never rewrite a pushed branch. The revert keeps the history
honest, is safe on a pushed branch, and leaves the attempt findable.

**Who reverts, where:** the commit is reverted on the branch that holds it, by that branch's single
writer. In `prp-implement` that is the main thread on the feature branch. In `prp-orchestrate` a
REVERT raised *before* the merge is executed by the **owning lane in its own worktree** as its next
criterion (the mediator never writes inside a lane); a REVERT raised *after* the merge is executed by
the mediator on the slice branch. A REVERT redo resets that lane's round counter **once** — it does not
consume the 3-round cap, and it is not a way around it. Then: record
`<sha> reverted — <finding>` in session-memory `## Open Failures` (with `Verify:` = the finding's
`file:line`), reopen the task with the finding attached, and redo it as a fresh commit.

A **FIX** verdict never reverts: the owner lands one fix commit, gated mechanically (typecheck, the
task's gate, the pre-PR gate). **ACCEPT-WITH-RISK** is recorded, with the reason, in the PR body's
Review Focus.

## Why the adversarial pass is bounded

A reviewer that must always find something, re-run on every fix it causes, is an infinite loop — the
Stop-hook gate was observed at 95 reviews in one session. The caps:

- **One adversarial pass per unit** — per slice in `prp-orchestrate`, once after the last task in
  `prp-implement`, once per PR in `ship`.
- **A second pass only over work redone after a REVERT**, and only over that work. Never a third.
- **Fix commits are never re-reviewed adversarially.** They are judged by the mechanical gates.
- **Mediator rounds cap at 3 per specialist per slice**; a fourth round of the same criteria is a
  human gate, not another round.
- Findings that survive the caps go into the PR body's Review Focus as known risks.
