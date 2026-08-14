---
name: ship
description: Scan changes, commit, push, run parallel review fan-out (function/test/security), and create a PR — with confirmation at each step
argument-hint: "[optional commit message or PR title]"
disable-model-invocation: true
allowed-tools:
  - Bash(git status)
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git push *)
  - Bash(git checkout *)
  - Bash(git branch *)
  - Bash(git merge-base *)
  - Bash(gh pr create *)
  - Bash(gh pr view *)
  # Step 3a pre-PR gate — read-only project toolchain (typecheck / lint / build / test)
  - Bash(npm ci *)
  - Bash(npm run *)
  - Bash(npm test *)
  - Bash(npx *)
  - Bash(node -e *)
version: 2.2.0
---

Ship the current changes through commit, push, and PR creation. Confirm with the user before each step using the AskUserQuestion tool.

## Step 1: Scan

- Run `git status`, `git diff`, `git log --oneline -5`
- Summarise changes (modified / added / deleted / untracked)
- If no changes, stop

## Step 2: Stage & Commit

- Propose which files to stage. **Never stage** these:
  - Secrets: `.env*`, `*.pem`, `*.key`, `credentials.json`
  - Lock files: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` (unless intentionally updated)
  - Generated: `*.gen.ts`, `*.generated.*`, `*.min.js`, `*.min.css`
  - Build output: `dist/`, `build/`, `.next/`, `__pycache__/`
  - Dependencies: `node_modules/`, `vendor/`, `.venv/`
  - OS/editor: `.DS_Store`, `Thumbs.db`, `*.swp`, `.idea/`, `.vscode/settings.json`
- **Refuse to commit onto the base branch.** Before staging anything, run the assertion in
  `../../shared/branch-rule.md` with `$BASE` from `../../shared/git-base-detection.md`.
  On a 🔴: offer to create `feature/<slug>` off the current work and commit there — never commit to the
  base "just this once", and never resolve it by pushing to the base and opening a PR afterwards.
- Draft a commit message based on the changes, matching the repo's existing commit style
- **ASK the user to confirm or edit**: show the exact files to stage and the proposed commit message
- Only after confirmation: stage the files and create the commit
- If the commit fails (e.g., pre-commit hook), fix the issue and try again with a NEW commit

## Step 3: Push

- Check if the current branch has an upstream remote
- If not, propose creating one with `git push -u origin <branch>`
- **ASK the user to confirm** before pushing
- Only after confirmation: push to remote

## Step 3a: Pre-PR gate (MANDATORY — runs before the fan-out, never skipped)

`Skill(codebase-intelligence:pre-pr-gate)` on the pushed HEAD, once per repo with diffs.

Mechanical, non-negotiable, and **not subject to the Step 3b skip rule**: the fan-out below may be
skipped for a tiny PR, but the gate may not. A one-line change that deletes an import breaks the build
just as thoroughly as a large one.

- ✅ → carry the receipt block into the PR body (Step 4) and continue.
- 🔴 → **do not create the PR.** Report the blockers, fix them, re-run the gate from L1 on the new HEAD
  (max 3 cycles), then continue. Never open a PR "so CI can tell us" — the gate already can.

Confirmations: the gate is read-only, so it runs without asking. Fixing what it finds follows the
normal edit flow.

## Step 3b: Review fan-out (parallel)

Run after push, before PR draft. Three parallel adversarial reviewers in one message.

### Scope + skip rule

`$BASE` / `$MERGE_BASE` / the size counts come from `../../shared/git-base-detection.md`; this skill
adds only the sensitivity probe:

```bash
SENSITIVE=$(git diff --name-only "$MERGE_BASE"..HEAD | grep -E 'auth|payment|migration|secret|token|crypto' | head -1)
```

**Skip fan-out** when ALL hold:
- `FILES ≤ 2`
- `LOC < 50`
- `SENSITIVE` empty

On skip, emit one line for the PR body: `Skipped: tiny PR ({FILES} files, {LOC} LOC, no sensitive paths)`.

### Otherwise — three parallel reviewers

In a single message, launch three `Agent(general-purpose)` calls. Each gets one prompt block from `REVIEWER_PROMPTS.md` plus the diff range `{MERGE_BASE}..HEAD`. Reviewers are independent — no shared context.

| Reviewer | Lens | Prompt block |
|---|---|---|
| function | Function-Quality 20-item checklist | `REVIEWER_PROMPTS.md#function` |
| test | Test-Quality 16-item checklist | `REVIEWER_PROMPTS.md#test` |
| security | Security 12-item checklist | `REVIEWER_PROMPTS.md#security` |

