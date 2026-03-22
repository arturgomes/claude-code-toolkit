---
name: consult-kb
description: >
  Review code, RFCs, architecture decisions, or ideas against a personal knowledge base of
  validated principles and patterns. Use this skill when the user asks for a review, critique,
  or audit of something they've written — code snippets, design docs, ADRs, RFCs, API designs,
  or system diagrams — especially when they want consistency with documented standards.
  Trigger phrases: "review this against my KB", "does this follow our patterns?", "critique this RFC",
  "audit this design", "is this consistent with [book/principle]?", "review like a senior",
  "check against our architecture principles". This produces structured feedback with KB citations,
  not just generic code review.
---

# consult-kb

Review artifacts (code, RFCs, ADRs, designs) against the user's knowledge base.
Acts as a **senior reviewer who has read the same books** — consistent, principled, citable.

## Workflow

### Step 1 — Parse the Artifact
Understand what's being reviewed:
- **Type**: code | RFC | ADR | design doc | architecture diagram | API spec | idea
- **Domain**: What technical/strategic area does it touch?
- **Stated intent**: What is this artifact trying to achieve?

### Step 2 — Locate the Registry
Same resolution order as `ask-kb`:
1. Path mentioned in conversation
2. `$KB_ROOT/kb-registry.yaml`
3. `~/kb/kb-registry.yaml`
4. `./kb/kb-registry.yaml`

### Step 3 — Select Relevant KBs
Map the artifact's domain to KB keywords. An RFC about a retry mechanism → `software-architecture` KB. A product strategy doc → `strategy` KB. A code PR → `engineering-excellence` KB.

Load all High relevance KBs. For reviews, it's better to be thorough — slightly broader selection than `ask-kb`.

### Step 4 — Run the Review

For each loaded KB, systematically check the artifact against:

1. **Principles** — Does it follow the documented principles?
2. **Patterns** — Does it use the right patterns for the problem?
3. **Anti-patterns** — Does it violate anything explicitly called out as bad?
4. **Decision frameworks** — Run the KB's IF/THEN heuristics against the artifact

Categorize findings:
- 🔴 **Violation**: Directly contradicts a documented principle
- 🟡 **Tension**: Deviates from a pattern, but has potential justification
- 🟢 **Aligned**: Explicitly matches a KB recommendation (worth noting)
- 💡 **Suggestion**: KB has a better approach not currently used

### Step 5 — Structure the Feedback

---

## Output Format

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

### 🟡 Tensions (Worth Discussing)

#### [Issue Title]
**What I found**: [Description]  
**KB Pattern**: [What the standard approach would be]  
**Source**: [Book Title — concept/section]  
**Why it might be OK**: [Legitimate reason to deviate]  
**Recommendation**: [Your take on whether to change or document the deviation]

---

### 🟢 What's Well-Aligned

- [Principle followed] — *Source: [Book Title]*
- [Pattern correctly applied] — *Source: [Book Title]*

(Keep this brief — focus on meaningful alignment, not praise padding)

---

### 💡 Suggestions from KB

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
- Separate KB-based findings from general engineering judgment. If you add something from general knowledge, prefix it: `[General best practice, not from KB]`
- If the artifact is well-designed and KB-aligned, say so briefly — don't inflate feedback.

---

## When There's Nothing Wrong
If the artifact genuinely aligns with the KB:
> "This design is well-aligned with your KB. [2-3 specific things done right with citations]. 
> No violations found. One optional suggestion: [if any]."

Don't manufacture criticism.
