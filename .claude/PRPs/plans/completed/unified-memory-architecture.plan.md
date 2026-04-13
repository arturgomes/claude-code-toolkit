# Implementation Plan: Unified Memory Architecture

## Intelligence Context

**Ticket**: MEMORY-MIGRATION
**Branch**: feature/memory-persistence-migration
**Memory sessions loaded**: none (fresh start)

### Acceptance Criteria (authoritative — do not deviate from these)

1. session-memory skill from memory-central is available in claude-code-toolkit plugin
2. session_indexer.py Python script is available and callable from skill
3. migrate-task-memory.sh script is available for one-time migration
4. prp-plan and prp-implement commands use session-memory skill instead of bash operations
5. task-memory skill is marked deprecated with clear migration path
6. Single source of truth: all memory operations use Obsidian vault approach

### QA Context (prior failures)

none

### Hard boundaries (NOT in scope)

- Modifying kb-skills directory (separate project)
- Changing Obsidian vault structure or location
- Implementing new memory features beyond what exists in memory-central
- Changing the Serena or SocratiCode integrations
- Modifying agent architectures

### Discovery source summary

| Category | File:Line | Source |
|---|---|---|
| NEW_SKILL | memory-central/.claude/skills/session-memory/SKILL.md:1-324 | explorer |
| PYTHON_INDEXER | memory-central/session_indexer.py:1-325 | explorer |
| MIGRATION_SCRIPT | memory-central/migrate-task-memory.sh:1-165 | explorer |
| OLD_SKILL | plugins/codebase-intelligence/skills/task-memory.md:1-149 | explorer |
| PRP_PLAN_CMD | plugins/codebase-intelligence/commands/prp-plan.md:35-233 | analyst |
| PRP_IMPL_CMD | plugins/codebase-intelligence/commands/prp-implement.md:1-* | analyst |

---

## Summary

**Problem**: Memory management is split across two repositories (memory-central and claude-code-toolkit), causing maintenance overhead and confusion. memory-central has a superior vault-based session-memory implementation with BM25 search, but claude-code-toolkit still uses legacy bash-based task-memory operations.

**Solution**: Migrate session-memory skill, Python indexer, and migration script from memory-central into claude-code-toolkit as a marketplace plugin. Update prp-* commands to use the session-memory skill. Deprecate task-memory with clear migration instructions.

**Impact**: Single source of truth for memory operations, better search capabilities, Obsidian integration, cross-device sync.

---

## User Story

```
As a developer using codebase-intelligence workflows
I want session memory to use the vault-based architecture with BM25 search
So that I have a single, searchable, cross-device-synced memory system
```

---

## Problem Statement

The current memory implementation is fragmented:
- `claude-code-toolkit/plugins/codebase-intelligence/skills/task-memory.md` uses legacy bash operations (`cat`, `mkdir`, `ls`)
- `memory-central/.claude/skills/session-memory/SKILL.md` provides vault-based storage with frontmatter, wikilinks, and BM25 search
- prp-plan.md and prp-implement.md commands hard-code bash memory operations
- No Python tooling available in claude-code-toolkit for keyword extraction or search
- Users must manually manage two separate implementations

This creates:
- Duplication of memory logic
- Inconsistent memory access patterns
- No search capability in toolkit commands
- Manual migration burden for users

---

## Solution Statement

1. **Copy session-memory skill** from memory-central to `claude-code-toolkit/plugins/codebase-intelligence/skills/`
2. **Copy session_indexer.py** from memory-central to `claude-code-toolkit/plugins/codebase-intelligence/tools/`
3. **Copy migrate-task-memory.sh** from memory-central to `claude-code-intelligence/plugins/codebase-intelligence/tools/`
4. **Update prp-plan.md** to replace bash memory operations with `Skill(session-memory)` invocations
5. **Update prp-implement.md** to replace bash memory operations with `Skill(session-memory)` invocations
6. **Mark task-memory.md as deprecated** with migration notice
7. **Update README.md** to document the unified architecture

