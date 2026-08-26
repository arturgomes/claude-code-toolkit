---
description: Sync the Obsidian vault repo across machines — commit local changes as a host-stamped snapshot, pull with rebase from origin/main, then push. Run it when opening Claude Code on a machine and again before shutting down.
---

# /sync-vault — Bidirectional Vault Sync

The vault is this toolkit's system of record (session memory, plans, gate receipts, reports, PR
descriptions). This command keeps it converged across every machine you work from.

Execute the steps in order. Abort on the first anomaly — never guess a resolution.

---

## Step 0 — Resolve the vault path

First match wins:

1. `$ARGUMENTS` — an explicit path passed to the command
2. `$OBSIDIAN_VAULT` — environment variable
3. `~/Documents/Obsidian-Vault` — repo-wide default

```bash
VAULT="${ARGUMENTS:-${OBSIDIAN_VAULT:-$HOME/Documents/Obsidian-Vault}}"
```

If `$VAULT` does not exist, print
`⚠️  Vault not found at {VAULT}. Pass a path: /sync-vault ~/path/to/vault (or export OBSIDIAN_VAULT).`
and stop.

Use `$VAULT` wherever the commands below reference the vault.

> If you run RTK, prefix every `git` call below with `rtk` — RTK passes git through with compacted
> output. Plain `git` is correct everywhere RTK is not installed.

---

## Step 1 — Detect repo state

```bash
git -C "$VAULT" status --porcelain=v1 -b 2>&1
```

Capture:
- `HAS_CHANGES`: true if any non-blank lines follow the `##` branch line
- `BRANCH`: from the `## branch...` line (expect `main`)
- Output starts with `fatal:` → print `⚠️  Vault is not a git repo, or its origin remote is missing.` and stop.

If `BRANCH` is not `main`, print `⚠️  On branch {BRANCH}, expected main. Aborting to avoid mis-sync.` and stop.

---

## Step 2 — Commit local changes (only if any)

If `HAS_CHANGES` is true:

```bash
git -C "$VAULT" add -A
HOST=$(hostname -s)
STAMP=$(date +%Y-%m-%d\ %H:%M)
git -C "$VAULT" commit -m "sync: vault snapshot from ${HOST} @ ${STAMP}"
```

The hostname in the message is what makes a two-machine history readable later.

Record `LOCAL_COMMIT=yes`. On commit failure (e.g. a pre-commit hook), print the error and stop —
do NOT retry with `--no-verify`.

If `HAS_CHANGES` is false → `LOCAL_COMMIT=no`.

---

## Step 3 — Pull with rebase

```bash
git -C "$VAULT" pull --rebase origin main 2>&1
```

Interpret:
- `Already up to date` → `PULL=clean (no incoming)`
- `Successfully rebased` or a fast-forward → `PULL=clean (N commits pulled)`, N from the `Fast-forward` / commit list
- `CONFLICT` present →
  - `git -C "$VAULT" rebase --abort`
  - Print `⚠️  Rebase conflict. Aborted. Resolve manually: cd {VAULT} && git pull --rebase origin main`
  - Stop — do NOT push.

---

## Step 4 — Push to origin

```bash
git -C "$VAULT" push origin main 2>&1
```

Interpret:
- `Everything up-to-date` → `PUSH=nothing to push`
- A commit range in the output → `PUSH=pushed N commits`
- `rejected` / `non-fast-forward` → print `⚠️  Push rejected. Another machine pushed during the sync. Re-run /sync-vault.` and stop.
- Auth error → print the exact error and stop.

---

## Step 5 — Report

```
🔄 Vault sync — {YYYY-MM-DD HH:MM}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Vault:          {VAULT}
  Local changes:  {LOCAL_COMMIT == yes ? "committed" : "none"}
  Pull:           {PULL}
  Push:           {PUSH}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Vault in sync with origin/main.
```

If any step stopped early, replace the trailing line with `⚠️  Sync incomplete — see warnings above.`
