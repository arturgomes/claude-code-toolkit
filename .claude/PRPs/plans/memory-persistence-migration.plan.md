# Implementation Plan: Memory Persistence Migration to memory-central

## Summary

Replace claude-code-toolkit's file-based memory persistence (task-memory skill) with memory-central's Obsidian vault structure, BM25 search, and Claude Code skills. Migrate from bash-based HEREDOC appends to structured markdown notes with frontmatter, full-text search, and vault-wide wikilinks.

---

## Intelligence Context

**Ticket**: MEMORY-MIGRATION
**Branch**: main
**Memory sessions loaded**: 0 (fresh session)

### Acceptance Criteria (authoritative — do not deviate from these)

1. All task-memory skill functionality is replaced with memory-central equivalents
2. Memory persistence uses memory-central's session/branch structure
3. Memory retrieval integrates with memory-central's recall mechanisms
4. No loss of existing memory data during migration
5. Documentation updated to reflect new memory-central approach

### QA Context (prior failures)
None — greenfield migration

### Hard boundaries (NOT in scope)

- **MemPalace integration** — Focus on vault-based memory only
- **codebase-memory-mcp** — Out of scope for this migration
- **Real-time indexing** — Batch indexing on session end is sufficient
- **Web UI** — CLI and skills only
- **Multi-user features** — Single-user local vault

### KB Principles applied

**KB Status**: Not consulted (migration task, no external patterns needed)

### Context7 Library Facts

Not applicable — No external library dependencies for this migration

### Prior session decisions

None — first planning session

### Discovery source summary

| Category | File:Line | Source |
|---|---|---|
| MEMORY_OPS | plugins/codebase-intelligence/skills/task-memory.md:16-96 | explorer |
| PLAN_MEMORY | plugins/codebase-intelligence/commands/prp-plan.md:51-88 | explorer |
| IMPLEMENT_MEMORY | plugins/codebase-intelligence/commands/prp-implement.md:40-78 | analyst |
| VAULT_STRUCTURE | memory-central/README.md:63-76 | analyst |
| SEARCH_CAPABILITY | memory-central/README.md:736-776 | analyst |
| SKILLS_AVAILABLE | memory-central/.claude/skills/*/SKILL.md | explorer |

---

## AC Traceability

Every AC must have ≥1 task. Every task must map to ≥1 AC.

| AC Item | Tasks |
|---|---|
| AC 1: Replace task-memory with memory-central | Task 1, Task 2, Task 3, Task 4, Task 5 |
| AC 2: Use session/branch structure | Task 6, Task 7 |
| AC 3: Integrate recall mechanisms | Task 8, Task 9 |
| AC 4: No data loss during migration | Task 10, Task 11 |
| AC 5: Update documentation | Task 12 |

---

## User Story

**As a** developer using codebase-intelligence plugin
**I want to** have session memory persisted to an Obsidian vault with full-text search
**So that** I can search past decisions, link related sessions, and access memory across devices via GDrive sync

---

## Problem Statement

Current situation (task-memory):
- **Flat file structure**: `~/.claude/memory/<TICKET>/<BRANCH>.md` with no search capability
- **Bash operations**: Direct cat/mkdir/ls commands, fragile and verbose
- **Limited recall**: Reads only last 3 sessions, no keyword search
- **No cross-referencing**: Sessions are isolated, no wikilinks between related work
- **Manual formatting**: HEREDOC appends prone to formatting errors

This leads to:
- Unable to search "What was the decision about auth?" across all sessions
- No way to link related features or tickets
- Cross-device sync requires manual file copying
- Token inefficiency from reading full session files

---

## Solution Statement

Migrate to **memory-central vault-based architecture**:

### Core Changes

1. **Vault Structure**: Replace flat files with Obsidian vault
   - Session notes in `~/Documents/Obsidian-Vault/02-Notes/Sessions/`
   - Ticket organization via frontmatter and tags
   - Wikilink support for cross-referencing

2. **Search Integration**: BM25 keyword indexing
   - SQLite FTS5 index in `~/.claude/memory/<TICKET>/session_index.db`
   - Keyword extraction from session content
   - Search via `search-cache` skill

3. **Skills-Based Operations**: Replace bash with Claude Code skills
   - `search-cache` — Search past sessions
   - `fetch-and-cache` — (Adapted for local session notes)
   - Custom `session-memory` skill for write operations

4. **Frontmatter-Based Metadata**: Structured session data
   ```yaml
   ---
   title: "Session: PROJ-421 / feature-pdf-export"
   ticket: PROJ-421
   branch: feature-pdf-export
   date: 2026-04-13
   type: session-memory
   phase: implementation
   keywords: [pdf, export, implementation, completed]
   tags: [#session, #PROJ-421, #implementation]
   ---
   ```

5. **Migration Path**: Preserve existing data
   - Migrate all `~/.claude/memory/**/*.md` files to vault
   - Convert HEREDOC format to frontmatter
   - Build FTS5 index from migrated content

---

## Metadata

**Type**: REFACTOR
**Complexity**: MEDIUM
**Affected Systems**:
- codebase-intelligence plugin (3 files)
- memory-central (add 1 skill)
- ~/.claude/memory/ (migration)

**Technology Stack**:
- Obsidian-compatible markdown
- SQLite FTS5 (via memory-central's web_cache pattern)
- Python 3.13+ (for indexing scripts)
- Bash (migration script)

**Dependencies**:
- Existing: codebase-intelligence plugin, memory-central repo
- New: None (reuse existing memory-central infrastructure)

---

## UX Design

### Before State (Current)

```
prp-plan starts
├─ Bash: git branch --show-current
├─ Bash: mkdir -p ~/.claude/memory/PROJ-421
├─ Bash: ls ~/.claude/memory/PROJ-421/feature.md
├─ If exists: cat ~/.claude/memory/PROJ-421/feature.md
├─ User sees: Last 3 sessions, manually formatted
└─ Bash: cat >> ~/.claude/memory/PROJ-421/feature.md <<'EOF'