---

## Metadata

- **Complexity**: MEDIUM
- **Estimated effort**: 2-3 hours (file copies + command updates)
- **Risk level**: LOW (additive changes, existing backup in memory-central)
- **Dependencies**: Python 3.13+, rank_bm25 package, Obsidian vault at `~/Documents/Obsidian-Vault/`

---

## UX Design

### Before: Fragmented memory (current state)

```
claude-code-toolkit/
└── plugins/codebase-intelligence/
    ├── skills/task-memory.md          ← bash-based, no search
    └── commands/
        ├── prp-plan.md                ← hardcoded bash: mkdir, cat, ls
        └── prp-implement.md           ← hardcoded bash: cat >>

memory-central/
└── .claude/skills/session-memory/
    └── SKILL.md                       ← vault-based, BM25 search
└── session_indexer.py                 ← Python BM25 search tool
└── migrate-task-memory.sh             ← migration automation
```

**User pain points**:
- Must manually sync implementations
- No search in toolkit commands
- Bash operations not token-efficient
- No frontmatter metadata
- No cross-device sync

### After: Unified memory (target state)

```
claude-code-toolkit/
└── plugins/codebase-intelligence/
    ├── skills/
    │   ├── session-memory.md          ← NEW: vault-based with BM25 search
    │   └── task-memory.md             ← DEPRECATED: migration notice only
    ├── tools/
    │   ├── session_indexer.py         ← NEW: BM25 keyword + FTS5 search
    │   └── migrate-task-memory.sh     ← NEW: one-time migration script
    └── commands/
        ├── prp-plan.md                ← UPDATED: uses Skill(session-memory)
        └── prp-implement.md           ← UPDATED: uses Skill(session-memory)

memory-central/  (unchanged, kept for development)
```

**User benefits**:
- Single source of truth
- BM25 keyword search across all sessions
- Obsidian vault integration (wikilinks, frontmatter)
- Token-efficient operations (Python skill vs bash)
- Cross-device GDrive sync
- One-time migration with backup

### Data Flow

**SESSION START** (prp-plan or prp-implement):
```
User → /prp-plan {feature} → Command invokes Skill(session-memory)
                           → Skill runs bash: git branch --show-current
                           → Extract TICKET from branch or arg
                           → Check ~/Documents/Obsidian-Vault/02-Notes/Sessions/{TICKET}-{BRANCH}.md
                           → If exists: load frontmatter + last session (50 lines)
                           → If new: create with frontmatter template
                           → Return context to command
```

**SESSION END** (prp-plan or prp-implement):
```
Command → Append session entry to vault file
       → Run: python3 .../session_indexer.py --extract-keywords {vault_file}
       → Run: python3 .../session_indexer.py --index-session {vault_file}
       → Update frontmatter keywords: []
       → Build/update ~/.claude/memory/{TICKET}/session_index.db (FTS5)
```

**SEARCH SESSIONS**:
```
User → "Search sessions for authentication"
    → Skill(session-memory) with --search flag
    → python3 .../session_indexer.py --search "authentication" --ticket all --limit 5
    → Query FTS5 indices across all tickets
    → Return top 5 BM25-ranked results with wikilinks
```

---

## Mandatory Reading

Before implementation, read these files in full:

1. `/Users/artur/Documents/ai-tools/memory-central/.claude/skills/session-memory/SKILL.md`
   **Why**: Complete specification of new memory protocol

2. `/Users/artur/Documents/ai-tools/memory-central/session_indexer.py`
   **Why**: Python implementation of BM25 and FTS5 indexing

3. `/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/commands/prp-plan.md:35-233`
   **Why**: Current bash memory operations to be replaced

4. `/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/skills/task-memory.md`
   **Why**: Current skill to be deprecated

---

## Patterns to Mirror

### 1. Skill invocation pattern (from prp-plan.md existing patterns)

