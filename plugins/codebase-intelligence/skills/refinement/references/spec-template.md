# Spec: [FEATURE NAME]

**Ticket**: [JIRA-TICKET or —] · **Slug**: `[kebab-slug]` · **Created**: [YYYY-MM-DD] ·
**Status**: draft | READY | NOT READY

**Input**: [verbatim goal / ticket summary / PRD path]

<!--
  This file is the refinement contract. Everything downstream consumes it:
  /prp-plan reads it as the authoritative requirement set, spec-analyze grades coverage against it,
  the mediator slices rounds by its user stories, and spec-converge reconciles the merged code
  against it. An ambiguity left here becomes N worktrees of the wrong thing.
-->

## User Scenarios *(mandatory)*

<!--
  Stories are PRIORITIZED user journeys. Each must be INDEPENDENTLY TESTABLE: implement only that
  one story and you still have something that works and delivers value. P1 is the MVP.
  A story that cannot be verified without another story is not a story — re-cut the slice.
-->

### US1 — [Brief title] (Priority: P1) 🎯 MVP

[The journey in plain language.]

- **Why this priority**: [the value, and why it outranks the rest]
- **Independent Test**: [how this is verified alone — "log in as a new user, see the timestamp on
  /profile" — and what value that alone delivers]

**Acceptance scenarios**

1. **Given** [initial state], **When** [action], **Then** [observable outcome]
2. **Given** [edge condition], **When** [action], **Then** [observable outcome]
3. **Given** [failure condition], **When** [action], **Then** [observable failure behavior]

### US2 — [Brief title] (Priority: P2)

[…same shape…]

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST [specific, observable capability]
- **FR-002**: Users MUST be able to [key interaction]
- **FR-003**: System MUST NOT [the thing that would be a defect]

<!-- Every FR maps to ≥1 acceptance scenario and ≥1 DoD item. No adjectives standing in for criteria. -->

### Key Entities *(if the feature involves data)*

- **[Entity]**: [what it represents, key attributes, relationships — no implementation detail]

## Success Criteria *(mandatory)*

<!--
  Measurable and TECHNOLOGY-AGNOSTIC. A number, a unit, a threshold. Never a library, endpoint,
  or file. Tag each one:
    buildable — someone has to build something for this to hold (budget, audit hook, load harness)
                → it must appear in the task list, and spec-analyze checks that it does.
    outcome   — a post-launch metric nobody implements → tracked, never a task.
-->

- **SC-001** *(buildable)*: [e.g. "p95 response for the profile page stays under 200 ms"]
- **SC-002** *(outcome)*: [e.g. "support tickets about login recency drop 50% in a quarter"]

## Edge Cases

- What happens when [boundary condition]?
- How does the system behave when [dependency fails]?

## Out of Scope *(the drift-guard hard boundary)*

<!-- Copied verbatim into the TASK ANCHOR. A file touched inside these areas is a deterministic 🔴. -->

- [explicitly excluded area / behavior / system]

## Assumptions

<!-- The ledger must end with zero `open` rows before READY. -->

| # | Assumption | Status | Resolution |
|---|---|---|---|
| 1 | [implicit thing being assumed] | confirmed \| open-question \| confirmed (AI-proposed, awaiting ratification) | [requirement ref, or the question] |

## Definition of Done

<!-- Derived FROM the FRs. Every FR → ≥1 item. No orphan item. -->

- [ ] **DoD-1** ([FR-001]): [what must be true in code/tests/build]
- [ ] **DoD-2** ([FR-002]): […]

## Clarifications

<!-- Appended by the clarify loop, one bullet per accepted answer. Never rewritten. -->

### Session [YYYY-MM-DD]

- Q: [question asked] → A: [answer accepted]

## Open Questions

<!-- Present only on a NOT READY verdict. Emptying this section is what unblocks the flow. -->

- [one plain-language question per line]
