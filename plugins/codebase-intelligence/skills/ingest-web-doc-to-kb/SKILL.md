---
name: ingest-web-doc-to-kb
description: >
  Scrape a documentation site or article (a URL and its sub-pages), distill each page into
  structured KB cards, and index the whole thing into the local bookrag knowledge base — fully
  autonomously, no API key and no user questions. Mirrors the add-pdf-to-kb pipeline but for the
  web: discover -> scrape (trafilatura) -> distill (in-session, key-free) -> write cards to vault
  -> FTS5 reindex (local, no vectors) -> verify -> vault reference note.
  Trigger phrases: "/ingest-web-doc-to-kb <url>", "ingest this documentation into my KB",
  "scrape this site into my knowledge base", "add these docs to my KB from the web".
---


# ingest-web-doc-to-kb

End-to-end, **hands-off** ingestion of a web documentation source into the local KB.
Given one URL, it fetches that page and its sub-pages, distills each into structured knowledge
cards written to the vault, refreshes the local FTS5 index, and makes them queryable — with **no
external API key** (the "structure" stage is done in-session by subagents) and **no questions asked**.

## Absolute rules

- **NEVER call AskUserQuestion.** Make every decision automatically using the rules below and
  report the choices in the final summary. The user invoked this to be left alone.
- **No `ANTHROPIC_API_KEY` anywhere.** Structuring is done by you/subagents; indexing is fully local.
- Run the whole pipeline to completion, ending with the FTS5 `reindex_kb`.

## Inputs

- **`$ARGUMENTS`**: a single URL (required). Optionally a second token overriding the domain
  (e.g. `/ingest-web-doc-to-kb https://docs.foo.com/guide llm-engineering`). If no domain is given,
  auto-pick one.

## Fixed paths (this machine)

```
VAULT=~/Documents/Obsidian-Vault
REGISTRY=$VAULT/05-Knowledge-Base/config/domain_registry.yaml
DOMAINS=$VAULT/05-Knowledge-Base/domains
```

Retrieval is the local FTS5 index (`ask-kb`/`search_kb`) — no bookrag DB, no Chroma, no
`$MASTER_DB` rebuild.

**Locate this skill's bundled scripts at runtime** (works whether installed as a personal
`~/.claude/skills/` skill or as a plugin under `~/.claude/plugins/cache/...`):

```bash
SCRIPTS="$(dirname "$(find ~/.claude -type f -path '*ingest-web-doc-to-kb/scripts/discover.py' 2>/dev/null | head -1)")"
```

Use `$SCRIPTS/discover.py`, `$SCRIPTS/scrape.py`, `$SCRIPTS/choose_domain.py`
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
`$DOMAINS/_staging/$SLUG/`, then in Step 3 decide the domain, then move the staging dir into
`$DOMAINS/<DOMAIN>/markdown/$SLUG/` (merged when that dir already exists). trafilatura is pulled ephemerally by uv (`--with`); no install
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

**Change detection** (before the move). Pages are classified one by one; the move is per collection and happens ONCE, after every page is classified. Define `DOMAINS`, `SLUG` (and later `DOMAIN`) inside every Bash call that uses them: shell variables are not exported across Bash calls.
```bash
DOMAINS=~/Documents/Obsidian-Vault/05-Knowledge-Base/domains; SLUG=<slug>
unchanged=0; changed=0; new=0; DOMS=""
for f in "$DOMAINS/_staging/$SLUG"/*.md; do
  slug=$(basename "$f" .md)
  H=$(shasum -a 256 "$f" | cut -d' ' -f1)                                    # macOS; Linux: sha256sum
  CARDS=$(find "$DOMAINS" -maxdepth 4 -path "$DOMAINS/*/kb/$SLUG/$slug.md")   # zsh-safe: no glob
  if [ -z "$CARDS" ]; then new=$((new+1)); echo "new $slug $H"; continue; fi
  while IFS= read -r c; do d=${c#"$DOMAINS"/}; DOMS="$DOMS${d%%/*}"$'\n'; done <<< "$CARDS"
  OLD=$(grep -m1 '^Source-SHA256:' "$(printf '%s\n' "$CARDS" | head -1)" | awk '{print $2}')
  if [ "$OLD" = "$H" ]; then unchanged=$((unchanged+1)); echo "unchanged $slug $H"
  else changed=$((changed+1)); echo "changed $slug $H"; fi
done
echo "unchanged=$unchanged changed=$changed new=$new"
printf '%s' "$DOMS" | sort -u      # domains that already hold cards of this collection
```
Keep the printed `slug H` lines of the `new` and `changed` pages; hand them to the Step 4 subagents.
- **`unchanged`** (`OLD` == `H`): no distill. Say so.
- **`changed`** (`OLD` non-empty and != `H`): re-distill, say so.
- **`changed`, card has no `Source-SHA256`** (made before this rule): a deliberate choice, counted as `changed` — a user re-running ingest on an existing hash-less card wants a refresh, and nothing is deleted any more. Re-distill and write the hash. Do not backfill other cards.
- **`new`** (no card): distill.