**Location**: `plugins/codebase-intelligence/commands/prp-plan.md:150-155`

**Pattern**:
```markdown
Follow skill: `codebase-intelligence:drift-guard` → The Anchor Document.
```

**Apply to**: Replace bash memory operations with skill invocations

**New pattern**:
```markdown
Follow skill: `codebase-intelligence:session-memory` → SESSION START protocol
```

### 2. Python tool invocation pattern (from session-memory SKILL.md)

**Location**: `memory-central/.claude/skills/session-memory/SKILL.md:122-128`

**Pattern**:
```bash
# 3. Extract keywords and update frontmatter
python3 ~/Documents/ai-tools/memory-central/session_indexer.py \
  --extract-keywords "$VAULT_PATH"

# 4. Index session for BM25 search
python3 ~/Documents/ai-tools/memory-central/session_indexer.py \
  --index-session "$VAULT_PATH"
```

**Apply to**: Update path to use toolkit location

**New pattern**:
```bash
python3 /Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/tools/session_indexer.py \
  --extract-keywords "$VAULT_PATH"
```

### 3. Deprecation notice pattern (from prp-core README examples)

**Pattern**:
```markdown
> **⚠️ DEPRECATED**
> This skill has been replaced by `session-memory`.
>
> **Migration**: Run migration script once:
> ```bash
> ~/path/to/migrate-task-memory.sh --execute
> ```
>
> **Use instead**: Invoke `Skill(session-memory)` for all memory operations.
```

**Apply to**: `plugins/codebase-intelligence/skills/task-memory.md:1-10`

---

## Files to Change

| File | Action | Lines | Reason |
|---|---|---|---|
| `plugins/codebase-intelligence/skills/session-memory.md` | CREATE | ~350 | Copy from memory-central, update tool paths |
| `plugins/codebase-intelligence/tools/session_indexer.py` | CREATE | ~325 | Copy from memory-central, no changes needed |
| `plugins/codebase-intelligence/tools/migrate-task-memory.sh` | CREATE | ~165 | Copy from memory-central, update INDEXER path |
| `plugins/codebase-intelligence/skills/task-memory.md` | EDIT | 1-27 | Add deprecation notice, remove implementation |
| `plugins/codebase-intelligence/commands/prp-plan.md` | EDIT | 35-55, 222-243 | Replace bash memory ops with Skill(session-memory) |
| `plugins/codebase-intelligence/commands/prp-implement.md` | EDIT | Memory sections | Replace bash memory ops with Skill(session-memory) |
| `plugins/codebase-intelligence/README.md` | EDIT | Memory section | Document unified architecture + migration |

---

## NOT Building

- ❌ New memory features beyond what exists in memory-central
- ❌ Changes to Obsidian vault location or structure
- ❌ Integration with kb-skills directory
- ❌ Alternative memory backends (SQLite-only, S3, etc.)
- ❌ Memory sync logic (GDrive sync lives in memory-central)
- ❌ Migration from Serena memory to session-memory (different systems)
- ❌ Automatic migration trigger (manual script execution only)

---

## Step-by-Step Tasks

### Task 1: Create tools directory and copy Python indexer

**What**: Copy `session_indexer.py` from memory-central to toolkit

**Steps**:
```bash
cd /Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence
mkdir -p tools
cp /Users/artur/Documents/ai-tools/memory-central/session_indexer.py tools/
chmod +x tools/session_indexer.py
```

**Validation**:
```bash
python3 tools/session_indexer.py --test
# Expected: "✅ All tests passed!"
```

**AC mapping**: AC #2

---

### Task 2: Copy migration script and update paths

**What**: Copy `migrate-task-memory.sh` to toolkit and update INDEXER path

**Steps**:
```bash
cp /Users/artur/Documents/ai-tools/memory-central/migrate-task-memory.sh tools/
chmod +x tools/migrate-task-memory.sh
```

