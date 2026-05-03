---
name: product-spec
description: >
  Generate comprehensive Product Requirement Documents (PRDs) from feature ideas.
  Acts as a Product Owner to define feature scope, user stories, acceptance criteria,
  and technical constraints before planning begins. Use when starting a new feature,
  defining requirements for a proposal, or when asked "create a PRD", "define product spec",
  "act as product owner", or "what should this feature include?". Produces structured
  artifacts ready for technical planning (QPLAN) and QA test generation (QUX).
version: 2.0.1
---

# product-spec

Generate a PRD covering the 8 sections below in order. Output as Markdown headed `# Feature: {Name}`.

| # | Section | Content |
|---|---|---|
| 1 | FEATURE OVERVIEW | Name · one-line description (10–15 words) · business value · 2–3 measurable key metrics · target persona(s) · Priority P0/P1/P2 |
| 2 | USER STORIES | 3–5 primary + 1–3 edge-case stories. Format: `**As a** {user} **I want** {goal} **So that** {benefit}`. Each story independently deliverable + testable |
| 3 | ACCEPTANCE CRITERIA | Per story, Given-When-Then conditions covering happy path · edge cases · error states · perf requirements (if applicable) |
| 4 | DEPENDENCIES & CONSTRAINTS | Technical deps (APIs, packages, infra) · feature deps · known limitations · security/compliance |
| 5 | OUT OF SCOPE | Explicit exclusions: deferred features, unrelated nice-to-haves |
| 6 | SUCCESS METRICS | Quantifiable KPIs · user behaviour changes · technical metrics |
| 7 | TECHNICAL CONSIDERATIONS | Affected systems · DB schema changes · API contracts · third-party integrations |
| 8 | UI/UX REQUIREMENTS | Key user flows · mobile/desktop · accessibility (WCAG, screen reader, keyboard) |

Every story testable + independently deliverable. Acceptance criteria use Given-When-Then verbatim format.

---

## Vault Save (required after PRD output)

Save via Obsidian MCP (no Write tool, no bash):

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Specs/{kebab-case-feature-name}.prd.md",
  mode: "overwrite",
  content: "---\ntitle: {kebab-name}\ncreated: {YYYY-MM-DD}\ntype: prd\nproject: {project}\ntags:\n  - prd\n  - {feature-category}\n---\n\n{full PRD content}"
})
```

Print: `✅ PRD saved: ~/Documents/Obsidian-Vault/02-Notes/Specs/{kebab-name}.prd.md`
Next: `/codebase-intelligence:prp-plan ~/Documents/Obsidian-Vault/02-Notes/Specs/{kebab-name}.prd.md`
