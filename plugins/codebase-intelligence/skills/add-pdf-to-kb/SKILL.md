---
name: add-pdf-to-kb
description: >
  Ingest PDF or EPUB ebooks into your knowledge base using the bookrag pipeline. Indexes content
  into a domain-specific bookrag.db (queryable via ask-kb) and creates an Obsidian vault reference
  note. Use when the user wants to add a book to their KB, process a PDF/EPUB, or expand their
  knowledge base with new sources.
  Trigger phrases: "add this PDF to my KB", "ingest this book", "process this ebook",
  "add to knowledge base", "index this PDF", "import this book into KB".
---

> **bookrag engine path** — This skill runs the local `bookrag` engine. Resolve its path ONCE at
> the start of a run, note the printed value, and substitute it wherever `$BOOKRAG_HOME` appears
> below. This bootstraps a pinned, patched bookrag on first use (public base fetched from source +
> your own patches) — no `~/Documents` path required:
>
> ```bash
> bash "$(find ~/.claude -type f -path '*codebase-intelligence/scripts/bookrag-home.sh' 2>/dev/null | head -1)"
> ```


# add-pdf-to-kb

Automated workflow for ingesting PDF/EPUB ebooks into your knowledge base via the bookrag pipeline.
Indexes content into a domain-specific `bookrag.db` (queryable via `ask-kb`) and creates an
Obsidian vault reference note.

## Workflow

### Step 1 — Locate the Source File

Accept input as:
- **File path provided by user**: `~/Downloads/book.pdf`
- **Uploaded file**: File available in conversation context
- **Current directory search**: Ask user for filename if ambiguous

Verify the file exists and is a supported format (`.pdf` or `.epub`).

### Step 2 — Gather Metadata and Choose Domain

1. **Gather book metadata** (infer from filename or PDF metadata):
   - Title, Author

2. **Generate book slug**: `{title-slug}` (kebab-case, lowercase, no special chars)

3. **Choose bookrag domain** — ask user or infer from content:

   Available domains (standard):
   - `engineering-practices` — code quality, testing, refactoring, clean code
   - `software-architecture` — system design, distributed systems, microservices
   - `engineering-leadership` — engineering management, org design, strategy
   - `llm-engineering` — LLM applications, RAG, prompt engineering, AI systems
   - `software-craft` — software craftsmanship, TDD, XP, agile practices
   - `functional-programming` — FP concepts, category theory, type systems
   - `ml-data` — machine learning, data engineering, ML systems

   If domain doesn't exist yet, register it first:
   ```bash
   uv run --directory $BOOKRAG_HOME \
     bookrag domain-create {domain-name} \
     --display-name "{display name}" \
     --keywords "{comma,separated,keywords}" \
     --description "{brief description}" \
     --settings ~/Documents/Obsidian-Vault/05-Knowledge-Base/config/settings.toml
   ```

4. **Confirm with user**: "Adding '{title}' by {author} to domain '{domain}'. Proceed?"

### Step 3 — Run bookrag build

```bash
uv run --directory $BOOKRAG_HOME \
  bookrag build \
  --input "{input_file}" \
  --domain "{domain}" \
  --name "{book-slug}" \
  --settings ~/Documents/Obsidian-Vault/05-Knowledge-Base/config/settings.toml
```

This runs the full pipeline:
- **Stage 1**: Convert PDF/EPUB → clean markdown (uses pymupdf4llm)
- **Stage 2**: Structure markdown → 9-file KB (summary, principles, arguments, frameworks, failure modes, playbook, claim index) via Claude API — requires `ANTHROPIC_API_KEY`
- **Stage 3**: Index KB → SQLite (`bookrag.db`) + ChromaDB + BM25 sparse index

Output lands in: `~/Documents/Obsidian-Vault/05-Knowledge-Base/domains/{domain}/`
- `bookrag.db` — main search index
- `kb/{book-slug}/` — structured KB files
- `markdown/{book-slug}/` — intermediate markdown
- `books.yaml` — updated with new book entry

**Monitor output for:**
- Title and author extracted ✅
- Stage completion messages (convert → structure → index)
- Any warnings about content quality