**Edit**: `tools/migrate-task-memory.sh:17`
```bash
# OLD:
INDEXER="$HOME/Documents/ai-tools/memory-central/session_indexer.py"

# NEW:
INDEXER="$(dirname "$0")/session_indexer.py"
```

**Validation**:
```bash
tools/migrate-task-memory.sh --dry-run
# Expected: "🔍 DRY RUN MODE — No changes will be made"
```

**AC mapping**: AC #3

---

### Task 3: Copy session-memory skill and update tool paths

**What**: Copy `session-memory/SKILL.md` from memory-central to toolkit

**Steps**:
```bash
mkdir -p skills
cp /Users/artur/Documents/ai-tools/memory-central/.claude/skills/session-memory/SKILL.md \
   skills/session-memory.md
```

**Edit**: `skills/session-memory.md:122-128, 148-151, 224`

Replace all instances of:
```bash
# OLD:
python3 ~/Documents/ai-tools/memory-central/session_indexer.py

# NEW:
python3 /Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/tools/session_indexer.py
```

Replace:
```bash
# OLD (line 224):
~/Documents/ai-tools/memory-central/migrate-task-memory.sh --execute

# NEW:
/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/tools/migrate-task-memory.sh --execute
```

**Validation**:
```bash
grep -n "memory-central" skills/session-memory.md
# Expected: No matches (all paths updated to toolkit)
```

**AC mapping**: AC #1

---

### Task 4: Deprecate task-memory skill

**What**: Replace task-memory.md content with deprecation notice

**Edit**: `skills/task-memory.md`

Replace entire file with:
```markdown
---
name: task-memory
description: >
  **DEPRECATED** - Use session-memory instead.
  Legacy file-based memory persistence. Replaced by Obsidian vault-based session-memory
  with frontmatter, BM25 search, and FTS5 indexing.
user-invocable: false
---

# task-memory

> **⚠️ DEPRECATED**
> This skill has been replaced by `session-memory`.
>
> **Migration**: All existing memory files can be migrated to the Obsidian vault:
> - Old: `~/.claude/memory/<TICKET>/<BRANCH>.md`
> - New: `~/Documents/Obsidian-Vault/02-Notes/Sessions/<TICKET>-<BRANCH>.md`
>
> **Run migration once**:
> ```bash
> /Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/tools/migrate-task-memory.sh --execute
> ```
>
> **New features**:
> - Frontmatter metadata (ticket, branch, date, phase, keywords, tags)
> - BM25 keyword-based search via FTS5 index
> - Vault-wide wikilinks and cross-referencing
> - GDrive sync for cross-device access (via memory-central)
>
> **Use instead**: Invoke `Skill(codebase-intelligence:session-memory)` for all memory operations.
>
> See: `plugins/codebase-intelligence/skills/session-memory.md`

---

## Legacy Documentation (for reference only)

[Keep existing content from line 31 onward for reference]
```

**Validation**:
```bash
head -30 skills/task-memory.md | grep "DEPRECATED"
# Expected: Match found
```

**AC mapping**: AC #5

---

### Task 5: Update prp-plan.md to use session-memory skill

**What**: Replace bash memory operations with skill invocations

**Edit**: `commands/prp-plan.md:35-55` (Pre-Phase I: MEMORY section)

Replace:
```markdown
# OLD:
```bash
# 2. Ensure memory directory exists
mkdir -p ~/.claude/memory/{TICKET}

# 3. Check for prior session
ls ~/.claude/memory/{TICKET}/{BRANCH}.md 2>/dev/null && echo "EXISTS" || echo "NEW"
```

**If EXISTS — load it:**
```bash
cat ~/.claude/memory/{TICKET}/{BRANCH}.md
```
```

With:
```markdown
# NEW:
Follow skill: `codebase-intelligence:session-memory` → SESSION START protocol.

The skill will:
- Extract TICKET from branch name or user args
- Check `~/Documents/Obsidian-Vault/02-Notes/Sessions/{TICKET}-{BRANCH}.md`
- If exists: load frontmatter + last session (token-efficient)
- If new: create with frontmatter template
- Report: "📂 Memory loaded for {TICKET}" or "🆕 No prior memory for {TICKET}"
```