Each reviewer returns: verdict (`GO` / `NO-GO`), top-3 findings (file:line + one-line description), one-line rollback note if applicable.

### Synthesis

After all three reviewers return:

```
Aggregate verdict:
  - GO if all three say GO
  - NO-GO if any reviewer says NO-GO

Top-3 blockers (highest severity across reviewers, dedup by file:line)

Rollback note (longest single suggestion across reviewers)
```

Surface the synthesis to the user before Step 4 drafts the PR body.

## Step 4: Pull Request

- Check if PR exists for this branch via `gh pr view`. If yes, show URL and stop.
- **Draft the title and body with `Skill(codebase-intelligence:pr-description)` — always, for every
  PR, without asking whether to use it.** It analyses ALL commits on this branch against the real
  merge-base (not just the latest commit), derives the mandatory `[TICKET] task description` title
  (repo root folder name when there is no ticket), fills every template section from the actual diff,
  and **writes the description to the vault before the PR is opened**. Hand it:
  - the **Pre-PR gate** receipt block from Step 3a verbatim, one per repo (mandatory). This is what
    lets reviewers and the PR bots skip re-deriving these checks: every layer's verbatim command, its
    exit code, and the repo's own rule IDs already answered. A PR body without a receipt block whose
    SHA matches the pushed HEAD is incomplete.
  - the **Review fan-out** result from Step 3b (mandatory):
    ```
    ## Review fan-out
    - Function: {GO|NO-GO} — {top finding or "—"}
    - Test:     {GO|NO-GO} — {top finding or "—"}
    - Security: {GO|NO-GO} — {top finding or "—"}

    Aggregate: {GO|NO-GO}
    {Top-3 blockers list, or "None"}
    {Rollback note, or "—"}
    ```
    Or, if skipped: `Skipped: tiny PR (N files, M LOC, no sensitive paths)`.
- A **failed vault write blocks the PR** — the description is a vault artifact first and a PR body
  second. Fix the write, do not fall back to a local file.
- **ASK the user to confirm or edit** the returned title and body. This confirmation stays: creating a
  PR is outward-facing. What is *not* asked is which tool wrote the description.
- Only after confirmation: create the PR with `gh pr create`
- Show the PR URL when done, and pass it back to `pr-description` so it patches `pr:` and `## Links`
  into the vault note

## Rules

- NEVER skip a confirmation step — each step requires explicit user approval
- NEVER force-push
- NEVER commit .env, secrets, or credential files
- If the user says "skip" at any step, skip that step and move to the next — **except Step 3a**: the
  pre-PR gate is not skippable and a 🔴 verdict blocks PR creation. If the user insists on opening a PR
  over a 🔴, say plainly which blockers are unresolved, put them at the top of the PR body, and mark the
  PR a draft.
- NEVER weaken a gate, lint severity, or rule glob, and never add `@ts-ignore` / `eslint-disable` /
  `.skip`, to make Step 3a pass — fix the code instead
- NEVER ask whether to use `pr-description`, and never hand-roll a PR body instead of calling it —
  every PR gets the `[TICKET] task description` title and the vault note
- If $ARGUMENTS is provided, use it as the commit message and as the description half of the PR title
  (the `[TICKET]` tag is still derived, never dropped)