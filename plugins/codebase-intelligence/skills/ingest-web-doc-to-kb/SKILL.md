---
name: ingest-web-doc-to-kb
description: >
  Scrape a documentation site or article (a URL and its sub-pages), distill each page into
  structured KB cards, and index the whole thing into the local bookrag knowledge base — fully
  autonomously, no API key and no user questions. Mirrors the add-pdf-to-kb pipeline but for the
  web: discover -> scrape (trafilatura) -> distill (in-session, key-free) -> bookrag build --kb-dir
  -> batched Chroma dense index -> verify -> vault reference note -> master ask-kb rebuild.
  Trigger phrases: "/ingest-web-doc-to-kb <url>", "ingest this documentation into my KB",
  "scrape this site into my knowledge base", "add these docs to my KB from the web".
---

> **bookrag engine path** — This skill runs the local `bookrag` engine. Resolve its path ONCE at
> the start of a run, note the printed value, and substitute it wherever `$BOOKRAG_HOME` appears
> below. This bootstraps a pinned, patched bookrag on first use (public base fetched from source +
> your own patches) — no `~/Documents` path required:
>
> ```bash
> bash "$(find ~/.claude -type f -path '*codebase-intelligence/scripts/bookrag-home.sh' 2>/dev/null | head -1)"
> ```


# ingest-web-doc-to-kb

End-to-end, **hands-off** ingestion of a web documentation source into the local bookrag KB.
Given one URL, it fetches that page and its sub-pages, distills each into structured knowledge
cards, indexes them into the right domain, and makes them queryable — with **no external API key**
(the "structure" stage is done in-session by subagents) and **no questions asked**.

## Absolute rules

- **NEVER call AskUserQuestion.** Make every decision automatically using the rules below and
  report the choices in the final summary. The user invoked this to be left alone.
- **No `ANTHROPIC_API_KEY` anywhere.** Structuring is done by you/subagents; indexing is fully local.
- Run the whole pipeline to completion, including the master `ask-kb` rebuild at the end.

## Inputs

- **`$ARGUMENTS`**: a single URL (required). Optionally a second token overriding the domain
  (e.g. `/ingest-web-doc-to-kb https://docs.foo.com/guide llm-engineering`). If no domain is given,
  auto-pick one.

## Fixed paths (this machine)

```
REPO=$BOOKRAG_HOME
VAULT=~/Documents/Obsidian-Vault
SETTINGS=$VAULT/05-Knowledge-Base/config/settings.toml
REGISTRY=$VAULT/05-Knowledge-Base/config/domain_registry.yaml
DOMAINS=$VAULT/05-Knowledge-Base/domains
MASTER_DB=$REPO/master-kb/domains/obsidian-vault/bookrag.db
MASTER_SETTINGS=$REPO/bookrag/config/settings.toml
```

**Locate this skill's bundled scripts at runtime** (works whether installed as a personal
`~/.claude/skills/` skill or as a plugin under `~/.claude/plugins/cache/...`):

```bash
SCRIPTS="$(dirname "$(find ~/.claude -type f -path '*ingest-web-doc-to-kb/scripts/discover.py' 2>/dev/null | head -1)")"
```

Use `$SCRIPTS/discover.py`, `$SCRIPTS/scrape.py`, `$SCRIPTS/choose_domain.py`, `$SCRIPTS/rechroma.py`
throughout. Use a scratch dir for the URL list (your session scratchpad or `/tmp`).

## Derive the collection slug (deterministic)

From the URL: take the host's main label (drop `www.` and the TLD) + the last non-empty path
segment, kebab-cased. Examples:
- `https://www.anthropic.com/engineering` -> `anthropic-engineering`
- `https://docs.crewai.com/concepts` -> `crewai-concepts`
- `https://example.com/blog/post-title` (single page) -> `example-post-title`

Call this `SLUG`. It is the bookrag `--name` and the kb sub-directory.

