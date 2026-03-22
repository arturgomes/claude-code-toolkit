# codebase-intelligence

Augments **prp-core** (Wirasm/PRPs-agentic-eng) with a persistent intelligence layer.

Install alongside prp-core. The commands here shadow `prp-core:prp-plan` and
`prp-core:prp-implement` with augmented versions that add memory, Jira context,
and two-tier search without removing any of the original logic.

---

## What changes in each command

### `prp-plan` augmentations

| Phase | Original | Added by codebase-intelligence |
|---|---|---|
| Pre-Phase I | — | Load `~/.claude/memory/{TICKET}/{BRANCH}.md` |
| Pre-Phase II | — | Fetch Jira ticket + acceptance criteria + QA failure comments |
| Phase 2 Step 2A | — | Memory pre-fill: skip re-searching areas already cached |
| Phase 2 Steps 2B | `codebase-explorer` + `codebase-analyst` agents | Unchanged |
| Phase 2 Step 2C | — | Serena symbol resolution + SocratiCode semantic enrichment |
| Phase 2 table | 5 columns | + `Source` column (memory/serena/socraticode/explorer/analyst) |
| Phase 6 plan | Standard sections | + `Intelligence Context` section (ticket, AC, QA, discovery sources) |
| Post-generation | — | Save planning session to task-memory |

### `prp-implement` augmentations

| Phase | Original | Added by codebase-intelligence |
|---|---|---|
| Pre-Phase | — | Load task-memory, restore prior task completion state |
| Phase 3.0 | — | Per-file memory cache check before implementation starts |
| Phase 3.1 | Read MIRROR file | + Check memory for prior findings on this file |
| Phase 3.4 | — | Save interim memory entry every 3 tasks |
| Phase 5.2 | Standard report | + Intelligence Summary section |
| Phase 5.5 | — | Final memory save with full implementation status |

---

## Components

| File | Type | Purpose |
|---|---|---|
| `commands/prp-plan.md` | Command | Shadows `prp-core:prp-plan` |
| `commands/prp-implement.md` | Command | Shadows `prp-core:prp-implement` |
| `skills/task-memory.md` | Skill | Cross-session memory in `~/.claude/memory/` |
| `skills/codebase-search.md` | Skill | Two-tier search: Serena (LSP) + SocratiCode (semantic) |
| `agents/codebase-researcher.md` | Agent | Standalone pre-planning research pass |

---

## MCP dependencies

### Serena — structural LSP search
```bash
docker pull ghcr.io/oraios/serena:latest

claude mcp add serena --transport stdio \
  -- docker run --rm -i --network host \
  -v ~/projects:/workspaces/projects \
  ghcr.io/oraios/serena:latest serena start-mcp-server --transport stdio
```

### SocratiCode — semantic vector search (zero config)
```bash
# Auto-manages its own Qdrant + Ollama Docker containers on first run
claude mcp add socraticode --transport stdio -- npx -y socraticode
```

Index your project once after install:
```
> Index this codebase
```

### Atlassian Jira — ticket context
```bash
echo -n "your-email@company.com:your-api-token" | base64

claude mcp add atlassian \
  --transport http https://mcp.atlassian.com/v1/mcp \
  --header "Authorization: Basic <base64-output>"
```

Get your API token: https://id.atlassian.com/manage-profile/security/api-tokens

---

## Install both plugins

```bash
# 1. Add prp-core marketplace
/plugin marketplace add Wirasm/PRPs-agentic-eng
/plugin install prp-core

# 2. Add codebase-intelligence marketplace
/plugin marketplace add arturgomes/claude-code-toolkit
/plugin install codebase-intelligence
```

Commands from `codebase-intelligence` shadow the same-named commands from `prp-core`.
Claude Code gives precedence to user-installed plugins in alphabetical order — if needed,
manage precedence via `/plugin` settings.

---

## Typical workflow

```
# New feature
/prp-plan "implement PDF export for invoices PROJ-421"
  → loads memory (none) → fetches Jira PROJ-421 → runs agents + Serena + SocratiCode
  → generates plan with Intelligence Context section
  → saves planning session to memory

/prp-implement .claude/PRPs/plans/pdf-export.plan.md
  → loads memory (1 session) → restores prior findings
  → implements tasks with per-file cache checks
  → saves every 3 tasks + final session

# QA failure 3 weeks later
/prp-plan "fix PROJ-421 QA failures"
  → loads memory (2 sessions: planning + implementation)
  → fetches Jira — finds QA rejection comment
  → resumes from exactly where implementation left off
  → no re-investigation needed
```

---

## Memory location

```
~/.claude/memory/
├── PROJ-421/
│   └── feature-pdf-export.md        ← planning + implementation sessions
└── PROJ-388/
    └── bugfix-auth-timeout.md
```

Add to global gitignore (run once):
```bash
echo ".memory/" >> ~/.gitignore_global
git config --global core.excludesfile ~/.gitignore_global
```