**Handle failures:**
- `ANTHROPIC_API_KEY` not set → set it: `export ANTHROPIC_API_KEY=...`
- Low heading count → PDF may be image-based: use OCR first (`ocrmypdf input.pdf output.pdf`)
- Domain not found → register domain first (Step 2)
- `uv` not installed → `pip install uv` or `brew install uv`

**Skip structure (faster, lower quality):**
```bash
uv run --directory $BOOKRAG_HOME \
  bookrag build \
  --input "{input_file}" \
  --domain "{domain}" \
  --name "{book-slug}" \
  --skip-structure \
  --settings ~/Documents/Obsidian-Vault/05-Knowledge-Base/config/settings.toml
```
Use `--skip-structure` for large books or when Claude API is unavailable. Content will be indexed
as raw chunks (no principle extraction, no claim analysis).

### Step 4 — Verify Indexing

```bash
# Check books.yaml was updated
cat ~/Documents/Obsidian-Vault/05-Knowledge-Base/domains/{domain}/books.yaml

# Run a sample query against the new domain DB
uv run --directory $BOOKRAG_HOME \
  bookrag query-hybrid "key topic from the book" \
  --domain "{domain}" \
  --settings ~/Documents/Obsidian-Vault/05-Knowledge-Base/config/settings.toml \
  --stdout
```

Expected output: JSON with `hits` array containing relevant text chunks from the book.

### Step 4.5 — Rebuild Master ask-kb Index

**Required** — without this step, the book will NOT appear in `/ask-kb` results.

`add-pdf-to-kb` builds a per-domain DB inside the vault. `/ask-kb` queries a separate master
vault DB that must be explicitly rebuilt after adding any book.

```bash
uv run --directory $BOOKRAG_HOME \
  bookrag obsidian-ingest \
  --vault-path ~/Documents/Obsidian-Vault \
  --db $BOOKRAG_HOME/master-kb/domains/obsidian-vault/bookrag.db \
  --settings $BOOKRAG_HOME/bookrag/config/settings.toml
```

Takes 20–60 minutes. Monitor for `obsidian-ingest: N vectors upserted to ChromaDB` then verify:

```bash
uv run --directory $BOOKRAG_HOME \
  bookrag query-hybrid "key topic from {title}" \
  --db $BOOKRAG_HOME/master-kb/domains/obsidian-vault/bookrag.db \
  --settings $BOOKRAG_HOME/bookrag/config/settings.toml \
  --stdout
```

### Step 5 — Create Obsidian Vault Reference Note

Create a structured reference note in the vault so the book is visible in Obsidian and picked up
on the next obsidian-vault DB rebuild.

Call `mcp__ultimate-obsidian__create_or_update_note` with:
- **filepath**: `01-Reference/Books/{book-slug}.md`
- **mode**: `overwrite`
- **content** (template below — fill in all `{placeholders}`):

```markdown
---
title: "{Book Title}"
author: "{Author Name}"
domain: "{bookrag-domain}"
type: book
source: {original-filename}.pdf
imported: {YYYY-MM-DD}
bookrag_db: ~/Documents/Obsidian-Vault/05-Knowledge-Base/domains/{domain}/bookrag.db
tags: [#book, #{domain}, #imported]
---

# {Book Title}

**Author**: {Author Name}
**Domain**: [[{domain}]]
**Indexed**: {YYYY-MM-DD}

## Summary

{2–3 sentence summary of the book's core thesis — extracted from bookrag structure output or book metadata}

## Key Themes

{List 3–5 key themes from the book slug or structure stage output}

## Query This Book

    uv run --directory $BOOKRAG_HOME \
      bookrag query-hybrid "your question" \
      --domain "{domain}" \
      --settings ~/Documents/Obsidian-Vault/05-Knowledge-Base/config/settings.toml \
      --stdout
```

### Step 6 — Report to User

Provide a clear summary:

