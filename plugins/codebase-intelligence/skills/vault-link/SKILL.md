---
name: vault-link
description: >
  Reference for how a note joins the Obsidian vault's knowledge graph — the closed relation vocabulary,
  the path-qualification rule, and the managed Context footer. Consulted by session-memory, kb-indexer,
  and index-kb-domains before they write. Invoke directly on "link this note", "why is this note
  orphaned", "what should this note's up be", "add graph relations".
version: 1.0.0
---

# vault-link

Every note written into the vault must arrive already connected. This skill is the writer-side contract
for that: it says what to put in frontmatter, how to spell a link, and what the generated footer looks
like.

**This is a reference, not a fourth vault-writing skill.** `session-memory`, `kb-indexer`, and
`index-kb-domains` do the writing; they consult this for the shape. Adding another writer would give the
vault a fourth YAML dialect.

Authority: `02-Notes/Wiki/knowledge-graph-ontology.md` (schema_version 2) in the vault. When this file
and the ontology disagree, **the ontology wins** — it is what the gate `check-graph-acs.sh` enforces.

---

## Why this exists

A retrofit closed the vault's graph once: 2,817 sinks → 345, 344 orphans → 0, 266 dangling notes → 0,
across 4,428 notes. That was a one-time debt payment by
`02-Notes/.scripts/backfill-graph-relations.py`. This skill is what stops the debt re-accruing — the
backfill can only infer edges mechanically, so a note that arrives with no derivable relation stays a
sink forever. The cheapest possible moment to link a note is while writing it.

---

## 1. The closed relation vocabulary

Six keys. Anything else relation-shaped is a gate failure (AC1).

| Key | Meaning | Cardinality |
|---|---|---|
| `up` | the one hub or entity this note belongs under | exactly 1, or absent |
| `implements` | this artifact carries out that plan/contract | 0..n |
| `documents` | this artifact describes that entity's state or outcome | 0..n |
| `affects` | work here changed that production entity | 0..n |
| `supersedes` | this replaces an earlier artifact of the same type | 0..n |
| `related` | freeform association, no stronger meaning available | 0..n |

Rules that bite:

- **`up` is scalar.** Two strong subjects → pick one for `up`, the rest go to `related`. A list-valued
  `up` fails AC1.
- **Every value is a wikilink**, quoted: `up: "[[SEATHQ-1015]]"`. A bare string fails AC1.
- **Multi-value keys use block lists**, not inline:
  ```yaml
  affects:
    - "[[svc-seathq-fe]]"
    - "[[svc-seathq-core]]"
  ```
- **Edges are forward-only.** Never write an inverse key on the target — inverse lookup is Obsidian's
  backlink pane. Writing one means two files mutate per note, which breaks idempotency.
- **Targets must exist.** An edge to a nonexistent note fails AC4. If the target should exist but does
  not, create it first (tickets and services live under `03-Systems/`) or use `related` prose instead.

---

## 2. Path-qualify every reference-tier link

**This vault has 2,421 files sharing 138 colliding basenames** — 262 of them are literally
`01_core_principles.md`, plus 265 × `README.md` and 262 × `CLAUDE.md`.

```yaml
# WRONG — identifies nothing; Obsidian silently picks *a* book, not *the* book
up: "[[01_core_principles]]"

# RIGHT — fully vault-relative
up: "[[05-Knowledge-Base/domains/software-craft/kb/tidy-first/01_core_principles]]"
```

Rule: **if the basename is not unique in the vault, the link carries enough path to disambiguate.** In
`05-Knowledge-Base/` assume it never is. The gate's resolver returns "unresolved" for an ambiguous bare
basename rather than guessing, so a bare KB link reads as a broken link.

---

## 3. Pick `up` by note type

| Writing a… | `up` should point at |
|---|---|
| session / plan / report / PR description | its ticket node, `03-Systems/tickets/<ID>.md` |
| …with no ticket | its subject MOC, e.g. `[[seathq.moc]]` |
| KB card | its book hub — the book's `README.md` (or `00_book_summary`) |
| KB book hub | its domain index, `05-Knowledge-Base/domains/<domain>/index` |
| service / entity node | `[[knowledge-graph.moc]]` |

And **always add `affects`** when the work touched a repo that has a service node:

```yaml
project: seathq-fe          # already written by session-memory
affects: "[[svc-seathq-fe]]"
```

That single edge is what makes the vault reachable from a coding session — see §5.

---

## 4. The managed Context footer

Generated blocks are delimited and fully regenerated on every run:

```markdown
<!-- graph:context:start -->

## Context

- **Part of**: [[svc-seathq-fe]]
- **Related**: [[some-plan]] · [[some-report]]

<!-- graph:context:end -->
```

- **Never hand-edit inside the markers** — the next run overwrites it.
- **Never write anything outside them** when regenerating — the emitter does not reflow, reformat, or
  reparse the body.
- The block only renders relations that are already in frontmatter **and resolve**. It adds no edge of
  its own, so deleting it loses nothing.
- A malformed marker pair (start without end) is skipped and reported, never repaired by guessing.

To regenerate footers across the vault:

```bash
python3 02-Notes/.scripts/backfill-graph-relations.py --tier=all --footer --verify-idempotent
python3 02-Notes/.scripts/backfill-graph-relations.py --tier=all --footer --apply
```

---

## 5. Reading the graph from a coding session

The point of all of this is the retrieval direction, not the writing direction.

1. **Start at the repo's service hub** — `03-Systems/services/svc-<repo>.md`. It lists every plan,
   report, session and PR description the vault holds for that codebase, newest first. This answers
   "what has been tried here before, and what broke".
2. **Then search, don't browse.** Use the `ask-kb` skill (local FTS5/BM25 over the vault via the
   `ultimate-obsidian` MCP `search_kb`). Once you know what you are looking for, search beats reading a
   hub end to end.
3. **Follow `up` to widen, `related` to go sideways.** A KB card's siblings are the rest of its book.

---

## 6. Verifying

Run the gate before considering vault writes done:

```bash
bash 02-Notes/.scripts/check-graph-acs.sh     # AC1-AC11; prints ALL GRAPH ACS PASS
```

The two that this skill exists to protect:

- **AC10** — no note is dangling (zero inbound *and* zero outbound). Must be exactly zero.
- **AC11** — orphan and sink counts never rise past their ceilings in `graph_lib.py`.

**Raising a ceiling to make a red gate green is itself a gate failure.** If a run pushes AC11 over,
the note that caused it needs an edge, not a bigger ceiling.

---

## 7. Refusals

Never:

1. Infer an edge by topic similarity, embedding, or vibes. A wrong edge is worse than a missing one.
2. Match filenames fuzzily — byte-identical stems only.
3. Write an edge to a note that does not exist.
4. Overwrite a hand-curated frontmatter value; merge into lists, never replace.
5. Synthesize frontmatter into a note that has none, **except** KB cards, where every value is derivable
   from the path.
6. Touch `01-Reference/` or `04-Claude-Sessions/` frontmatter — those tiers get inbound hub links only.
7. Edit note bodies outside the managed markers.
