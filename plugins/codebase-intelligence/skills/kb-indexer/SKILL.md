---
name: kb-indexer
description: >
  Ingest ebooks, PDFs, and documents into the KB (bookrag DB + kb-registry.yaml) for use by ask-kb/consult-kb.
  Trigger on "add this book to my KB", "extract principles from this PDF", "index this ebook".
version: 2.0.1
---

# kb-indexer

Extract structured, reusable knowledge from source materials (PDFs, EPUBs, text) into KB files
compatible with `ask-kb` and `consult-kb`.

## Workflow

### Step 1 — Identify the Source
Accept input as:
- **Uploaded file**: PDF or text file in context
- **File path**: User provides a path to a local file
- **Text paste**: User pastes content directly

Read the file skills if needed:
- For PDFs → use the `pdf` or `pdf-reading` skill
- For EPUBs → extract via bash (see below)
- For DOCX → use the `docx` skill

### Step 2 — Gather Metadata
Ask (or infer from content) if not provided:
1. **Title** and **Author** of the source
2. **Target KB domain**: Which knowledge base should this go into?
3. **Extraction focus**: Extract everything, or focus on specific topics?
4. **KB root path**: Where is the KB stored? (default: `~/kb/`)

### Step 3 — Extraction Pass
Read the source and extract using this priority framework:

**HIGH VALUE — always extract:**
- Named principles with rationale
- Decision frameworks (IF condition → DO action)
- Explicitly stated patterns and anti-patterns
- Trade-off analyses
- Non-obvious insights that contradict conventional wisdom

**MEDIUM VALUE — extract if concise:**
- Definitions of key terms
- Taxonomies and categorizations
- Process/methodology descriptions

**LOW VALUE — summarize only, don't extract verbatim:**
- Narrative examples and case studies (→ distill the principle they illustrate)
- Historical context
- Introductory/motivational content

### Step 4 — Write the KB File

Use the format from `references/kb-format.md`.

Output file path: `{kb_root}/{domain}/{kebab-case-title}.md`

Example: `~/kb/architecture/building-microservices.md`

### Step 5 — Update the Registry

Read the existing `kb-registry.yaml`. Find the matching KB by domain or create a new one.

Add the new source entry:
```yaml
- title: "[Book Title] - [Author]"
  file: "[domain]/[kebab-case-title].md"
  topics: [extracted list of topics covered]
```

Generate `topics` list from what was actually extracted — these drive KB selection in `ask-kb`/`consult-kb`.

### Step 6 — Report
Report: output path, registry update, topics list, what was skipped and why, 1-2 sample queries to verify extraction.

---

## EPUB Extraction

```bash
unzip -o book.epub -d /tmp/epub_extracted/
find /tmp/epub_extracted -name "*.html" -o -name "*.xhtml" | sort
python3 references/epub-extract.py /tmp/epub_extracted/path/to/chapter.xhtml
```

---

## Chunking Strategy

**One file per source per domain** is the default.
Split into multiple files when:
- Source covers 3+ distinct sub-domains
- Extracted content exceeds 400 lines
- Topics are so different that they'd rarely be loaded together

When splitting, create multiple registry entries pointing to each file:
```yaml
sources:
  - title: "DDIA - Storage & Retrieval"
    file: "architecture/ddia-storage.md"
    topics: [indexes, b-trees, lsm-trees, column storage]
  - title: "DDIA - Distributed Systems"
    file: "architecture/ddia-distributed.md"
    topics: [replication, partitioning, transactions, consensus]
```

---

## Quality Checklist Before Writing

Before writing the KB file, verify:
- [ ] Every principle has a "when to use" / "when NOT to use"
- [ ] Decision frameworks are actionable (IF/THEN form, not just descriptions)
- [ ] Quotes are exact and attributed with page/chapter reference
- [ ] Topics list covers what was actually extracted (drives KB selection)
- [ ] File is under 400 lines (split if needed)
- [ ] No copyrighted text reproduced verbatim beyond short quotes

---

