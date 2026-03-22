# arturgomes/claude-code-toolkit

Claude Code **plugin marketplace** — codebase intelligence layer for prp-core.

## Install

```bash
/plugin marketplace add Wirasm/PRPs-agentic-eng
/plugin install prp-core

/plugin marketplace add arturgomes/claude-code-toolkit
/plugin install codebase-intelligence
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

## MCP setup

```bash
# Serena
docker pull ghcr.io/oraios/serena:latest
claude mcp add serena --transport stdio \
  -- docker run --rm -i --network host -v ~/projects:/workspaces/projects \
  ghcr.io/oraios/serena:latest serena start-mcp-server --transport stdio

# SocratiCode (zero config)
claude mcp add socraticode --transport stdio -- npx -y socraticode

# Context7
claude mcp add context7 --transport http https://mcp.context7.com/mcp

# Atlassian Jira
echo -n "email@company.com:api-token" | base64
claude mcp add atlassian --transport http https://mcp.atlassian.com/v1/mcp \
  --header "Authorization: Basic <base64>"
```

## KB setup

```bash
mkdir -p ~/kb
cp plugins/codebase-intelligence/skills/ask-kb/references/kb-registry-example.yaml ~/kb/kb-registry.yaml
# edit to point at your KB files
```

## Global gitignore

```bash
printf ".memory/\n.serena/\n.indexes/\n" >> ~/.gitignore_global
git config --global core.excludesfile ~/.gitignore_global
```

See [plugins/codebase-intelligence/README.md](plugins/codebase-intelligence/README.md) for the full phase injection map.
