---
name: index-kb-domains
description: >
  Index and wikilink all KB domains in the Obsidian vault so the knowledge base
  is fully traceable. Creates Obsidian index notes connecting domains → books → core principles.
  Use when you want to rebuild or refresh the KB navigation layer after adding new books,
  or to ensure all KB books are reachable via Obsidian graph view.
  Trigger phrases: "index kb domains", "link kb domains", "rebuild kb index", "make kb traceable",
  "refresh kb navigation", "/index-kb-domains".
version: 1.0.0
---

# index-kb-domains

Builds a 4-hop wikilink navigation layer over the Obsidian KB:
`Knowledge Base Index → domains/index → domains/{domain}/index → {book}/01_core_principles`

Creates 9 notes + patches `Knowledge Base Index.md`. All writes use `mode: "overwrite"` for idempotency.
Re-running is safe — no duplication occurs.

## Workflow

### Step 1 — Read root registry

Determine KB_ROOT:
- If env var `KB_ROOT` is set → use it
- Otherwise → use vault-relative `05-Knowledge-Base` (full path: `~/Documents/Obsidian-Vault/05-Knowledge-Base`)

Read `{KB_ROOT}/kb-registry.yaml` with the Read tool.
If not found → tell user to run `/codebase-intelligence:add-pdf-to-kb` first or check KB_ROOT.

Extract for each entry in `knowledge_bases[]`:
- `id` — domain slug (e.g. `llm-engineering`)
- `name` — display name (e.g. `LLM Engineering`)
- `description` — domain summary (first 150 chars for tldr)
- `keywords[]` — topic tags
- `sources[]` — each with `{title, file, topics[]}`
  - `file` is KB_ROOT-relative path: `domains/{domain}/kb/{slug}/01_core_principles.md`
  - Vault-relative path = `05-Knowledge-Base/{file}`
  - Wikilink target = `05-Knowledge-Base/{file}` without `.md` suffix

Count total books: `N = sum of len(sources) across all domains`.

### Step 2 — Derive cross-domain topic map

For each source across all domains, collect its `topics[]`.
Build a dict: `topic → set of domain IDs`.
Retain only topics where `len(domain_ids) >= 2` → `shared_topics`.
Sort topics alphabetically.

### Step 3 — Write master library index

Call `mcp__ultimate-obsidian__create_or_update_note`:
```
filepath: "05-Knowledge-Base/domains/index.md"
mode: "overwrite"
```

Use this content template (substitute `{N}` with total book count, `{TODAY}` with current date YYYY-MM-DD):

```markdown
---
title: "KB Book Library"
type: kb-library
tldr: "Master index of all 7 KB domains and {N} books. Navigate to a domain to browse its books."
date_created: {TODAY}
date_modified: {TODAY}
book_count: {N}
domain_count: 7
tags: [kb, library, index]
---

# KB Book Library

_Indexed by `/index-kb-domains`. Re-run to refresh after adding books._

## Domains

| Domain | Books | Topics (sample) |
|--------|-------|-----------------|
{for each domain in knowledge_bases[]:
| [[05-Knowledge-Base/domains/{domain.id}/index\|{domain.name}]] | {len(domain.sources)} | {domain.keywords[0:5] joined ", "} |
}

**Total**: {N} books across 7 domains

## Cross-Domain Topics

See [[05-Knowledge-Base/concepts/kb-topics]] for topics spanning multiple domains.

## Related

- [[05-Knowledge-Base/Knowledge Base Index]] — full vault navigation
- [[05-Knowledge-Base/kb-registry.yaml]] — machine-readable registry
```

### Step 4 — Write 7 domain index notes

For each domain in `knowledge_bases[]`, call `mcp__ultimate-obsidian__create_or_update_note`:
```
filepath: "05-Knowledge-Base/domains/{domain.id}/index.md"
mode: "overwrite"
```

Sort `domain.sources` alphabetically by `title` before listing.

Use this content template:

```markdown
---
title: "{domain.name}"
type: kb-domain
domain: {domain.id}
book_count: {len(domain.sources)}
keywords: [{domain.keywords[0:10] joined with quotes and commas}]
tldr: "{domain.description first 120 chars}"
date_created: {TODAY}
date_modified: {TODAY}
tags: [kb, domain, {domain.id}]
---

# {domain.name}

_Part of [[05-Knowledge-Base/domains/index|KB Book Library]] · {len(domain.sources)} books_

{domain.description}

## Books

{for each source in domain.sources, sorted by title:
  derive {slug} = directory name from source.file (e.g. `domains/llm-engineering/kb/llmengineershandbook/01_core_principles.md` → slug dir = `domains/llm-engineering/kb/llmengineershandbook`)
  derive {book_base} = `05-Knowledge-Base/{slug dir}`
- [[{book_base}/01_core_principles\|{source.title}]] — _{source.topics[0:3] joined ", "}_
  [[{book_base}/README\|README]] · [[{book_base}/00_book_summary\|Summary]] · [[{book_base}/02_arguments\|Arguments]] · [[{book_base}/03_frameworks_models\|Frameworks]] · [[{book_base}/04_failure_modes\|Failure Modes]] · [[{book_base}/05_application_playbook\|Playbook]] · [[{book_base}/CLAUDE\|Claude]]
}

## Topics

{domain.keywords joined ", "}

## Cross-Domain Connections

See [[05-Knowledge-Base/concepts/kb-topics]] for topics shared with other domains.
```

**Wikilink construction**: `source.file` is KB_ROOT-relative (e.g. `domains/llm-engineering/kb/llmengineershandbook/01_core_principles.md`).
Full wikilink target = `05-Knowledge-Base/` + `source.file` with `.md` stripped.
Example: `[[05-Knowledge-Base/domains/llm-engineering/kb/llmengineershandbook/01_core_principles|LLM Engineer's Handbook]]`

### Step 5 — Write cross-domain topic map

Call `mcp__ultimate-obsidian__create_or_update_note`:
```
filepath: "05-Knowledge-Base/concepts/kb-topics.md"
mode: "overwrite"
```

Content template:

```markdown
---
title: "KB Cross-Domain Topic Map"
type: kb-topic-map
tldr: "Topics appearing in 2+ domains — entry points for cross-domain learning"
date_created: {TODAY}
date_modified: {TODAY}
tags: [kb, topics, cross-domain]
---

# KB Cross-Domain Topic Map

_Topics appearing in 2+ domains. Single-domain topics are in each domain's index._

{for each topic in shared_topics, sorted alphabetically:
## {topic}

{for each domain_id covering this topic, sorted:
- [[05-Knowledge-Base/domains/{domain_id}/index|{domain_name}]]
}

}
```

### Step 6 — Patch Knowledge Base Index.md

Read vault note `05-Knowledge-Base/Knowledge Base Index.md` using `mcp__ultimate-obsidian__read_note`.

**If `## Book Library` already exists in the content**:
Use `mcp__ultimate-obsidian__search_replace_in_note` to replace the existing Book Library section
with an updated version (same wikilinks, updated count).

**If `## Book Library` does NOT exist**:
Use `mcp__ultimate-obsidian__create_or_update_note` with `mode: "append"` to add:

```markdown

## Book Library

Browse all {N} books across 7 domains:

- [[05-Knowledge-Base/domains/index|KB Book Library]] — master index, all domains and books
- [[05-Knowledge-Base/concepts/kb-topics|Cross-Domain Topics]] — topics spanning multiple domains

```

### Step 7 — Report to user

Print a completion summary:

```
## /index-kb-domains Complete ✅

Created/updated:
- 05-Knowledge-Base/domains/index.md (master library, 7 domains, {N} books)
- domains/engineering-leadership/index.md ({N} books)
- domains/engineering-practices/index.md ({N} books)
- domains/functional-programming/index.md ({N} books)
- domains/llm-engineering/index.md ({N} books)
- domains/ml-data/index.md ({N} books)
- domains/software-architecture/index.md ({N} books)
- domains/software-craft/index.md ({N} books)
- 05-Knowledge-Base/concepts/kb-topics.md ({N} cross-domain topics)
Patched:
- 05-Knowledge-Base/Knowledge Base Index.md (+Book Library section)

Traceability chain:
  KBI → domains/index → domains/{domain}/index → {book}/01_core_principles

All {N} books now reachable via Obsidian graph view.
```

## Error Handling

**Registry not found**:
```
❌ kb-registry.yaml not found at {KB_ROOT}/kb-registry.yaml
Ensure KB_ROOT is set correctly (current: {KB_ROOT}) and the registry exists.
Run the KB setup if needed.
```

**Missing domain directory**:
Skip and warn — do not stop. Report skipped domains in Step 7.

**Note write failure**:
Report the specific filepath and error. Continue with remaining notes.

## Quality Checks

Before reporting complete, verify:
- [ ] `05-Knowledge-Base/domains/index.md` created (use `mcp__ultimate-obsidian__check_exists`)
- [ ] At least one domain note exists (spot-check `domains/llm-engineering/index.md`)
- [ ] `concepts/kb-topics.md` created
- [ ] KBI contains "Book Library" (use `mcp__ultimate-obsidian__grep_note`)