## Pipeline

### Step 1 — Discover URLs

```bash
python3 $SCRIPTS/discover.py "<URL>" > <scratch>/urls.txt
```

Reads the page and lists every same-host link under the URL's path prefix (depth-1). If none are
found it emits just the input URL (single-page mode). Log the count. If it returns a very large
list (> ~200), keep the first 200 and note the cap in the final report.

### Step 2 — Scrape to markdown

```bash
cd $REPO && uv run --with trafilatura python $SCRIPTS/scrape.py \
  <scratch>/urls.txt "$DOMAINS/<DOMAIN>/markdown/$SLUG"
```

But `<DOMAIN>` isn't known yet — so scrape to a temp dir first, OR run Step 3 before Step 2 using a
sample. **Order that works:** scrape into a neutral staging dir
`$DOMAINS/_staging/$SLUG/`, then in Step 3 decide the domain, then `mv` the staging dir into
`$DOMAINS/<DOMAIN>/markdown/$SLUG/`. trafilatura is pulled ephemerally by uv (`--with`); no install
needed. Confirm the file count matches the URL count (allow a few skips for thin pages).

### Step 3 — Choose the domain (auto)

If the user passed a domain token, use it. Otherwise:

```bash
cd $REPO && uv run python $SCRIPTS/choose_domain.py \
  "$REGISTRY" "$DOMAINS/_staging/$SLUG" "$SLUG"
```

- Prints an existing domain name -> use it.
- Prints `NEW:<slug>` -> register a new domain, inferring keywords/description from the scraped
  content yourself:
  ```bash
  cd $REPO && uv run bookrag domain-create <slug> \
    --display-name "<slug>" \
    --keywords "<8-12 space-separated topic keywords you infer from the pages>" \
    --description "<one-line description>" \
    --settings "$SETTINGS"
  ```

Then move the staged markdown into the chosen domain:
```bash
mkdir -p "$DOMAINS/<DOMAIN>/markdown" && mv "$DOMAINS/_staging/$SLUG" "$DOMAINS/<DOMAIN>/markdown/$SLUG"
```

### Step 4 — Distill each page into KB cards (in-session, key-free)

Create the kb output dir: `$DOMAINS/<DOMAIN>/kb/$SLUG/`.

Split the scraped slugs into batches of ~5 and launch **one `general-purpose` subagent per batch in
parallel** (run_in_background: true; wait for all completion notifications). Give each subagent the
exact list of slugs for its batch and this template. For a single page, do it inline yourself.

Each subagent, for each slug:
- READ `$DOMAINS/<DOMAIN>/markdown/$SLUG/{slug}.md` (header has the title + `Source: {url}`)
- WRITE `$DOMAINS/<DOMAIN>/kb/$SLUG/{slug}.md` using EXACTLY this template (keep heading levels —
  the indexer chunks by headings). Fill every section faithfully from the source; do not invent.
  Omit a section only if the page genuinely has nothing for it.

````
# {Page Title}

Source: {url from the raw file}
Type: web-doc

## Summary

