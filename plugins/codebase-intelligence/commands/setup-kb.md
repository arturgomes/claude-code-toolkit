---
description: Bootstrap the local bookrag KB engine (pinned public base + your own patches) so the KB skills run without any ~/Documents dependency.
---

# /setup-kb

Provision the `bookrag` engine the KB skills (`ask-kb`, `consult-kb`, `add-pdf-to-kb`,
`ingest-web-doc-to-kb`, `benchmark-kb`) depend on — without vendoring third-party code and
without relying on a personal `~/Documents/ai-tools/skills-mono-repo` checkout.

## What it does

Runs the plugin's bootstrap script, which:
1. Clones the **public upstream** `hvasoares/skills-mono-repo` at a **pinned commit** into
   `~/.codebase-intelligence/skills-mono-repo` (override with `CI_BOOKRAG_HOME`). The base is
   fetched from source — never redistributed inside this plugin.
2. Applies the repo owner's own deltas as local patches: the `obsidian-ingest` pipeline and a
   Chroma batching fix (`upsert_to_chroma` batches ≤4000 vectors so large domains don't silently
   skip the dense index).
3. Verifies `uv run bookrag --help` works (first run resolves Python deps).

Idempotent — safe to re-run. After it completes, every KB skill resolves the engine via
`scripts/bookrag-home.sh` (env → managed clone → legacy path), so no personal path is required.

## Run it

```bash
bash "$(find ~/.claude -type f -path '*codebase-intelligence/scripts/bootstrap-bookrag.sh' 2>/dev/null | head -1)"
```

Report the resolved path it prints, and confirm with:

```bash
BOOKRAG_HOME="$(bash "$(find ~/.claude -type f -path '*codebase-intelligence/scripts/bookrag-home.sh' 2>/dev/null | head -1)")"
cd "$BOOKRAG_HOME" && uv run bookrag --help >/dev/null && echo "KB engine ready at $BOOKRAG_HOME"
```

## Prerequisites

- `git` and `uv` (`brew install uv`)
- Network access on first run (to clone the pinned upstream)

## Notes

- **Migrating an existing setup**: if you previously used `~/Documents/ai-tools/skills-mono-repo`,
  your generated domain KBs live in the Obsidian vault and are unaffected. The master `ask-kb` DB
  (`master-kb/domains/obsidian-vault/bookrag.db`) is data, not code — it will be (re)built under the
  managed clone on the next `ask-kb` rebuild. To reuse an existing large master DB, copy or symlink
  it into `$BOOKRAG_HOME/master-kb/domains/obsidian-vault/` before rebuilding.
- **Upstream availability**: bootstrap fetches a pinned SHA from the public repo. If that repo is
  removed or force-pushed, set `CI_BOOKRAG_REPO` to a mirror.
