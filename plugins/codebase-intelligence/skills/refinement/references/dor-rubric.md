# Definition-of-Ready (DoR) rubric — the pre-planning gate

The refinement facilitator grades the groomed task against this rubric. The verdict is binary:
**READY** (proceed to Phase 0 / prp-plan) or **NOT READY** (STOP — emit questions, do not plan or
code). "We don't dive into coding unless the assignment is fully understood as a contract."

## Part 1 — Definition of Ready checklist (all MUST be ✅ to pass)

1. **Goal is a story.** The goal is expressed as ≥1 user story with an explicit *why* (business value).
2. **ACs are testable.** Every acceptance criterion is observable and verifiable — an outsider could
   write a pass/fail check for it. No "good / fast / nice / robust" adjectives standing in for outcomes.
3. **Scenarios cover the AC.** Each AC has scenarios spanning **happy path + the material edge cases +
   the failure/refusal behavior**. No AC with only a happy path.
4. **DoD derived from ACs.** A Definition of Done exists and **every DoD item traces back to an AC**;
   **every AC produces ≥1 DoD item**. No orphan DoD, no AC without a DoD.
5. **Zero unresolved assumptions.** The assumption ledger has **no open rows** — each is either
   confirmed-as-requirement or converted to a clarifying question (and answered). A silent assumption
   is an automatic NOT READY.
6. **Technical decisions made.** No AC hides an unmade technical decision (data model, API shape,
   auth/permission model, migration, third-party contract, performance target).
7. **Unknowns routed.** Every unknown is classified: **library/API fact** (answerable by ask-kb /
   Context7 at plan time — not a blocker) vs **business/requirement decision** (must be answered by a
   human before READY).
8. **QA would sign off.** The QA lens confirms: given these ACs + scenarios + DoD, QA can fully verify
   the deliverable and would accept it. If QA can't test it, it's NOT READY.

Verdict: **READY** iff all 8 are ✅. Any ✅-miss ⇒ **NOT READY**.

## Part 2 — Assumption ledger (must end empty of open rows)

| # | assumption | status | resolution |
|---|---|---|---|
| … | <implicit thing being assumed> | confirmed \| open-question | <requirement ref, or the question> |

Open rows block READY. This is the mechanical "no assumptions" enforcement.

## Part 3 — Question-quality rubric (for NOT READY output)

A clarifying question is only allowed if it is **meaningful** — lazy questions are rejected. Each
question MUST state:

- **What is ambiguous** — the exact AC / requirement / decision that is vague, obscure, or conflicting.
- **Why it blocks** — what cannot be built or tested until it's answered.
- **Options considered** — the 2-3 plausible interpretations (so the answer can be a quick pick).
- **Impact of each** — how the choice changes scope / build / test.

Format:
```
Q{n} [category: business | acceptance-criteria | technical-decision | scope]
  Ambiguity: {exact vague thing}
  Blocks:    {what stalls without an answer}
  Options:   (a) … (b) … (c) …
  Impact:    (a) … (b) … (c) …
```

Group questions by category. No "just checking" filler — every question must be load-bearing for the
contract.

## Answering authority

- **Default: the USER answers.** The facilitator presents the questions and STOPS.
- **On explicit delegation** ("answer on my behalf" / `--groom-autonomous`): the panel proposes an
  answer **with rationale** for each question and records it as a **ratifiable decision** (flagged for
  the user to confirm), NOT a hidden assumption. The ledger row moves to `confirmed (AI-proposed,
  awaiting ratification)`, never to a silent assumption.
