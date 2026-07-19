---
name: consult-kb
description: >
  Review code, RFCs, ADRs, or designs against the personal KB for violations, tensions, and aligned patterns.
  Trigger on "review this against my KB", "does this follow our patterns?", "audit this design".
version: 2.0.1
---

> **bookrag engine path** — This skill runs the local `bookrag` engine. Resolve its path ONCE at
> the start of a run, note the printed value, and substitute it wherever `$BOOKRAG_HOME` appears
> below. This bootstraps a pinned, patched bookrag on first use (public base fetched from source +
> your own patches) — no `~/Documents` path required:
>
> ```bash
> bash "$(find ~/.claude -type f -path '*codebase-intelligence/scripts/bookrag-home.sh' 2>/dev/null | head -1)"
> ```


# consult-kb

Review artifacts (code, RFCs, ADRs, designs) against the user's knowledge base.
Acts as a **senior reviewer who has read the same books** — consistent, principled, citable.

## Workflow

### Step 1 — Parse the Artifact
Understand what's being reviewed:
- **Type**: code | RFC | ADR | design doc | architecture diagram | API spec | idea
- **Domain**: What technical/strategic area does it touch?
- **Stated intent**: What is this artifact trying to achieve?

### Step 2 — Run bookrag query for artifact domain

Build a query from the artifact's stated domain and key concepts. For a retry RFC:
`"retry patterns distributed systems idempotency"`. For a product strategy doc:
`"strategy frameworks product decision-making"`.

```bash
uv run --directory $BOOKRAG_HOME \
  bookrag query-hybrid "<domain-query>" \
  --db $BOOKRAG_HOME/master-kb/domains/obsidian-vault/bookrag.db \
  --settings $BOOKRAG_HOME/bookrag/config/settings.toml \
  --stdout
```

Run 1-2 queries if the artifact spans multiple domains.

### Step 3 — Load hit contexts

For each hit above rrf_score threshold (~0.01):
- Extract: `text` (chunk content), `source_relpath` (book/domain), `heading_path` (section)
- Group hits by domain (software-architecture, software-craft, etc.)
- Use these chunks as the KB reference for Step 4 review

### Fallback (bookrag unavailable)

If `uv` is not found or the DB path does not exist:
1. Say: "bookrag unavailable — falling back to kb-registry.yaml"
2. Find `kb-registry.yaml` at: `$KB_ROOT/kb-registry.yaml` → `~/kb/kb-registry.yaml` → `./kb/kb-registry.yaml`
3. Map artifact domain to KB keywords, read relevant markdown files
4. Run review against flat-file content

### Step 4 — Run the Review

For each loaded KB chunk, systematically check the artifact against:

1. **Principles** — Does it follow the documented principles?
2. **Patterns** — Does it use the right patterns for the problem?
3. **Anti-patterns** — Does it violate anything explicitly called out as bad?
4. **Decision frameworks** — Run the KB's IF/THEN heuristics against the artifact

Categorize findings:
- 🔴 **Violation**: Directly contradicts a documented principle
- 🟡 **Tension**: Deviates from a pattern, but has potential justification
- 🟢 **Aligned**: Explicitly matches a KB recommendation (worth noting)
- 💡 **Suggestion**: KB has a better approach not currently used

### Step 5 — Output Format

```
## Review of [Artifact Name/Type]

### Summary
[2-3 sentence overall assessment. Lead with the most important finding.]

---

### 🔴 Violations

#### [Issue Title]
**What I found**: [Description of the problem in the artifact]  
**KB Principle**: [What the KB says should be done instead]  
**Source**: [Book Title — concept/section]  
**Suggested fix**: [Concrete actionable change]

---

### 🟡 Tensions (Worth Discussing)  (include only if ≥1 tension)

#### [Issue Title]
**What I found**: [Description]  
**KB Pattern**: [What the standard approach would be]  
**Source**: [Book Title — concept/section]  
**Why it might be OK**: [Legitimate reason to deviate]  
**Recommendation**: [Your take on whether to change or document the deviation]

---

### 🟢 What's Well-Aligned  (include only if ≥1 alignment worth noting)

- [Principle followed] — *Source: [Book Title]*
- [Pattern correctly applied] — *Source: [Book Title]*

(Keep this brief — focus on meaningful alignment, not praise padding)

---

### 💡 Suggestions from KB  (include only if KB has a better approach not currently used)

#### [Suggestion Title]
**Opportunity**: [What could be improved]  
**KB Approach**: [What the sources recommend]  
**Source**: [Book Title — concept/section]

---

### KB Coverage
KBs consulted: [list]  
Files read: [list]  
Topics not covered by KB: [list — honest about gaps]
```

---

## Review Modes

Adapt depth to artifact type:

| Artifact | Focus |
|---|---|
| Code snippet | Pattern usage, naming, error handling, complexity |
| RFC / Design doc | Architecture decisions, trade-off documentation, consistency with existing patterns |
| ADR | Follows decision framework? Documents context, options, consequences? |
| API spec | Contract design, versioning, error patterns |
| Strategy doc | Framework alignment (Playing to Win, etc.), logical consistency |

---

## Tone Guidelines

- Be direct. This is a review, not a compliment session.
- Every finding must cite a KB source. If you can't cite it, don't include it.
- Prefix non-KB additions with `[General best practice, not from KB]`.
- If the artifact is well-aligned, say so briefly with 2-3 cited examples — don't manufacture criticism.
