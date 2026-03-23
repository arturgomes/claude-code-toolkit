# arturgomes/claude-code-toolkit

Claude Code (terminal) **plugin marketplace** — codebase intelligence layer for prp-core.

> ⚠️ This is for [Claude Code](https://code.claude.com) — the terminal CLI tool (`claude`).
> Not for Claude Desktop.

## Install the plugin

```bash
# 1. Base workflow engine
claude /plugin marketplace add Wirasm/PRPs-agentic-eng
claude /plugin install prp-core

# 2. Intelligence layer (this repo)
claude /plugin marketplace add arturgomes/claude-code-toolkit
claude /plugin install codebase-intelligence
```

---

## MCP server setup

All MCPs use `--scope user` so they're available in every project without per-repo config.
Run these once in your terminal — Claude Code stores them in `~/.claude/`.

### Serena — LSP structural search

```bash
docker pull ghcr.io/oraios/serena:latest

claude mcp add serena \
  --scope user \
  --transport stdio \
  -- docker run --rm -i \
     --network host \
     -v "${HOME}/projects:/workspaces/projects" \
     ghcr.io/oraios/serena:latest \
     serena start-mcp-server --transport stdio
```

First use per project — index the codebase:
```bash
cd /your/project
uvx --from git+https://github.com/oraios/serena.git index-project .
```

### SocratiCode — semantic vector search

```bash
claude mcp add socraticode \
  --scope user \
  --transport stdio \
  -- npx -y socraticode
```

First use per project — tell Claude Code:
```
> Index this codebase
```
SocratiCode auto-pulls its own Qdrant + Ollama Docker images on first run.

### Context7 — verified library documentation

```bash
claude mcp add context7 \
  --scope user \
  --transport http \
  https://mcp.context7.com/mcp
```

### Atlassian Jira

```bash
# 1. Get an API token: https://id.atlassian.com/manage-profile/security/api-tokens
# 2. Encode credentials
echo -n "your-email@company.com:your-api-token" | base64

# 3. Add MCP
claude mcp add atlassian \
  --scope user \
  --transport http \
  https://mcp.atlassian.com/v1/mcp \
  --header "Authorization: Basic <base64-output>"
```

### Verify all MCPs are registered

```bash
claude mcp list
```

---

## KB setup

The `ask-kb`, `consult-kb`, and `kb-indexer` skills need a registry file:

```bash
mkdir -p ~/kb
cp "$(claude --print-config-dir)/plugins/arturgomes/codebase-intelligence/skills/ask-kb/references/kb-registry-example.yaml" \
   ~/kb/kb-registry.yaml
# Edit ~/kb/kb-registry.yaml to point at your KB files
```

To add a book to your KB, upload it and tell Claude Code:
```
> Add this PDF to my knowledge base
```

---

## Global gitignore (run once)

Prevent auto-generated files from leaking into any repo:

```bash
cat >> ~/.gitignore_global << 'EOF'
.memory/
.serena/
.indexes/
EOF

git config --global core.excludesfile ~/.gitignore_global
```

---

## Skills

| Skill | Purpose |
|---|---|
| `task-memory` | Cross-session memory in `~/.claude/memory/<TICKET>/<branch>.md` |
| `codebase-search` | Serena (LSP) + SocratiCode (semantic), cache-aside |
| `drift-guard` | Seven drift questions at every phase gate — keeps work anchored to AC |
| `context7-research` | Context7 MCP — verified library docs, no hallucinated API calls |
| `ask-kb` | Query personal KB for patterns and principles |
| `consult-kb` | Review architecture decisions against KB |
| `kb-indexer` | Ingest books/PDFs into the KB |

See [plugins/codebase-intelligence/README.md](plugins/codebase-intelligence/README.md) for the full phase injection map.
