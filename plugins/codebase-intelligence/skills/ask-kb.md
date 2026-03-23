---
name: ask-kb
description: >
  Query a personal knowledge base built from books, ebooks, and validated principles to answer
  technical or strategic questions. Use this skill whenever the user asks "how should I...",
  "what's the pattern for...", "what does [book] say about...", "according to my KB...", or
  any question that should be answered from documented principles rather than improvised.
  Also trigger when the user says "consult my KB", "check my knowledge base", "what do my
  books say about X", or references specific sources like "Clean Code", "DDIA", "Playing to Win".
  Prefer this over answering from general knowledge when the user has a KB configured —
  consistent, source-backed answers beat improvised ones.
---

# ask-kb

Answer questions by consulting the user's personal knowledge base — not from general knowledge.
The goal: **reproducible, cited answers** grounded in principles the user has already validated.

## Workflow

### Step 1 — Locate the Registry
Find `kb-registry.yaml` using this priority:
1. Path explicitly mentioned in the conversation
2. `$KB_ROOT/kb-registry.yaml` environment variable
3. `~/kb/kb-registry.yaml` (default)
4. `./kb/kb-registry.yaml` (project-relative fallback)

If not found → tell the user and show the expected path. Offer to help set up a KB structure.

### Step 2 — Select Relevant Knowledge Bases
Read the registry (it's lean by design — just metadata and keywords).

Score each KB against the question:
- **High relevance**: Keywords directly match the question domain
- **Medium relevance**: Adjacent domain, might contain useful context
- **Low/none**: Unrelated domain — skip entirely

**Token budget rule**: Load High + Medium relevance KBs. Skip Low. If 3+ KBs are High relevance, pick the 2 most directly relevant and note the others.

### Step 3 — Load and Read Relevant Files
For each selected KB, read only the source files whose `topics` field matches the question.

If a KB has 5 source files but only 1 is relevant, **read only that 1**.

### Step 4 — Formulate the Answer
Answer the question using content from the loaded files. Follow these rules:

**DO:**
- Cite every key claim: `[Source: Book Title, concept/section]`
- Use the decision frameworks and heuristics from the KB
- Acknowledge trade-offs as documented in the sources
- Cross-reference multiple KBs if the question spans domains

**DON'T:**
- Invent principles not in the KB
- Mix general LLM knowledge with KB content without being explicit
- Present your own reasoning as KB-backed

### Step 5 — Honest Gaps
If the question can't be answered from the KB:
> "This topic isn't covered in your knowledge base. The relevant KB(s) I checked were: [list]. 
> You may want to add a source on [topic], or I can answer from general knowledge if you prefer."

Never silently fall back to general knowledge.

---

## Output Format

```
## Answer

[Direct answer to the question, 2-5 sentences]

## From Your Knowledge Base

### [Principle/Pattern Name]
[Explanation grounded in KB content]

*Source: [Book Title] — [topic/section]*

### [Another Principle if applicable]
...

## Trade-offs & Considerations
[If the KB documents trade-offs, include them]

## Gaps
[If parts of the question weren't in the KB, be explicit]
```

For simple factual questions (1 concept, 1 source), a shorter format is fine — don't over-structure.

---

## Setup Help

If the user doesn't have a KB yet, point them to:
- `references/kb-registry-example.yaml` — example registry structure  
- `references/kb-format.md` — how to format KB files
- The `kb-indexer` skill — for extracting content from ebooks/PDFs automatically

---

## Example Interaction

**User**: "How should I handle retries in a distributed system?"

**Claude**:
1. Reads `kb-registry.yaml`
2. Identifies `software-architecture` KB as High relevance (keyword: `retry`)
3. Reads `architecture/building-microservices.md` (has `retry` in topics)
4. Answers citing Sam Newman's patterns + user's personal principles if present
