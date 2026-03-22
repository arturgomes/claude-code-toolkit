# KB File Format Guide

Each KB file is a structured Markdown document extracted from a source (book, doc, notes).
Keep files **topic-chunked**, not chapter-chunked — Claude loads per-file, so smaller focused files = better token efficiency.

## File Structure

```markdown
# [Book/Source Title] — [Topic Area]

> Source: [Author, Year]  
> Last updated: [date]  
> Extraction: [manual | kb-indexer]

## Summary
One paragraph capturing the core thesis of this section.

## Core Principles / Key Concepts

### [Concept Name]
**Definition**: Clear, concise definition.  
**When to use**: Context where this applies.  
**When NOT to use**: Anti-patterns or wrong contexts.  
**Example**: Concrete example, preferably from the source.  
**Source reference**: Chapter X, p. YYY

### [Another Concept]
...

## Patterns & Recipes

### [Pattern Name]
**Problem it solves**: ...  
**Solution**: ...  
**Trade-offs**: ...  
**Source reference**: ...

## Decision Framework
If the source includes decision criteria, extract them here as actionable rules:
- IF [condition] → USE [approach] because [reason]
- IF [condition] → AVOID [approach] because [reason]

## Quotes Worth Citing
> "Exact meaningful quote from the book" — Author, p. XX

Only include quotes that are genuinely insightful and citable.

## My Notes / Team Annotations
(Optional: personal observations, disagreements, adaptations to our context)
```

## Naming Convention
```
kb/
├── kb-registry.yaml
├── architecture/
│   ├── building-microservices.md      # one file per source per topic area
│   ├── ddia.md
│   └── my-principles.md              # personal/team annotations
├── engineering/
│   ├── clean-code.md
│   └── philosophy-sw-design.md
├── strategy/
│   └── playing-to-win.md
└── llm/
    ├── ai-engineering.md
    └── my-llm-patterns.md
```

## Size Guidelines
| File size | Implication |
|---|---|
| < 200 lines | ✅ Ideal — reads in one shot |
| 200–500 lines | ⚠️ OK — consider splitting by sub-topic |
| > 500 lines | ❌ Too big — split into multiple files, update registry |

## What to Extract vs. Skip

**EXTRACT:**
- Core principles and their rationale
- Decision frameworks and heuristics
- Named patterns with context
- Counter-intuitive or non-obvious insights
- Explicit trade-offs

**SKIP:**
- Narrative and storytelling filler
- Historical anecdotes unless they encode a principle
- Implementation details that change (APIs, versions)
- Content you already have in another KB file