```
✅ Successfully added to your knowledge base!

Book:       {Title} by {Author}
Domain:     {domain}
DB:         ~/Documents/Obsidian-Vault/05-Knowledge-Base/domains/{domain}/bookrag.db
Vault note: 01-Reference/Books/{book-slug}.md

Query now:
  uv run --directory $BOOKRAG_HOME \
    bookrag query-hybrid "your question about {title}" \
    --domain "{domain}" \
    --settings ~/Documents/Obsidian-Vault/05-Knowledge-Base/config/settings.toml \
    --stdout

Note: Run Step 4.5 to make this book findable via /ask-kb.
```

## Error Handling

### Common Issues

**File not found**:
```
❌ File not found: <path>
Please check the path and try again.
```

**Unsupported format**:
```
❌ Only PDF and EPUB files are supported.
Format detected: <extension>
```

**ANTHROPIC_API_KEY not set**:
```
❌ ANTHROPIC_API_KEY not found.
Set it: export ANTHROPIC_API_KEY=sk-ant-...
Or use --skip-structure to bypass the structure stage (faster, lower quality).
```

**Low heading count (likely scanned PDF)**:
```
⚠️ Low heading count detected. PDF may be image-based.
Install OCR: pip install ocrmypdf
Run: ocrmypdf input.pdf input-ocr.pdf
Then retry with the OCR'd version.
```

**Domain not found**:
```
❌ Domain '{domain}' not registered.
Register first (Step 2):
  uv run --directory $BOOKRAG_HOME \
    bookrag domain-create {domain} \
    --display-name "..." --keywords "..." --description "..."
```

**uv not installed**:
```
❌ uv not found.
Install: brew install uv  OR  pip install uv
```

## Dependencies

**Required**:
- `uv` (Python package manager + task runner): `brew install uv` or `pip install uv`
- `bookrag` installed in skills-mono-repo: `cd $BOOKRAG_HOME && uv sync`
- `ANTHROPIC_API_KEY` environment variable (for the structure stage — LLM-based KB extraction)
- **ultimate-obsidian MCP** running in Claude Code (for Step 5 vault note creation)

**Check installation**:
```bash
uv --version
uv run --directory $BOOKRAG_HOME bookrag --help
echo $ANTHROPIC_API_KEY | head -c 8  # should show 'sk-ant-a'
```

## Quality Assurance

Before finalizing, verify:
- [ ] Book title and author correctly extracted
- [ ] `books.yaml` updated with new book entry
- [ ] Sample `bookrag query-hybrid` returns relevant chunks
- [ ] Vault note created at `01-Reference/Books/{book-slug}.md`
- [ ] Domain exists in `domain_registry.yaml`


## Example Interactions

**Example 1: Simple PDF**
```
User: add ~/Downloads/designing-data-intensive-applications.pdf to my KB

Claude:
1. ✓ Found PDF at ~/Downloads/designing-data-intensive-applications.pdf
2. Metadata: "Designing Data-Intensive Applications" by Martin Kleppmann
   Domain: software-architecture
   Slug: designing-data-intensive-applications
   Adding to domain 'software-architecture'. Proceed?
3. Running bookrag build...
   Stage 1: Converting PDF → markdown ✅
   Stage 2: Structuring KB (principles, frameworks, ...) ✅
   Stage 3: Indexing → bookrag.db ✅
4. Sample query returns 5 relevant chunks ✅
5. Vault note created: 01-Reference/Books/designing-data-intensive-applications.md ✅

✅ Successfully added to your knowledge base!
```

**Example 2: New domain required**
```
User: add clean-architecture.pdf to kb, domain: software-craft

Claude:
1. ✓ Found PDF: clean-architecture.pdf
2. Domain 'software-craft' — registering...
   uv run ... bookrag domain-create software-craft ...
   ✓ Domain registered
3. Running bookrag build...
   [pipeline output]
4. ✓ DB queryable
5. ✓ Vault note: 01-Reference/Books/clean-architecture.md
```

**Example 3: Scanned PDF (OCR needed)**
```
User: add scanned-book.pdf to kb

Claude:
⚠️ Low heading count detected. PDF may be image-based.

Install OCR: pip install ocrmypdf
Run: ocrmypdf scanned-book.pdf scanned-book-ocr.pdf

Then run this skill again with scanned-book-ocr.pdf
```