Token cost: ~500 tokens (reading full file)
Search capability: NONE
Cross-device: Manual file copy
```

### After State (Proposed)

```
prp-plan starts
├─ Skill: session-memory (load)
├─ Query vault: ~/Documents/Obsidian-Vault/02-Notes/Sessions/PROJ-421-feature.md
├─ If exists: Read frontmatter + last session entry
├─ User sees: BM25-ranked relevant sessions (keyword search)
└─ Skill: session-memory (save with frontmatter)

Token cost: ~200 tokens (frontmatter + summary only)
Search capability: Full keyword search across all sessions
Cross-device: Automatic (GDrive sync already configured in memory-central)
```

### Interaction Changes

| Location | Before | After | User Impact |
|---|---|---|---|
| prp-plan:51-88 | Bash cat/mkdir | session-memory skill | Cleaner, no bash exposure |
| prp-implement:40-78 | Bash cat/ls | session-memory skill | Same as above |
| Memory recall | Read last 3 files | BM25 keyword search | Find "What was decision about X?" |
| Cross-reference | None | Wikilinks [[PROJ-421]] | Link related tickets/sessions |

---

## Mandatory Reading

**Research findings**:
1. `/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/skills/task-memory.md` — Current memory implementation
2. `/Users/artur/Documents/ai-tools/memory-central/README.md:736-888` — Web cache indexing pattern (model for session indexing)
3. `/Users/artur/Documents/ai-tools/memory-central/.claude/skills/search-cache/SKILL.md` — Search skill to adapt

**Key architectural constraints**:
- Obsidian vault path: `~/Documents/Obsidian-Vault/` (from memory-central config)
- Index storage: `~/.claude/memory/<TICKET>/session_index.db` (parallel to current structure)
- Skills location: `/Users/artur/Documents/ai-tools/memory-central/.claude/skills/`

---

## Patterns to Mirror

### From memory-central web_cache

**File**: `memory-central/web_fetcher/session.py` (inferred from README)
**Pattern**: BM25 keyword extraction + SQLite FTS5 indexing

```python
# Keyword extraction (from web cache pattern)
from rank_bm25 import BM25Okapi

