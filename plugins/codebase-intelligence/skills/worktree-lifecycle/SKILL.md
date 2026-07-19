---
name: worktree-lifecycle
description: >
  Create, use, and clean up a git worktree for an implementation run. ENTER makes a fresh worktree
  on a new feature branch off the auto-detected base branch (pulled up to date); EXIT — on user
  satisfaction — optionally ships (commit/push/PR), saves the session BEFORE deleting, verifies the
  branch is committed + pushed, then confirms before removing the worktree. Capability-gated with a
  no-worktree serial fallback. Auto-invoked by prp-implement (Phase 2 + post-report) and prp-loop
  (L.3); invoke manually on "make a worktree", "work in a worktree", "clean up the worktree",
  "remove the worktree".
version: 1.0.0
---

# worktree-lifecycle

A reusable, capability-gated git-worktree lifecycle for the codebase-intelligence implementing
surface. **Single source of truth** — `prp-implement` and `prp-loop` both call this skill instead
of duplicating worktree logic. Two protocols: **ENTER** (start work in a fresh, up-to-date,
isolated worktree) and **EXIT** (persist, then safely tear the worktree down).

The point of the worktree: an implementation run never mutates the primary checkout, always starts
from current base code, and leaves no stale worktree or uncommitted work behind.

## Model capability (read first)

This skill is model-agnostic. Read `CI_MODEL_TIER` (values: `frontier` | `standard` | `light`; default `standard` when unset or unknown).
- `frontier`: treat numbered sub-steps as intent; skip redundant per-step narration.
- `standard` / `light`: follow every numbered step verbatim.
Invariants are mandatory at EVERY tier and never skipped: executable gates, the AC anchor, drift checks, write-before-stop, the independent blind verifier, and blast-radius routing.

## Capability gate (read before ENTER or EXIT)

Worktree isolation is an **environment capability**, never a hard dependency. Resolve the tier once
per run and carry it through both protocols:

| Tier | Detected when | ENTER uses | EXIT uses |
|---|---|---|---|
| **harness** | an `EnterWorktree` / `ExitWorktree` tool is available (confirm via ToolSearch) | `EnterWorktree` | `ExitWorktree` |
| **git** | `git worktree -h` succeeds | `git worktree add` | `git worktree remove` |
| **serial (fallback)** | neither of the above | a new branch **in the current checkout** — no separate worktree | nothing to remove — the branch simply remains |

Executable tier probe:
```bash
git worktree -h >/dev/null 2>&1 && echo "git worktree available" || echo "SERIAL FALLBACK: no worktree — branch in place"
```

**Never require worktree support.** In the serial fallback the whole flow still runs; only the
physical isolation (a separate checkout directory) is skipped. State which tier you resolved to.

**Worktree path convention.** Default location is a **sibling directory** so the worktree never sits
inside the repo tree (where it could be accidentally committed or scanned):
`../<repo>-worktrees/<branch-slug>`. A caller may override the path; document any override.

---

## ENTER — start work in a fresh worktree

### Preconditions

1. Confirm the primary checkout is **clean** — a dirty tree must not be stranded:
   ```bash
   git status --porcelain | head -1 | grep -q . && echo "STOP: commit or stash changes before ENTER" || echo "clean — ok to ENTER"
   ```
   If dirty → STOP and ask the user to commit or stash first. Do not create a worktree over a dirty tree.
2. If already inside a worktree for this task (`git worktree list` shows it), **reuse it** — do not nest a second worktree.

### Steps

1. **Detect the base branch** (never hardcode `main`) — reuse the same chain as `prp-implement`
   Phase 0.2, `main` being only the last-resort fallback:
   ```bash
   BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
   [ -z "$BASE" ] && BASE=$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p')
   [ -z "$BASE" ] && BASE=main   # last-resort fallback only
   echo "base=$BASE"
   ```
2. **Fetch the base up to date**:
   ```bash
   git fetch origin "$BASE"
   ```
