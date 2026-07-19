---
description: Check that all codebase-intelligence prerequisites (system tools, MCP servers, KB engine, vendored tools) are present, and print the exact fix for anything missing.
---

# /doctor

Read-only preflight for the plugin. Verifies everything the commands and skills need and prints a
copy-pasteable fix for each missing item. Installs/bootstraps nothing.

## Run it

```bash
bash "$(find ~/.claude -type f -path '*codebase-intelligence/scripts/doctor.sh' 2>/dev/null | head -1)"
```

## What it checks

- **System tools** — `git`, `uv`, `python3`
- **MCP servers** — `ultimate-obsidian` (required); `serena`, `context7`, Atlassian/Jira (optional)
- **KB engine** — whether `bookrag` is provisioned (env → managed clone → legacy) and its CLI runs
- **Vendored tools** — `vendor/memory-central-web/` (web-search cache)
- **Data locations** — the Obsidian vault

## After running

- Relay the summary line and any `[MISS]` items with their fixes.
- If the KB engine is the only thing missing, run **`/setup-kb`** to provision it.
- Re-run `/doctor` after applying fixes to confirm a clean bill of health.