**Edit**: `commands/prp-plan.md:222-243` (Post-Phase: SAVE section)

Replace:
```markdown
# OLD:
Execute NOW — append session entry to `~/.claude/memory/{TICKET}/{BRANCH}.md`:

```bash
cat >> ~/.claude/memory/{TICKET}/{BRANCH}.md << 'MEMEOF'
```
```

With:
```markdown
# NEW:
Execute NOW — use session-memory skill SESSION END protocol:

Follow skill: `codebase-intelligence:session-memory` → SESSION END protocol.

The skill will:
- Append session entry to vault file with structure:
  ```markdown
  ## Session: {ISO date}
  ### Investigated
  {file:line findings}
  ### Decisions
  {APPROACH_CHOSEN, scope exclusions}
  ### KB findings
  {violations, tensions, principles}
  ### Context7 findings
  {confirmed library signatures}
  ### Implementation status
  - [ ] Plan: .claude/PRPs/plans/{feature}.plan.md
  ### Next steps
  - /codebase-intelligence:prp-implement .claude/PRPs/plans/{feature}.plan.md
  ```
- Run: `session_indexer.py --extract-keywords` to update frontmatter keywords
- Run: `session_indexer.py --index-session` to build FTS5 index
```

**Validation**:
```bash
grep -n "mkdir -p ~/.claude/memory" commands/prp-plan.md
# Expected: No matches

grep -n "Skill(codebase-intelligence:session-memory)" commands/prp-plan.md
# Expected: 2+ matches (SESSION START + SESSION END)
```

**AC mapping**: AC #4

---

### Task 6: Update prp-implement.md to use session-memory skill

**What**: Replace bash memory operations in implementation workflow

**Edit**: `commands/prp-implement.md` (search for all memory operations)

Find and replace all instances of bash memory operations:

```bash
# Find memory-related sections
grep -n "~/.claude/memory" commands/prp-implement.md
```

For each match:
1. **Memory load sections** → Replace with: `Follow skill: codebase-intelligence:session-memory → SESSION START`
2. **Memory save sections** → Replace with: `Follow skill: codebase-intelligence:session-memory → SESSION END`

**Validation**:
```bash
grep -n "cat.*memory" commands/prp-implement.md
# Expected: No matches

grep -n "session-memory" commands/prp-implement.md
# Expected: 2+ matches
```

**AC mapping**: AC #4

---

### Task 7: Update README.md to document unified architecture

**What**: Add section explaining memory architecture and migration

**Edit**: `README.md` (find memory-related section or add new section)

Add after existing memory documentation:

```markdown
## Memory Architecture

**IMPORTANT**: As of v2.0, codebase-intelligence uses **vault-based session-memory** for all memory operations.

### Storage Location

```
~/Documents/Obsidian-Vault/02-Notes/Sessions/<TICKET>-<BRANCH>.md
```

Each session file contains:
- **Frontmatter**: ticket, branch, date, phase, keywords (auto-extracted), tags
- **Wikilinks**: `[[TICKET-BRANCH]]` for cross-referencing
- **BM25 Search**: Full-text search via SQLite FTS5 index

### Search Capability

```bash
python3 plugins/codebase-intelligence/tools/session_indexer.py \
  --search "authentication" \
  --limit 5
```

Returns top 5 BM25-ranked sessions across all tickets.

### Migration from Old task-memory

If you have existing memory in `~/.claude/memory/`:

```bash
# Backup is automatic — run once:
plugins/codebase-intelligence/tools/migrate-task-memory.sh --execute