3. **Derive the branch slug** from the ticket / plan slug (kebab-case), e.g. `feature/<branch-slug>`.
4. **Create the worktree on a new branch off fresh base**, by tier:
   - **harness tier** → call `EnterWorktree` for `feature/<branch-slug>` based on `origin/$BASE`.
   - **git tier**:
     ```bash
     REPO=$(basename "$(git rev-parse --show-toplevel)")
     git worktree add "../${REPO}-worktrees/<branch-slug>" -b "feature/<branch-slug>" "origin/$BASE"
     ```
   - **serial fallback** → no separate checkout; branch in place:
     ```bash
     git switch -c "feature/<branch-slug>" "origin/$BASE"   # isolation skipped — state this
     ```
5. **Ensure the branch is current with base** (fresh worktree off `origin/$BASE` already is; otherwise `git pull --rebase origin "$BASE"`).
6. **Confirm the worktree/branch exists** (executable predicate):
   ```bash
   git worktree list | grep -q "<branch-slug>" || git branch --show-current | grep -q "<branch-slug>" \
     && echo "ENTER OK" || echo "ENTER FAILED"
   ```
7. **Report the active working path** to the caller — subsequent edits happen there.

---

## EXIT — persist, then tear down safely

**EXIT is the irreversible half. Its ordering is load-bearing: SAVE the session BEFORE any
deletion, and CONFIRM with the user before removing.** Never `git worktree remove --force` a dirty
tree to make cleanup succeed — that destroys uncommitted work.

### Trigger

Run EXIT **only** when the user explicitly signals satisfaction ("satisfied", "done", "ship it",
"looks good"). Never auto-trigger EXIT.

### Steps

1. **(Optional) Ship the work.** If the branch is not yet committed / pushed / PR'd and the user
   wants it, delegate to `Skill(codebase-intelligence:ship)` — commit → push → PR (ship runs its
   own per-step confirmations). This step is optional; EXIT does not rewrite ship.
2. **SAVE FIRST — before any deletion.** `Skill(codebase-intelligence:session-memory)` → SESSION END
   protocol (honours the write-before-stop gate). Record final state, the PR URL, the worktree path,
   and a resume note. **This must complete before Step 4.** Nothing below deletes anything until the
   session block is written.
3. **Uncommitted / unpushed guard** (executable predicate — run inside the worktree):
   ```bash
   git status --porcelain | head -1 | grep -q . && echo "STOP: uncommitted work — do not remove" || echo "clean"
   git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1 && echo "pushed" || echo "STOP: branch not pushed — do not remove"
   ```
   Any `STOP` → do not delete; report to the user and end (the worktree and its work are preserved).
4. **CONFIRM before removal.** Ask the user to confirm worktree removal (AskUserQuestion or an
   explicit yes). On **no** → keep the worktree, report its path, end.
5. **Remove**, by tier (only after Steps 2–4 all pass):
   - **harness tier** → `ExitWorktree`.
   - **git tier**:
     ```bash
     cd "$(git rev-parse --show-toplevel)/.."   # switch out of the worktree first
     git worktree remove "../<repo>-worktrees/<branch-slug>"
     git worktree prune
     ```
   - **serial fallback** → **nothing to remove.** There is no separate checkout; the feature branch
     remains (it is the PR branch). State this explicitly and skip removal.
6. **Never** delete the branch or the PR as part of EXIT — only the worktree checkout is removed.
7. **Report**: session saved (path), PR URL, and worktree removed / branch retained.

### EXIT invariant (self-check)

```bash
# The session must be saved before removal. If you are about to remove without a saved session, STOP.
echo "order check: SESSION END written? [yes] → confirm? [yes] → then remove. Any 'no' halts EXIT."
```

---

## What this skill does NOT do

- No parallel / fleet worktrees, no worktree pooling or cross-session reuse — one working worktree
  per run. (`prp-loop`'s independent verifier worktree is a separate, single checkout — its count is
  unchanged.)
- No auto-delete and no silent `--force` on a dirty tree.
- No hardcoding of `main` — the base is always the detected default.
- No new tools, MCP servers, or dependencies; no rewrite of `ship` or `session-memory` internals.

## Dependencies

`git` CLI (`git worktree`, `git fetch`, `git switch`, `git status`). Optional harness tools
`EnterWorktree` / `ExitWorktree` (deferred — verify via ToolSearch; treat absence as the fallback
trigger, never as a hard dependency). Delegates to `Skill(codebase-intelligence:ship)` (commit/push/PR)
and `Skill(codebase-intelligence:session-memory)` (SESSION END) — both unchanged by this skill.
