# arturgomes/claude-code-toolkit

Claude Code **plugin marketplace** — intelligence layer for prp-core.

## Add this marketplace

```bash
/plugin marketplace add arturgomes/claude-code-toolkit
/plugin install codebase-intelligence
```

## Install alongside prp-core

```bash
/plugin marketplace add Wirasm/PRPs-agentic-eng
/plugin install prp-core

/plugin marketplace add arturgomes/claude-code-toolkit
/plugin install codebase-intelligence
```

---

## What this adds to prp-core

`codebase-intelligence` shadows `prp-core:prp-plan` and `prp-core:prp-implement` with
augmented versions. Every original phase is preserved — the plugin only injects at
specific integration points.

### In `prp-plan`

```
Pre-Phase I   → Load ~/.claude/memory/<TICKET>/<branch>.md
Pre-Phase II  → Fetch Jira ticket: summary, AC, QA failure comments
Phase 2 (EXPLORE):
  Step 2A     → Memory pre-fill (skip re-searching cached areas)
  Step 2B     → prp-core:codebase-explorer + prp-core:codebase-analyst (unchanged)
  Step 2C     → Serena LSP symbol resolution + SocratiCode semantic enrichment
  Discovery   → Table gains Source column (memory/serena/socraticode/explorer/analyst)
Phase 6 (GENERATE):
  Plan file   → Gets Intelligence Context section (ticket, AC, QA, discovery sources)
Post-gen      → Save planning session to memory
```

### In `prp-implement`

```
Pre-Phase     → Load memory, restore prior task completion state
Phase 3.0     → Per-file memory cache check before first task
Phase 3.1     → Check memory before reading each MIRROR file
Phase 3.4     → Save interim memory every 3 tasks
Phase 5.2     → Report gets Intelligence Summary section
Phase 5.5     → Final memory save with full implementation status
```

---

## MCP setup

### Serena (LSP structural)
```bash
docker pull ghcr.io/oraios/serena:latest
claude mcp add serena --transport stdio \
  -- docker run --rm -i --network host \
  -v ~/projects:/workspaces/projects \
  ghcr.io/oraios/serena:latest serena start-mcp-server --transport stdio
```

### SocratiCode (semantic — zero config)
```bash
claude mcp add socraticode --transport stdio -- npx -y socraticode
# Then once per project: > Index this codebase
```

### Atlassian Jira
```bash
echo -n "email@company.com:jira-api-token" | base64
claude mcp add atlassian \
  --transport http https://mcp.atlassian.com/v1/mcp \
  --header "Authorization: Basic <base64>"
```
API token: https://id.atlassian.com/manage-profile/security/api-tokens

---

## Memory location

All memory lives in `~/.claude/memory/` — never inside project directories.

```bash
# Protect from accidental commits (run once globally)
echo ".memory/" >> ~/.gitignore_global
git config --global core.excludesfile ~/.gitignore_global
```
