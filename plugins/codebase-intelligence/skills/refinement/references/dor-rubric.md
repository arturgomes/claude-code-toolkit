# Definition-of-Ready (DoR) rubric — the pre-planning gate

The refinement facilitator grades the groomed task against this rubric. The verdict is binary:
**READY** (proceed to Phase 0 / prp-plan) or **NOT READY** (STOP — emit questions, do not plan or
code). "We don't dive into coding unless the assignment is fully understood as a contract."

## Part 1 — Definition of Ready checklist (all MUST be ✅ to pass)

1. **Goal is a story.** The goal is expressed as ≥1 user story with an explicit *why* (business value).
2. **Stories are prioritized.** Every story carries a priority (P1, P2, P3…) and P1 alone is a viable
   slice — the MVP. Priorities that are all P1 are not priorities.
3. **Every story is independently testable.** Each story states an **Independent Test**: how it is
   verified *alone*, delivering value *alone*. A story that can only be tested together with another
   is not a slice — merge them or re-cut. The mediator runs one round per story and checkpoints after
   each, so a bad cut costs a whole round.
4. **FRs are testable.** Every functional requirement is numbered (`FR-###`), observable, and
   verifiable — an outsider could write a pass/fail check for it. No "good / fast / nice / robust"
   adjectives standing in for outcomes.
5. **Success criteria are measurable and technology-agnostic.** Every `SC-###` carries a number, a
   unit, or an observable threshold, names no library/endpoint/file, and is tagged `buildable` or
   `outcome`. A feature whose only definition of done is "the gates went green" is not ready — gates
   can be green on something useless.
6. **Scenarios cover the requirements.** Each FR has scenarios spanning **happy path + the material
   edge cases + the failure/refusal behavior**. No FR with only a happy path.
7. **DoD derived from the FRs.** A Definition of Done exists and **every DoD item traces back to an
   FR**; **every FR produces ≥1 DoD item**. No orphan DoD, no FR without a DoD.
8. **Zero unresolved assumptions.** The assumption ledger has **no open rows** — each is either
   confirmed-as-requirement or converted to a clarifying question (and answered). A silent assumption
   is an automatic NOT READY.
9. **Technical decisions made.** No requirement hides an unmade technical decision (data model, API
   shape, auth/permission model, migration, third-party contract, performance target).
10. **Unknowns routed.** Every unknown is classified: **library/API fact** (answerable by ask-kb /
    Context7 at plan time — not a blocker, and never a user question) vs **business/requirement
    decision** (must be answered by a human before READY).
11. **Requirements checklist passes its threshold.** The generated `checklists/requirements.md` has
    every `[Clarity]`, `[Completeness]`, and `[Acceptance Criteria Quality]` item passing, and no
    failing item that the user has not been shown. Knowingly-accepted gaps live in the ledger with a
    rationale; unexamined ones block.
12. **QA would sign off.** The QA lens confirms: given these stories + FRs + SCs + scenarios + DoD, QA
    can fully verify the deliverable and would accept it. If QA can't test it, it's NOT READY.

Verdict: **READY** iff all 12 are ✅. Any ✅-miss ⇒ **NOT READY**.

Constitution interaction: a ratified constitution MUST principle that a requirement violates is a
NOT READY on its own — the requirement changes, or the constitution is amended as a separate,
explicit act. Never carried forward as "we'll deal with it in the plan".

## Part 2 — Assumption ledger (must end empty of open rows)

| # | assumption | status | resolution |
|---|---|---|---|
| … | <implicit thing being assumed> | confirmed \| open-question | <requirement ref, or the question> |

Open rows block READY. This is the mechanical "no assumptions" enforcement.

## Part 3 — Question-quality rubric (for NOT READY output)

> **Format and budget live in `clarify-protocol.md`** — max 5 per session, one at a time, each
> answerable by picking, each carrying a recommendation. This part governs whether a question is
> *worth* one of those five slots. The tweet-length shape below is what gets posted to **Jira or
> Slack**; the in-session form is the multiple-choice block from the protocol.

A clarifying question is only allowed if it is **meaningful** — lazy questions are rejected, and so are
questions that re-litigate the ticket's own premise. **Absence from `main` is not ambiguity** — most
tickets exist precisely because the thing isn't built yet. Take the stated goal as given; only question
the goal itself when an AC actively **contradicts current production behavior** in a way that changes
correctness or risk. Otherwise ask about the *how*, never the *whether*.

Internally, each question must still be traceable to:

- **What is ambiguous** — the exact AC / requirement / decision that is vague, obscure, or conflicting.
- **Why it blocks** — what cannot be built or tested until it's answered.
- **Options considered** — the 2-3 plausible interpretations (so the answer can be a quick pick).
- **Impact of each** — how the choice changes scope / build / test.

That's the reasoning scaffold — it is never what gets shown to the user. What gets **posted to Jira or
Slack** is one tweet-length line per question, plain language, no labels, no multi-line structure. Pick
whichever of these two shapes fits:

- **"we could ABC because of XYZ"** — state the proposed read and the reason for it.
- **"the AC says ABC, but if we did that we'd lose/expose/etc XYZ"** — name the conflict and its cost.

One sentence. If it needs two, it's not simple enough yet — split it into two questions or cut it.

Internal record format (unchanged reasoning, plus the line actually posted):
```
Q{n} [category: business | acceptance-criteria | technical-decision | scope]
  Ambiguity: {exact vague thing}
  Blocks:    {what stalls without an answer}
  Options:   (a) … (b) … (c) …
  Impact:    (a) … (b) … (c) …
  Jira line: "{the one-sentence tweet-style question actually posted to the user}"
```

Group questions by category for your own bookkeeping, but present them to the user as a flat, short
list — one line each, no filler. Every question must be load-bearing for the contract.

## Answering authority

- **Default: the USER answers.** The facilitator presents the questions and STOPS.
- **On explicit delegation** ("answer on my behalf" / `--groom-autonomous`): the panel proposes an
  answer **with rationale** for each question and records it as a **ratifiable decision** (flagged for
  the user to confirm), NOT a hidden assumption. The ledger row moves to `confirmed (AI-proposed,
  awaiting ratification)`, never to a silent assumption.