# This will:
# 1. Backup ~/.claude/memory/ to tarball
# 2. Convert each TICKET/BRANCH.md to vault format with frontmatter
# 3. Move to ~/Documents/Obsidian-Vault/02-Notes/Sessions/
# 4. Build FTS5 index for all migrated sessions
# 5. Preserve all existing data (zero data loss)
```

### Commands Using Session Memory

- `/prp-plan` — Loads memory at start, saves at end with keyword extraction
- `/prp-implement` — Loads memory, saves progress every 3 tasks
- Agents (`codebase-explorer`, `codebase-analyst`) — Read memory for context pre-fill

### Dependencies

- **Obsidian vault**: `~/Documents/Obsidian-Vault/` (must exist)
- **Python 3.13+**: For keyword extraction and indexing
- **rank_bm25**: `pip install rank-bm25` (for BM25 scoring)

---
```

**Validation**:
```bash
grep -n "vault-based session-memory" README.md
# Expected: Match in new section

grep -n "migrate-task-memory.sh" README.md
# Expected: Match with --execute example
```

**AC mapping**: AC #6

---

## AC Traceability

Every AC must have ≥1 task. Every task must map to ≥1 AC.

| AC Item | Tasks |
|---|---|
| AC #1: session-memory skill available in toolkit | Task 3 |
| AC #2: session_indexer.py available and callable | Task 1 |
| AC #3: migrate-task-memory.sh available | Task 2 |
| AC #4: prp-* commands use session-memory skill | Task 5, Task 6 |
| AC #5: task-memory deprecated with migration path | Task 4 |
| AC #6: Single source of truth documentation | Task 7 |

---

## Testing Strategy

### Level 1: Syntax validation (file operations)
```bash
# Test tool copies
python3 plugins/codebase-intelligence/tools/session_indexer.py --test
# Expected: ✅ All tests passed!

bash plugins/codebase-intelligence/tools/migrate-task-memory.sh --dry-run
# Expected: 🔍 DRY RUN MODE message
```

### Level 2: Integration validation (skill invocation)
```bash
# Test skill is loadable
grep "^name: session-memory" plugins/codebase-intelligence/skills/session-memory.md
# Expected: Match

# Test no memory-central paths remain
grep -r "memory-central" plugins/codebase-intelligence/skills/session-memory.md
# Expected: No matches
```

### Level 3: Command validation (prp-* updates)
```bash
# Test prp-plan has skill invocations, not bash
grep "mkdir -p ~/.claude/memory" plugins/codebase-intelligence/commands/prp-plan.md
# Expected: No matches

grep "session-memory" plugins/codebase-intelligence/commands/prp-plan.md
# Expected: 2+ matches (SESSION START + END)
```

### Level 4: End-to-end (manual test)
```bash
# 1. From claude-code-toolkit repo root, run:
cd /Users/artur/Documents/ai-tools/claude-code-toolkit

# 2. Invoke prp-plan via SlashCommand tool
# Expected: Uses session-memory skill, creates vault file with frontmatter

# 3. Check vault file created
ls ~/Documents/Obsidian-Vault/02-Notes/Sessions/*.md
# Expected: New file with TICKET-BRANCH.md format

# 4. Check frontmatter present
head -20 ~/Documents/Obsidian-Vault/02-Notes/Sessions/*.md | grep "keywords:"
# Expected: Match (keywords: [...])

# 5. Test search
python3 plugins/codebase-intelligence/tools/session_indexer.py \
  --search "test" --limit 1
# Expected: Returns test session if indexed
```

### Level 5: Migration validation
```bash
# Create test old memory file
mkdir -p ~/.claude/memory/TEST-123
echo "# Memory: TEST-123 / test-branch" > ~/.claude/memory/TEST-123/test-branch.md

# Run migration (dry-run)
plugins/codebase-intelligence/tools/migrate-task-memory.sh --dry-run
# Expected: "Would create: ~/Documents/Obsidian-Vault/02-Notes/Sessions/TEST-123-test-branch.md"

# Run migration (execute)
plugins/codebase-intelligence/tools/migrate-task-memory.sh --execute
# Expected: "✅ Migration complete!" + backup tarball created

# Verify migrated file has frontmatter
head -15 ~/Documents/Obsidian-Vault/02-Notes/Sessions/TEST-123-test-branch.md
# Expected: YAML frontmatter block with ticket, branch, date, keywords
```

