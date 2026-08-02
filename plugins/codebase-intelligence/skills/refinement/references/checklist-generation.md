# The requirements checklist — unit tests for English

**The concept**: if the spec is code written in English, the checklist is its test suite. Every item
tests whether a **requirement is well written** — complete, unambiguous, consistent, measurable,
covered. Nothing in this file tests whether the implementation works; that is QA's job and it happens
much later.

This is the difference between a fixed DoR rubric (the same 12 questions for every ticket) and a
checklist generated **for this feature**: the rubric asks "are the ACs testable?", the checklist asks
"is the behavior specified when the assigned user is deleted?" — a question that only exists because
this feature has assignees.

## Wrong vs right

| ❌ Testing the implementation | ✅ Testing the requirement |
|---|---|
| "Verify the profile page shows the timestamp" | "Is the timestamp's format and timezone specified?" `[Clarity]` |
| "Test that login updates the field" | "Is the update behavior specified for failed logins?" `[Edge Cases]` |
| "Confirm the API returns 200" | "Are the error responses defined for every failure mode?" `[Completeness]` |
| "Check hover states work" | "Are hover requirements consistent across all interactive elements?" `[Consistency]` |

If an item could be executed against a running system, it is in the wrong file.

## Generating it

1. **Derive the theme** from the feature's own signals — domain keywords (auth, latency, export,
   a11y), risk words ("critical", "compliance", "must"), and the artifacts already present. Do not
   pull from a fixed catalog: a generic checklist passes trivially and teaches everyone to ignore it.
2. **Write to** `specs/<slug>/checklists/requirements.md`. Additional focused checklists get their own
   domain file (`security.md`, `ux.md`, `api.md`).
3. **Number `CHK001…`, never reuse an id.** Appending to an existing file continues from the last id;
   existing items are never deleted or renumbered — the pass/fail history has to stay comparable
   across clarify rounds.
4. **Group by quality dimension**, and tag every item with its dimension:

   - **Requirement Completeness** — is everything necessary written down?
   - **Requirement Clarity** — is it specific and unambiguous?
   - **Requirement Consistency** — do the requirements agree with each other?
   - **Acceptance Criteria Quality** — is success objectively measurable?
   - **Scenario Coverage** — is every flow addressed?
   - **Edge Case Coverage** — are boundaries and failures defined?
   - **Non-Functional** — performance, security, accessibility, observability: specified at all?
   - **Story Independence** — can each story be tested and delivered alone?
   - **Dependencies & Assumptions** — documented and validated?

5. **Cite the source** where an item checks something that already exists: `[Spec §Requirements]` or
   `[US1/AC2]`. An item with no anchor is checking a memory, not the file.

## Item shape

```markdown
## Requirement Clarity

- [ ] **CHK004** Is "recent" quantified with a concrete window (minutes/hours/days)? [Clarity] [Spec §FR-002]
- [ ] **CHK005** Is the timezone specified for every displayed timestamp? [Clarity] [Spec §US1]

## Edge Case Coverage

- [ ] **CHK011** Is the displayed value specified for a user who has never logged in? [Edge Cases]
- [ ] **CHK012** Is the behavior defined when the timestamp write fails but the login succeeds? [Edge Cases]
```

Aim for **10-25 items**. Fewer and it is decoration; more and nobody reads the tail — and the tail is
where the unasked question always is.

## Scoring

- Score after generation, then **re-score after every clarification**.
- Report `before/total → after/total`, the newly-passing items, and every **regression**.
- Only toggle the `[ ]`/`[x]` marker of items whose state actually changed. Leave headings, ordering,
  and wording untouched so the diff shows exactly what the answer moved.
- **Threshold for READY**: every `[Clarity]`, `[Completeness]`, and `[Acceptance Criteria Quality]`
  item passes, and no item in any dimension is failing **for a reason the user has not seen**. A
  knowingly-accepted gap is recorded in the assumption ledger with its rationale; an unexamined one
  blocks.

A regression means an answer broke something that previously held — a resolved ambiguity that
re-opened a different one. That is a real finding, not a bookkeeping artifact: chase it before
declaring READY.
