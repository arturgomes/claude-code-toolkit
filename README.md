# arturgomes/claude-code-toolkit

Codebase intelligence plugin for **Claude Code** (terminal). Extends `prp-core` with
persistent memory, Serena LSP search, SocratiCode semantic search, personal KB consultation,
Context7 library verification, and drift-guard requirements anchoring.

> For [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) only — not Claude Desktop.

---

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- Docker (for Serena and SocratiCode)
- A Jira account (optional — Jira MCP is optional)

---

## Step 1 — Install plugins

Open your terminal and run Claude Code. Plugin commands run **inside** the Claude Code session, not from your shell:

```
# Inside claude session:
/plugin marketplace add Wirasm/PRPs-agentic-eng
/plugin install prp-core

/plugin marketplace add arturgomes/claude-code-toolkit
/plugin install codebase-intelligence

/reload-plugins
```

Verify:
```
/plugin list
```

You should see both `prp-core` and `codebase-intelligence` listed.

---

## Step 2 — Register MCP servers

Run these **from your shell** (outside Claude Code). They register globally — available in every project.

### Serena — LSP structural search

```bash
docker pull ghcr.io/oraios/serena:latest

claude mcp add serena \
  --scope user \
  --transport stdio \
  -- docker run --rm -i \
     --network host \
     -e SERENA_DOCKER=1 \
     -v "${HOME}/projects:/workspaces/projects" \
     ghcr.io/oraios/serena:latest \
     serena start-mcp-server \
     --context claude-code \
     --transport stdio
```

**First use per project** — index it so Serena starts fast:

```bash
cd /your/project

docker run --rm \
  -v "${PWD}:/workspaces/project" \
  ghcr.io/oraios/serena:latest \
  serena project index /workspaces/project
```

This creates a `.serena/` folder in your project. Add it to `.gitignore` if you don't want to commit it.

### SocratiCode — semantic vector search

```bash
claude mcp add socraticode \
  --scope user \
  --transport stdio \
  -- npx -y socraticode
```

**First use per project** — open Claude Code in the project and say:
```
> Index this codebase
```
SocratiCode auto-pulls its own Qdrant + Ollama Docker images on first run (~5 min, one-time).

### Context7 — verified library documentation

```bash
claude mcp add context7 \
  --scope user \
  --transport http \
  https://mcp.context7.com/mcp
```

### Atlassian Jira (optional)

```bash
# 1. Get an API token: https://id.atlassian.com/manage-profile/security/api-tokens
# 2. Encode your credentials
echo -n "your-email@company.com:your-api-token" | base64

# 3. Register the MCP
claude mcp add atlassian \
  --scope user \
  --transport http \
  https://mcp.atlassian.com/v1/mcp \
  --header "Authorization: Basic <paste-base64-output-here>"
```

### Verify

```bash
claude mcp list
# Should show: serena, socraticode, context7, atlassian
```

---

## Step 3 — Set up your knowledge base (optional)

The `ask-kb`, `consult-kb`, and `kb-indexer` skills use a personal knowledge base of books
and principles you've indexed. Skip this step if you don't have one yet — the skills degrade
gracefully when no KB is present.

```bash
mkdir -p ~/kb

# Download the example registry to use as a template
curl -sL https://raw.githubusercontent.com/arturgomes/claude-code-toolkit/main/kb-registry-example.yaml \
  > ~/kb/kb-registry.yaml

# Edit it to point at your actual KB files
$EDITOR ~/kb/kb-registry.yaml
```

To add a book to your KB later, upload the PDF to Claude Code and say:
```
> Add this PDF to my knowledge base
```

---

## Step 4 — Add to .gitignore (run once per project)

```bash
cat >> .gitignore << 'EOF'
~/.claude/memory/
.serena/
.indexes/
EOF
```

Or add globally so you never have to think about it:

```bash
cat >> ~/.gitignore_global << 'EOF'
~/.claude/memory/
.serena/
.indexes/
EOF

git config --global core.excludesfile ~/.gitignore_global
```

---

## Usage

Everything runs through `/codebase-intelligence:prp-plan` and `/codebase-intelligence:prp-implement` — same commands as prp-core,
but with the intelligence layer active.

### Plan a new feature

```
/codebase-intelligence:prp-plan "add PDF export for invoices PROJ-421"
```

What happens automatically:
1. Reads current git branch → extracts `PROJ-421`
2. Creates `~/.claude/memory/PROJ-421/<branch>.md` (or loads existing)
3. Fetches Jira ticket details + acceptance criteria (if Jira MCP configured)
4. Runs `codebase-explorer` + `codebase-analyst` with Serena + SocratiCode
5. Checks your KB for relevant patterns
6. Verifies library APIs via Context7
7. Generates `.claude/PRPs/plans/pdf-export-for-invoices.plan.md`
8. Saves session findings to memory

### Implement the plan

```
/codebase-intelligence:prp-implement .claude/PRPs/plans/pdf-export-for-invoices.plan.md
```

### Resume after QA failure (weeks later)

```
git checkout feature/PROJ-421-pdf-export
/codebase-intelligence:prp-plan "fix PROJ-421 QA failures"
```

Memory loads automatically — prior investigation, implementation decisions, and QA failure
context restored without re-searching.

---

## What's included

### Commands (shadow prp-core)

| Command | Replaces | What's added |
|---|---|---|
| `prp-plan` | `prp-core:prp-plan` | Memory load, Jira injection, drift-guard anchor, Serena+SocratiCode+KB in Phase 2, Context7 in Phase 3, AC traceability table |
| `prp-implement` | `prp-core:prp-implement` | Memory restore, per-task drift checks, Context7 before library calls, memory save every 3 tasks |

### Agents (shadow prp-core)

| Agent | Replaces | What's added |
|---|---|---|
| `codebase-explorer` | `prp-core:codebase-explorer` | Memory pre-fill, Serena symbol resolution, SocratiCode semantic queries, KB pattern lookup, Source column in output |
| `codebase-analyst` | `prp-core:codebase-analyst` | Memory pre-fill, Serena-first entry point resolution, scope boundary check |
| `web-researcher` | `prp-core:web-researcher` | KB pre-check (skip web for covered topics), Context7 API verification before web search |
| `codebase-researcher` | _(standalone)_ | Full pre-planning research pass |

### Skills

| Skill | Purpose |
|---|---|
| `task-memory` | Global cross-session memory in `~/.claude/memory/<TICKET>/<branch>.md` |
| `codebase-search` | Two-tier search: Serena (LSP) + SocratiCode (semantic), cache-aside |
| `drift-guard` | Seven drift questions at every phase gate — keeps work anchored to AC |
| `context7-research` | Verified library docs via Context7 MCP — no hallucinated API calls |
| `ask-kb` | Query personal KB for patterns and principles |
| `consult-kb` | Review architecture decisions against KB |
| `kb-indexer` | Ingest books/PDFs into the KB |

---

## Troubleshooting

**Plugin load errors (`/doctor`)**
Run `/plugin update codebase-intelligence` then `/reload-plugins`.

**Memory not creating**
Make sure `.claude/` exists in your project root: `ls -la .claude/`. If missing, Claude Code hasn't been initialised there yet — open `claude` from the project directory first.

**Serena timeout on first use**
Run `docker run --rm -v "${PWD}:/workspaces/project" ghcr.io/oraios/serena:latest serena project index /workspaces/project` before the session to pre-index.

**SocratiCode slow first run**
Normal — it's pulling Docker images. Subsequent runs are fast.