### Level 6: Regression validation
```bash
# Verify task-memory skill shows deprecation notice
head -10 plugins/codebase-intelligence/skills/task-memory.md | grep "DEPRECATED"
# Expected: Match

# Verify README documents new architecture
grep "vault-based session-memory" plugins/codebase-intelligence/README.md
# Expected: Match
```

---

## Validation Commands

**Level 1 (Syntax)**:
```bash
python3 plugins/codebase-intelligence/tools/session_indexer.py --test
bash plugins/codebase-intelligence/tools/migrate-task-memory.sh --dry-run
```

**Level 2 (Integration)**:
```bash
grep "^name: session-memory" plugins/codebase-intelligence/skills/session-memory.md
grep -r "memory-central" plugins/codebase-intelligence/skills/session-memory.md
```

**Level 3 (Commands)**:
```bash
grep "mkdir -p ~/.claude/memory" plugins/codebase-intelligence/commands/prp-plan.md
grep "session-memory" plugins/codebase-intelligence/commands/prp-plan.md
```

**Level 4 (E2E)**: Manual prp-plan invocation test (see Level 4 above)

**Level 5 (Migration)**: Migration script test with test data (see Level 5 above)

**Level 6 (Regression)**:
```bash
head -10 plugins/codebase-intelligence/skills/task-memory.md | grep "DEPRECATED"
grep "vault-based session-memory" plugins/codebase-intelligence/README.md
```

---

## Completion Checklist

- [ ] Level 1 tests passing (syntax)
- [ ] Level 2 tests passing (integration)
- [ ] Level 3 tests passing (commands)
- [ ] Level 4 tests passing (E2E manual)
- [ ] Level 5 tests passing (migration)
- [ ] Level 6 tests passing (regression)
- [ ] All 7 tasks completed
- [ ] All 6 ACs mapped to tasks
- [ ] No orphan tasks (all map to ≥1 AC)
- [ ] README updated with migration instructions
- [ ] task-memory.md has deprecation notice
- [ ] No references to memory-central paths in toolkit files
- [ ] session_indexer.py --test passes
- [ ] migrate-task-memory.sh --dry-run executes without error

---

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| Python rank_bm25 not installed | Search fails | MEDIUM | Document in README, graceful fallback in session_indexer.py (exists) |
| Obsidian vault doesn't exist | Skill fails to create files | MEDIUM | Document prerequisite in README, skill should create directory |
| Path differences break tool invocations | Commands fail to find tools | LOW | Use absolute paths in skill, validate in testing |
| Users have uncommitted ~/.claude/memory files | Data loss during migration | HIGH | Migration script creates backup tarball FIRST (implemented) |
| prp-* commands break existing workflows | User frustration | MEDIUM | Keep skill invocation minimal, no behavior changes |
| Task-memory skill still invoked somewhere | Inconsistent memory | LOW | Mark user-invocable: false, add deprecation notice |

**Mitigation actions**:
1. ✅ Migration script backs up before any changes (line 57-62)
2. ✅ session_indexer.py has fallback when rank_bm25 unavailable (line 42-49)
3. Document vault prerequisite in README (Task 7)
4. Use absolute paths in session-memory.md (Task 3)
5. Extensive testing at all 6 levels before declaring complete

---

## Next Steps After Implementation

1. **Test migration**: Run migration on actual ~/.claude/memory/ data with --dry-run first
2. **Verify search**: Test `--search` with real session data
3. **Update prp-core**: If this becomes a pattern, consider upstreaming to prp-core
4. **Document in kb-skills**: Add memory architecture to personal KB
5. **Create PR**: Use `/prp-pr` to create pull request (follow 3-commit strategy from user request)
