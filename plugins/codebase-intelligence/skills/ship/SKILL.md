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
version: 2.1.0
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
- Draft a commit message based on the changes, matching the repo's existing commit style
- **ASK the user to confirm or edit**: show the exact files to stage and the proposed commit message
- Only after confirmation: stage the files and create the commit
- If the commit fails (e.g., pre-commit hook), fix the issue and try again with a NEW commit

## Step 3: Push

- Check if the current branch has an upstream remote
- If not, propose creating one with `git push -u origin <branch>`
- **ASK the user to confirm** before pushing
- Only after confirmation: push to remote

## Step 3b: Review fan-out (parallel)

Run after push, before PR draft. Three parallel adversarial reviewers in one message.

### Scope + skip rule

```bash
BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
MERGE_BASE=$(git merge-base HEAD "origin/$BASE")
FILES=$(git diff --name-only "$MERGE_BASE"..HEAD | wc -l)
LOC=$(git diff --shortstat "$MERGE_BASE"..HEAD | awk '{print $4+$6}')
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
- Analyze ALL commits on this branch vs the base branch (not just the latest commit)
- Draft a PR title (under 72 chars) and body with:
  - Summary: 2-4 bullet points
  - Test plan: how to verify
  - **Review fan-out** section (mandatory):
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
- **ASK the user to confirm or edit** the title and body
- Only after confirmation: create the PR with `gh pr create`
- Show the PR URL when done

## Rules

- NEVER skip a confirmation step — each step requires explicit user approval
- NEVER force-push
- NEVER commit .env, secrets, or credential files
- If the user says "skip" at any step, skip that step and move to the next
- If $ARGUMENTS is provided, use it as the commit message / PR title