Then decide the collection once:
- **Every page `unchanged`** (`changed=0`, `new=0`): skip the whole collection. Remove only the staging dir, skip Steps 4-7, and go to the Step 8 report:
  ```bash
  rm -r -- "${DOMAINS:?}/_staging/${SLUG:?}"
  ```
- **Collection domain.** If the `sort -u` output above is exactly one domain, `DOMAIN` is that domain (report it when it differs from the domain chosen above). If it is empty, `DOMAIN` is the domain chosen above. If it lists more than one, STOP before moving anything and ask which domain wins — a plain-text question ending the run, not `AskUserQuestion`.
- **Move once, never delete old raw files.** If the destination does not exist, move the staging dir; if it exists, merge into it (a plain `mv` onto an existing dir would nest `markdown/$SLUG/$SLUG`):
  ```bash
  DOMAINS=~/Documents/Obsidian-Vault/05-Knowledge-Base/domains; SLUG=<slug>; DOMAIN=<domain>
  DEST="$DOMAINS/${DOMAIN:?}/markdown/${SLUG:?}"
  if [ -e "$DEST" ]; then
    cp -R "$DOMAINS/_staging/$SLUG/." "$DEST/" && rm -r -- "${DOMAINS:?}/_staging/${SLUG:?}"
  else
    mkdir -p "$(dirname "$DEST")" && mv "$DOMAINS/_staging/$SLUG" "$DEST"
  fi
  ```
  A page present only in the old raw dir (not re-scraped) keeps its raw file and its card; a re-scraped page overwrites its raw file.

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
Source-SHA256: {sha256 of the raw markdown file, computed in Step 3}
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
every scraped slug has a matching kb card (pages skipped as `unchanged` count as complete, not missing), each card has all 6 `##` sections and a `Source-SHA256` equal to the value computed in Step 3. Re-run any missing.

### Step 5 — Refresh the FTS5 index (no key, no vectors)

The distilled cards from Step 4 already live in the vault at `$DOMAINS/<DOMAIN>/kb/$SLUG/` — so
there is nothing to "build". Just refresh the local FTS5 KB index so the new cards are queryable:
call `mcp__ultimate-obsidian__reindex_kb` `{}` (incremental, seconds). No `bookrag`, no Chroma, no
embedding model.

> They are auto-indexed anyway (MCP self-indexes on vault write + SessionStart catch-up); the
> explicit `reindex_kb` just makes them queryable immediately.

### Step 6 — Verify

Run 2-3 probes with topics from the ingested pages via
`mcp__ultimate-obsidian__search_kb` `{ "query": "<topic from the docs>", "limit": 6 }` and confirm
`.../kb/$SLUG/...` cards appear in the ranked hits.

### Step 7 — Register the vault reference note

Create `$VAULT/01-Reference/Documentation/$SLUG.md` (via the ultimate-obsidian MCP
`create_or_update_note`, or a plain file write) with frontmatter (title, source URL, domain, type:
web-doc-collection, pages count, imported date, tags) plus: a Summary, Key Themes, a wikilinked list
of every ingested page (`[[<SLUG>/<slug>|Title]]`), and a `/ask-kb` query example. Keep it
consistent with existing notes under `01-Reference/Documentation/`. (Writing it via the MCP also
self-indexes it into FTS5.)

### Step 8 — Report

Summarize: source URL, pages scraped (with the Step 3 counts: unchanged / changed / new), domain chosen (and whether newly created), SLUG, cards
written, FTS5 reindex result, verify result, and reference-note path. Give a ready-to-run
`/ask-kb "<topic>"` example. No master-DB rebuild needed — the FTS5 index is already current.

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
