---
name: ship
description: Scan changes, commit, push, and create a PR — with confirmation at each step
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
  - Bash(gh pr create *)
  - Bash(gh pr view *)
version: 2.0.1
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

## Step 4: Pull Request

- Check if PR exists for this branch via `gh pr view`. If yes, show URL and stop.
- Analyze ALL commits on this branch vs the base branch (not just the latest commit)
- Draft a PR title (under 72 chars) and body with:
  - Summary: 2-4 bullet points
  - Test plan: how to verify
- **ASK the user to confirm or edit** the title and body
- Only after confirmation: create the PR with `gh pr create`
- Show the PR URL when done

## Rules

- NEVER skip a confirmation step — each step requires explicit user approval
- NEVER force-push
- NEVER commit .env, secrets, or credential files
- If the user says "skip" at any step, skip that step and move to the next
- If $ARGUMENTS is provided, use it as the commit message / PR title