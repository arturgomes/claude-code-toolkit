# [PROJECT] Constitution

**Version**: 0.1.0 | **Status**: draft | **Ratified**: — | **Last amended**: [YYYY-MM-DD]

<!--
  Status: draft    → every finding is ⚠️ advisory and blocks nothing.
  Status: ratified → a MUST violation is 🔴 CRITICAL: no fan-out, no merge, no PR.
  Promotion from draft to ratified is a human act. Nothing auto-promotes.
-->

## Core Principles

<!--
  3-7 principles. Stable IDs (P-1, P-2, …) that are never reused.
  Each principle needs at least one MUST / MUST NOT statement — a principle with no normative
  statement is decoration. Derive these from what this repo already does, not from a blog post.
-->

### P-1. [NAME]

- MUST: [normative statement — observable, enforceable]
- MUST NOT: [the specific thing this principle exists to prevent]
- SHOULD: [strong default, overridable with a stated reason]
- Rationale: [why THIS project pays this cost]

### P-2. [NAME]

- MUST: […]
- Rationale: […]

### P-3. [NAME]

- MUST: […]
- Rationale: […]

## Phase -1 Gates

<!--
  Always present. Thresholds in [brackets] are this project's — change them here, never mid-run
  to let a plan pass.
-->

### G-SIMPLICITY

Does this add more moving parts than the problem requires?

- MUST NOT introduce more than **[3]** new top-level components/packages/services without a
  Complexity Tracking row.
- MUST NOT add an abstraction whose second consumer is hypothetical.
- MUST NOT build for a requirement that is not in the acceptance criteria.

### G-ANTI-ABSTRACTION

Are we wrapping what we could use directly?

- MUST use framework/library features directly rather than wrapping them.
- MUST keep **one** representation per domain concept (no parallel DTO/entity/model trio that must be
  kept in sync by hand).
- A wrapper MUST name an existing second consumer or a documented seam requirement.

### G-INTEGRATION-FIRST

Is the contract defined and failing before the code exists?

- Every cross-boundary contract (API shape, shared type, DB schema, event payload) MUST be written
  before the implementation that satisfies it.
- Its contract test MUST exist and MUST fail against the pre-change code.
- Boundary tests MUST use the real dependency where the project can run one; mocks are the fallback,
  not the default.

## [Additional Constraints]

<!-- Optional: security requirements, performance standards, compliance, data-handling policy. -->

## Governance

- This constitution supersedes the plan, the ticket, and convenience.
- **Amendments are a separate, explicit act**: bump the version, date it, and state the migration
  consequence for existing code. Never amend during the run whose gate you are trying to pass.
- Semver: MAJOR = a principle removed or reversed · MINOR = a principle added · PATCH = wording only.
- Every violation carried forward MUST appear as a complete 3-column row in the plan's
  **Complexity Tracking** table (Violation | Why needed | Simpler alternative rejected because).