{3-5 sentence summary of the page's core thesis / what it documents.}

## Core Principles

### P01: {Short principle title}
- **Explanation**: {what it says}
- **Why**: {the reasoning}
- **Where it applies**: {context}
- **Where it may fail**: {limits / caveats, if any}

### P02: {...}
{...extract 3-7 principles the page actually argues for. For pure reference/API docs, capture the
key concepts, parameters, and contracts as principles instead.}

## Frameworks & Models

### {Framework / pattern / API / technique name}
{Components, steps, or structure. When to use it. Include concrete specifics — names, signatures,
config, numbers — from the page. If the page has no reusable framework, write "None — {why}".}

## Failure Modes

### {Pitfall / gotcha / error name}
- **Symptom**: {observable problem}
- **Cause**: {root cause}
- **Mitigation**: {fix per the page}

## Application Playbook

- {5-12 concrete, actionable bullets a practitioner can apply}

## Key Claims

- {Notable factual/empirical claim or spec} — {evidence or context}
````

Subagents keep final messages brief (they are not shown to the user). After all finish, verify:
every scraped slug has a matching kb card, each card has all 6 `##` sections. Re-run any missing.

### Step 5 — Index locally (no key)

```bash
cd $REPO && uv run bookrag build \
  --kb-dir "$DOMAINS/<DOMAIN>/kb/$SLUG" \
  --domain <DOMAIN> \
  --name "$SLUG" \
  --settings "$SETTINGS"
```

`--kb-dir` skips convert + the LLM structure stage and goes straight to local indexing (chunk,
entities, claims, embeddings, BM25, Chroma). Watch for the line
`chroma: SKIP (... batch size ...)` — harmless here because Step 6 guarantees Chroma anyway.

### Step 6 — Guarantee the Chroma dense index (batched)

```bash
cd $REPO && uv run python $SCRIPTS/rechroma.py "$DOMAINS/<DOMAIN>/bookrag.db"
```

Idempotent: re-upserts ALL domain embeddings into Chroma in 4000-vector batches, so dense retrieval
is complete even if the build's single-shot upsert was skipped. (The bookrag source has also been
patched to batch internally, but this step makes the skill self-sufficient regardless.)

### Step 7 — Verify

Run 2-3 `query-hybrid` probes with topics drawn from the ingested pages and confirm the new
`$SLUG/...` cards appear in results:

```bash
cd $REPO && uv run bookrag query-hybrid "<topic from the docs>" \
  --domain <DOMAIN> --settings "$SETTINGS" --stdout
```

### Step 8 — Register the vault reference note

Create `$VAULT/01-Reference/Documentation/$SLUG.md` (via the ultimate-obsidian MCP
`create_or_update_note`, or a plain file write) with frontmatter (title, source URL, domain, type:
web-doc-collection, pages count, imported date, bookrag_db path, tags) plus: a Summary, Key Themes,
a wikilinked list of every ingested page (`[[<SLUG>/<slug>|Title]]`), and the query snippet. Keep
it consistent with existing notes under `01-Reference/Documentation/`.

### Step 9 — Rebuild the master ask-kb index (background)

So the content is findable via `/ask-kb` (a separate vault-wide DB):

```bash
cd $REPO && uv run bookrag obsidian-ingest \
  --vault-path "$VAULT" --db "$MASTER_DB" --settings "$MASTER_SETTINGS"
```

Run this **in the background** (it takes 20-60 min). Tell the user it's running and that you'll
report when it finishes. Do not block the final summary on it.

### Step 10 — Report

Summarize: source URL, pages scraped, domain chosen (and whether newly created), SLUG, chunks
indexed, Chroma vector count, verify result, reference-note path, and that the master ask-kb rebuild
is running in the background. Give a ready-to-run `query-hybrid` example.

## Failure handling (self-heal, don't ask)

- **discover returns only the input URL**: proceed in single-page mode.
- **A page scrapes thin/empty**: skip it (scrape.py already does); note the skip count.
- **`uv` missing**: `brew install uv`; retry.
- **Domain create fails / already exists**: fall back to the best existing domain or `llm-engineering`.
- **A distill subagent dies**: re-launch it for its slugs; if still failing, distill those inline.
- **Chroma still errors in rechroma**: lower BATCH in the script to 2000 and retry.
- **obsidian-ingest fails**: report it but consider the domain-level ingestion successful (Steps 1-8).

## Dependencies

- `uv` (runs bookrag; pulls `trafilatura` ephemerally via `--with`)
- `bookrag` in `$REPO` (`cd $REPO && uv sync` if imports fail)
- ultimate-obsidian MCP (optional; for the reference note — else write the file directly)
- No `ANTHROPIC_API_KEY`. No network beyond fetching the target site + HuggingFace model cache.