def extract_keywords(content: str, top_n: int = 10) -> List[str]:
    """Extract top keywords using BM25"""
    # Split into tokens
    tokens = content.lower().split()
    # Build BM25 model
    bm25 = BM25Okapi([tokens])
    # Get top_n keywords by score
    scores = bm25.get_scores(tokens)
    top_keywords = sorted(zip(tokens, scores), key=lambda x: x[1], reverse=True)[:top_n]
    return [kw for kw, _ in top_keywords]

# SQLite FTS5 index
def index_session(vault_path, ticket, branch, content, keywords, tags):
    db_path = f"~/.claude/memory/{ticket}/session_index.db"
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS sessions USING fts5(
            title, content, keywords, tags, date
        )
    """)
    conn.execute("""
        INSERT INTO sessions (title, content, keywords, tags, date)
        VALUES (?, ?, ?, ?, ?)
    """, (f"{ticket}/{branch}", content, ",".join(keywords), ",".join(tags), datetime.now()))
    conn.commit()
```

**Rationale**: Proven pattern from web_cache, reuse for session indexing

### From codebase-intelligence task-memory

**File**: `plugins/codebase-intelligence/skills/task-memory.md:74-96`
**Pattern**: Structured session sections

```markdown
## Session: {ISO-8601 datetime}

### Investigated
- {file:line} — {one-line finding}

### Decisions
- {decision and rationale}

### Implementation status
- [x] {completed item}
- [ ] {pending item}

### QA / Failures
- {what failed — or "none"}

### Next steps
- {exact file:line to resume from}
```

**Rationale**: Keep existing structure, wrap in frontmatter

---

## Files to Change

### New Files to Create

1. **`/Users/artur/Documents/ai-tools/memory-central/.claude/skills/session-memory/SKILL.md`**
   - **Purpose**: Claude Code skill for session memory operations
   - **Changes**: Create skill that wraps vault operations (load/save sessions)

2. **`/Users/artur/Documents/ai-tools/memory-central/session_indexer.py`**
   - **Purpose**: Python script for BM25 indexing (model after web_cache)
   - **Changes**: Keyword extraction, SQLite FTS5 indexing for session notes

3. **`/Users/artur/Documents/ai-tools/memory-central/migrate-task-memory.sh`**
   - **Purpose**: One-time migration script
   - **Changes**: Migrate ~/.claude/memory/**/*.md to Obsidian vault

### Existing Files to Modify

4. **`/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/skills/task-memory.md`**
   - **Current**: Bash-based memory operations
   - **Change**: Deprecate and redirect to memory-central session-memory skill

5. **`/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/commands/prp-plan.md`**
   - **Current**: Lines 51-88 (Pre-Phase I: MEMORY) use bash cat/mkdir/ls
   - **Change**: Replace with session-memory skill invocation

6. **`/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/commands/prp-implement.md`**
   - **Current**: Lines 40-78 (Pre-Phase I: MEMORY) use bash cat/ls
   - **Change**: Replace with session-memory skill invocation

7. **`/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/README.md`**
   - **Current**: Documents task-memory skill
   - **Change**: Update to document session-memory (vault-based) approach

---

## NOT Building

**Explicitly out of scope**:

1. **MemPalace integration** — Already covered in unified-memory-intelligence-strategy, separate concern
2. **Real-time indexing** — Batch indexing on session end is sufficient
3. **Obsidian plugins** — Pure markdown/frontmatter, no plugin development
4. **Web UI for search** — CLI skills only
5. **Multi-vault support** — Single vault (`~/Documents/Obsidian-Vault/`)
6. **Custom search algorithm** — Use BM25 from rank_bm25 package as-is
7. **Migration rollback automation** — Manual rollback if needed (backup provided)
8. **Windows compatibility** — macOS/Linux bash scripts
9. **Mobile sync** — GDrive sync for desktop only
10. **Session analytics/dashboards** — Just storage and search

---

## Step-by-Step Implementation Tasks

### Phase 1: Setup and Preparation

**Task 1**: Create session-memory skill structure
- Directory: `/Users/artur/Documents/ai-tools/memory-central/.claude/skills/session-memory/`
- File: `SKILL.md` with load/save operations
- **Validation**: Skill file parses, skill loads in Claude Code session
- **Maps to AC**: 1, 2

**Task 2**: Create session indexer Python module
- File: `/Users/artur/Documents/ai-tools/memory-central/session_indexer.py`
- Functions: `extract_keywords()`, `index_session()`, `search_sessions()`
- **Validation**: `python3 session_indexer.py --test` passes
- **Maps to AC**: 1, 3

**Task 3**: Create migration script
- File: `/Users/artur/Documents/ai-tools/memory-central/migrate-task-memory.sh`
- Steps: Scan ~/.claude/memory/, convert to frontmatter, move to vault
- **Validation**: Dry-run on test data preserves all content
- **Maps to AC**: 4

### Phase 2: Migration Execution

**Task 4**: Backup existing memory
- Command: `tar -czf ~/.claude/memory-backup-$(date +%Y%m%d).tar.gz ~/.claude/memory/`
- **Validation**: Backup file created, readable
- **Maps to AC**: 4

**Task 5**: Run migration script
- Command: `./memory-central/migrate-task-memory.sh --execute`
- **Validation**: All files migrated, index built, no data loss
- **Maps to AC**: 4

**Task 6**: Create vault structure for sessions
- Path: `~/Documents/Obsidian-Vault/02-Notes/Sessions/`
- Template: Session note frontmatter template
- **Validation**: Directory exists, template note created
- **Maps to AC**: 2

### Phase 3: Integration

**Task 7**: Update prp-plan.md memory hooks
- File: `/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/commands/prp-plan.md`
- Lines: 51-88 (Pre-Phase I: MEMORY)
- Change: Replace bash with `Skill(session-memory)` for load/save
- **Validation**: prp-plan runs, loads/saves to vault correctly
- **Maps to AC**: 1, 2

**Task 8**: Update prp-implement.md memory hooks
- File: `/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/commands/prp-implement.md`
- Lines: 40-78, 459-498 (memory load/save)
- Change: Replace bash with `Skill(session-memory)`
- **Validation**: prp-implement runs, memory persists to vault
- **Maps to AC**: 1, 2

**Task 9**: Integrate search capability
- Adapt: `search-cache` skill for session search
- Hook: Add to prp-plan "If EXISTS" path (line 72)
- **Validation**: "Find decision about X" searches past sessions
- **Maps to AC**: 3

### Phase 4: Deprecation and Documentation

**Task 10**: Deprecate task-memory.md
- File: `/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/skills/task-memory.md`
- Change: Add deprecation notice, redirect to session-memory
- **Validation**: File warns users to use new skill
- **Maps to AC**: 1

**Task 11**: Verify no data loss
- Compare: ~/.claude/memory/ (backed up) vs vault sessions
- Script: `diff -r` or checksum comparison
- **Validation**: All session content present in vault
- **Maps to AC**: 4

**Task 12**: Update documentation
- File: `/Users/artur/Documents/ai-tools/claude-code-toolkit/plugins/codebase-intelligence/README.md`
- Add: Memory Persistence section (vault-based approach)
- Remove: task-memory documentation (mark deprecated)
- **Validation**: README renders correctly, links work
- **Maps to AC**: 5

---

## Testing Strategy

### Unit Testing

- **session_indexer.py**: Test keyword extraction, SQLite operations
- **session-memory skill**: Test load/save to vault
- **Migration script**: Test on synthetic data, verify output

### Integration Testing

- **End-to-end**: prp-plan → save session → prp-implement → load session
- **Search**: Populate vault, search for keywords, verify BM25 ranking
- **Cross-device**: Sync vault via GDrive (existing), verify access on second device

### Validation Commands

#### Level 1: Migration Verification
```bash
# Backup created
ls -lh ~/.claude/memory-backup-*.tar.gz

# All files migrated
diff <(ls ~/.claude/memory/**/*.md | wc -l) \
     <(ls ~/Documents/Obsidian-Vault/02-Notes/Sessions/*.md | wc -l)
```

#### Level 2: Skill Functionality
```bash
# session-memory skill loads
claude code --test-skill session-memory

# Indexer works
python3 ~/Documents/ai-tools/memory-central/session_indexer.py \
  --index ~/Documents/Obsidian-Vault/02-Notes/Sessions/
```

#### Level 3: Integration Test
```bash
# Run prp-plan with session-memory
cd ~/Documents/ai-tools/claude-code-toolkit
claude code /codebase-intelligence:prp-plan "Test feature"

# Verify session saved to vault
ls ~/Documents/Obsidian-Vault/02-Notes/Sessions/TEST-*.md
```

#### Level 4: Search Capability
```bash
# In Claude Code session:
# "Search past sessions for 'architecture decision'"
# Should call search-cache skill, return BM25-ranked results
```

#### Level 5: No Data Loss
```bash
# Compare content checksums
find ~/.claude/memory/ -name "*.md" -exec md5sum {} \; > /tmp/before.txt
find ~/Documents/Obsidian-Vault/02-Notes/Sessions/ -name "*.md" -exec md5sum {} \; > /tmp/after.txt
# Content should be present (checksums may differ due to frontmatter addition)
```

#### Level 6: Cross-Device Sync
```bash
# Device 1: Add session
# Device 1: sync-obsidian-gdrive.sh
# Device 2: sync-obsidian-gdrive.sh
# Device 2: Verify session appears in vault
```

---

## Acceptance Criteria Checklist

- [ ] **AC 1**: task-memory skill deprecated, session-memory skill operational
- [ ] **AC 2**: Sessions stored in `~/Documents/Obsidian-Vault/02-Notes/Sessions/` with frontmatter
- [ ] **AC 3**: BM25 search integrated, `search-cache` finds past sessions by keyword
- [ ] **AC 4**: All existing `~/.claude/memory/**/*.md` files migrated to vault with no data loss
- [ ] **AC 5**: README updated, task-memory marked deprecated, session-memory documented

---

## Completion Checklist

### Pre-Implementation
- [ ] Read task-memory.md implementation
- [ ] Read memory-central web_cache pattern
- [ ] Understand frontmatter structure
- [ ] Review BM25 keyword extraction approach

### Implementation
- [ ] All 12 tasks completed in order
- [ ] All validation commands pass
- [ ] Backup created before migration
- [ ] Migration script tested on sample data

### Testing
- [ ] All 6 validation levels pass
- [ ] No data loss confirmed via checksum/diff
- [ ] Search returns relevant results
- [ ] GDrive sync verified

### Documentation
- [ ] README updated with vault-based approach
- [ ] task-memory.md marked deprecated
- [ ] session-memory skill documented
- [ ] Migration guide provided

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Data loss during migration** | Low | High | Backup ~/.claude/memory/ before migration, dry-run test first |
| **Frontmatter parsing errors** | Medium | Medium | Validate YAML frontmatter with ruamel.yaml before writing |
| **Search returns no results** | Low | Medium | Verify index built correctly, test with known keywords |
| **GDrive sync conflicts** | Medium | Low | Document sync interval, users run manual sync if needed |
| **Skill not found in Claude Code** | Low | High | Verify skill SKILL.md format, check skill loads in session |
| **Bash script compatibility** | Low | Low | Test on macOS/Linux, provide manual steps for edge cases |
| **Session notes too large** | Low | Medium | Keep session entries concise (existing pattern), index only metadata |

---

## Notes

### Architecture Decision Records

**ADR-001**: Reuse memory-central vault vs new vault
- **Decision**: Use existing `~/Documents/Obsidian-Vault/` from memory-central
- **Rationale**: GDrive sync already configured, user already managing vault
- **Alternative Rejected**: New vault (`~/.claude/sessions/`) — fragmentation, duplicate sync setup

**ADR-002**: SQLite FTS5 vs Elasticsearch
- **Decision**: SQLite FTS5 (model after web_cache)
- **Rationale**: Lightweight, no server, proven in memory-central
- **Alternative Rejected**: Elasticsearch — overkill, requires server, complex setup

**ADR-003**: Deprecate vs delete task-memory.md
- **Decision**: Deprecate with notice, keep file
- **Rationale**: Users may have in-progress work, gradual transition safer
- **Alternative Rejected**: Delete immediately — breaks existing workflows

---

**Plan Created**: 2026-04-13
**Estimated Complexity**: MEDIUM (3-4 hours implementation + 1 hour testing)
**Estimated Token Savings**: 60% reduction in memory recall (500 → 200 tokens via frontmatter)
