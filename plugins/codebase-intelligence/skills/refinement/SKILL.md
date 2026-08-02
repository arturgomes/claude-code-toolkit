---
name: refinement
description: >
  Pre-planning grooming gate for /prp-orchestrate. Convenes a scrum-style refinement panel
  (product-owner + project-manager + lead-engineer + a QA lens) that grooms a goal/ticket/PRD into an
  unambiguous, no-assumptions contract — prioritized user stories that are each independently
  testable, numbered functional requirements (FR-###), measurable technology-agnostic success criteria
  (SC-###), scenarios, and a Definition of Done derived from the ACs. Closes ambiguity with a bounded
  clarify loop (max 5 questions, one at a time, multiple-choice with a recommendation) whose answers
  are written back into the spec, and scores the result against a generated requirements checklist.
  Emits a binary Definition-of-Ready verdict: READY → proceed to planning; NOT READY → STOP before any
  planning/coding. Invoke as /prp-orchestrate's first build phase, or manually on "groom this ticket",
  "is this ready to build".
version: 2.0.0
---

# refinement — Definition-of-Ready grooming gate

Runs **before** Phase 0 (prp-plan) in `/prp-orchestrate`. Its job: reach a verdict where **no
assumptions are made** and the stories + requirements + success criteria + scenarios + Definition of
Done are enough to fully produce the goal **and satisfy QA**. If that bar isn't met, **the flow stops
here** — we do not plan or code until the assignment is understood as a contract. Grounded in the
`claude-code`, `claude-certification`, and `llm-engineering` KB domains (separate-context adversarial
panel; a harness plans first and gets the plan approved before executing).

## Model capability (read first)

Read `CI_MODEL_TIER` (`frontier | standard | light`, default `standard`). `frontier`: sub-steps are
intent. `standard`/`light`: verbatim. Invariants mandatory at EVERY tier: the empty-assumption-ledger
rule, the story→FR→SC→scenario→DoD coverage rule, **every story independently testable**, the QA
sign-off, the **5-question ceiling**, and **STOP-before-plan on NOT READY**.

## The panel (fresh, independent contexts — never self-approve)

| Role | Lens |
|---|---|
| `product-owner` | business value; authors the prioritized user stories, FR-###, SC-###, business scenarios; is the intent met? |
| `lead-engineer` | technical feasibility; unmade technical decisions; edge/error cases; technical DoD; which SCs need buildable work |
| `project-manager` | scope, dependencies, contract shape; story independence; every FR ↔ DoD; sizing |
| QA lens (`qa-analyst`) | can QA fully verify this? every FR → a testable scenario; every story → an Independent Test; would QA accept it? |

Each panelist reviews independently (separate contexts — KB: Harness Patterns P06, don't self-evaluate),
then the facilitator synthesizes. Keep the panel to these roles; do not fan out wider (KB: Agent Teams
P04 — small teams).

---

## The output artifact — `spec.md` (shape: `references/spec-template.md`)

The refinement contract is a real spec, not a note. Its mandatory sections:

1. **User stories, prioritized (P1, P2, P3…)** — each with a *why this priority*, and an
   **Independent Test**: how this story is verified **on its own**, delivering value **on its own**.
   P1 is the MVP slice. A story that cannot be tested without another story is not a story — merge it
   or re-cut the slice. This is the section the whole downstream flow slices work by: the mediator
   builds one round per story and checkpoints after each, so a badly cut story costs a whole round.
2. **Functional Requirements** — `FR-001…`, each "System MUST …", observable and verifiable.
3. **Success Criteria** — `SC-001…`, **measurable and technology-agnostic**: a number, a unit, a
   threshold ("p95 under 200 ms", "completes in under 2 minutes", "zero PII in logs"). Never a
   library, an endpoint, or a file. Mark each `buildable` (needs work: a budget, an audit hook, a load
   harness) or `outcome` (a post-launch metric nobody implements). Only `buildable` SCs become tasks.
   Without this section "done" collapses to "the gates went green", which can be true of a useless
   feature.
4. **Acceptance scenarios** per story — Given/When/Then, spanning happy + material edge + failure.
5. **Edge cases**, **Assumptions**, **Out of scope** (the drift-guard hard boundary).
6. **Definition of Done**, derived from the FRs — every FR → ≥1 DoD item, no orphan DoD.
7. **Clarifications** — the dated session log of every question asked and answered (Step 4).

**Dual-write (both, always — unless the preset disables the repo copy):**

- repo: `specs/<TICKET-or-slug>/spec.md` on the working branch — so intent ships in the PR next to
  the code and a teammate can review it in the diff;
- vault: `02-Notes/Plans/<slug>.refinement.md` — so it stays BM25-searchable across tickets.

Preset key `spec_artifacts: repo | vault | both` (default `both`); `repo_path` overrides `specs/`.

---

## Procedure

### 0. Reuse-or-groom (idempotent — `--spec <path>`)

If the caller passed `--spec <path>` and the file exists, **do not re-groom it.** Load it and
re-validate only:

- `Status: READY`, and
- the assumption ledger has **zero `open` rows**, and
- the DoR rubric still passes against the file's own content.

All three hold ⇒ emit READY immediately and hand off to Phase 0; the panel never convenes. This is
what makes a parked spec resumable, and what stops a re-run from re-asking questions the user already
answered.

Any check fails ⇒ treat the file as a **draft**, not a contract: keep its answered `## Clarifications`
(they are still answers — never re-ask them), and resume at step 3 on what is still open. A spec whose
`Status` is `NOT READY` resumes the clarify loop with a **fresh 5-question budget**, since the
ceiling is per session.

### 1. Ingest + prior context

Take the input (goal / `JIRA-TICKET` / `prd.md`). Pull prior context first: **session-memory**
(Obsidian vault); the **related vault work** surfaced by Step V (searched by the Jira **project
code** — related tasks/wiki/plans/reports/sessions, with their decisions, pitfalls, and open
failures); and, for a ticket, **Jira** (AC + comments). Cheap KB lookups via **ask-kb** for domain
norms are allowed; this is grooming, not full research (that's Phase 0). Reuse from related work is
stated explicitly — an AC or decision carried over is cited, never silently assumed. Load the
**constitution** if present: a principle can itself make a requirement non-negotiable or forbidden.

### 2. Independent panel review

Each panelist returns their lens output (see each agent's brief) — stories with priorities, FRs, SCs,
business + edge/error scenarios, technical DoD, per-role readiness call + candidate questions.

### 3. Ambiguity + coverage scan (taxonomy — do this before writing any question)

Mark each category **Clear / Partial / Missing**. This map is what makes the question budget spend
well; it is internal unless no questions get asked.

| Group | Categories |
|---|---|
| Functional scope | core goals, success criteria, explicit out-of-scope, roles/personas |
| Domain & data | entities, attributes, relationships, identity/uniqueness, lifecycle/state, volume |
| Interaction & UX | critical journeys, error/empty/loading states, accessibility, localization |
| Non-functional | performance, scalability, reliability, observability, security/privacy, compliance |
| Integration | external services + their failure modes, import/export formats, protocol/versioning |
| Edge & failure | negative paths, rate limits, conflict resolution, concurrency |
| Constraints | technical constraints, explicit tradeoffs, rejected alternatives |
| Terminology | canonical glossary, banned synonyms |
| Completion | AC testability, measurable DoD indicators, story independence |
| Placeholders | TODO markers, unquantified adjectives ("robust", "intuitive") |

A Partial/Missing category becomes a **candidate question** — unless the answer would not change
implementation or validation, or it genuinely belongs to planning (a library/API fact answerable by
ask-kb / Context7 is **not** a user question; route it to Phase 0).

### 4. The clarify loop (bounded, interactive, written back)

Full format rules: `references/clarify-protocol.md`.

- **Maximum 5 questions for the whole session.** Retries on the same question don't count. Rank
  candidates by *impact × uncertainty*, and cover the highest-impact unresolved categories first —
  never two low-impact questions while security posture is unresolved.
- **One question at a time.** Never reveal the queue.
- **Every question is answerable by picking**, not by writing an essay: 2-4 mutually exclusive
  options, or a ≤5-word short answer. Use the harness's `AskUserQuestion` tool when available — one
  question per call, options as the choices, the recommendation first and labelled
  `(Recommended)`.
- **Lead with a recommendation and its reason**, then the options, then one plain-language *why it
  matters* line (the stake for acceptance or shipping). A user who does not know this codebase must
  be able to answer from the question alone. Terse is fine; a bare topic label
  ("Acceptance device matrix (FR-023)") is not a question and is rejected.
- **Integrate each answer immediately**, before asking the next:
  - append `- Q: <question> → A: <answer>` under `## Clarifications` → `### Session YYYY-MM-DD`;
  - apply it to the owning section — functional ambiguity → FR; role/interaction → story; data shape
    → entities; non-functional → **SC-### with a number**; edge case → Edge Cases; terminology →
    normalize the term everywhere;
  - **replace** the now-invalid statement rather than leaving both. No contradictory text survives.
  - save the file after each integration (atomic overwrite) — a lost context must not lose answers.
- **Stop early** when the remaining queue stops being load-bearing, when the user says done, or at 5.
  Anything unresolved at the ceiling is listed under **Deferred** with the reason, and a deferred
  *high-impact* item is a NOT READY, not a shrug.

### 5. Generate + score the requirements checklist ("unit tests for English")

Full generation rules: `references/checklist-generation.md`. Write
`specs/<slug>/checklists/requirements.md` with `CHK001…` items that test **the requirements**, not the
implementation:

- ✅ "Is 'prominent' quantified with a size or position?" `[Clarity]`
- ✅ "Is the behavior specified when the assigned user is deleted?" `[Edge Cases]`
- ❌ "Verify the button click works" — that is a test case, not a requirements test.

Score it. **Re-score after every clarification** and report before/after counts
("12/16 → 15/16 items passing") with the newly-passing items and any regressions. A regression means
an answer broke something that previously held — investigate it, never just re-check the box.

### 6. Synthesize + grade

Assemble the contract, then grade against `references/dor-rubric.md` (the 12-point checklist +
empty-ledger rule + QA sign-off + checklist threshold).

### 7. Verdict

- **READY** — all checks ✅, ledger empty, QA signs off, checklist ≥ threshold. Persist `spec.md`
  (repo + vault) and hand off to Phase 0; `/prp-plan` consumes it as the authoritative requirement
  set.
- **NOT READY** — **STOP.** Do not invoke prp-plan, do not touch code. The unanswered questions stay
  in `## Open Questions`, and the flow waits.

### 8. Loop

After answers arrive, re-run 4-7 until READY (or the user halts). The 5-question ceiling is **per
session**; a fresh session after real answers gets a fresh budget.

---

## Answering authority (who resolves the questions)

- **Default — the user answers.** Present via `AskUserQuestion` (or write to `## Open Questions` and
  stop). Do not proceed.
- **On explicit delegation** (the user says "answer on my behalf", or `--groom-autonomous`): the panel
  proposes an answer **with rationale** for each question and records it as a **ratifiable decision**
  (`confirmed (AI-proposed, awaiting ratification)`) — **never a silent assumption**. The
  no-assumptions invariant still holds: an AI-proposed decision is explicit, logged in the
  Clarifications session as AI-proposed, and flagged for the user to confirm.

## Output

- READY: `specs/<slug>/spec.md` + `checklists/requirements.md` (repo) and
  `02-Notes/Plans/<slug>.refinement.md` (vault) — stories + FR + SC + scenarios + DoD + closed
  ledger + Clarifications log → consumed by Phase 0 as the authoritative requirement set.
- NOT READY: the same files with `## Open Questions` and a hard STOP — no planning artifact, no code.
- **session-memory (read + write):** read prior session at the start (a recurring ambiguity may
  already be answered in `## General Rules`); on the verdict, write the DoR outcome and record any
  **recurring ambiguity as a reusable pitfall** in `## General Rules` (e.g. "this domain's 'export'
  always means CSV+PDF — ask once") so the next ticket doesn't re-litigate it. The mediator carries
  this forward as the single session-memory writer once refinement passes.

## Invariants (silent unless failed)

- [ ] Assumption ledger has **zero open rows** before READY.
- [ ] Every story has a priority **and** an Independent Test; P1 alone is a viable slice.
- [ ] Every FR has ≥1 testable scenario AND ≥1 DoD item; every DoD item traces to an FR.
- [ ] Every SC is measurable + technology-agnostic and tagged `buildable` or `outcome`.
- [ ] ≤5 questions asked; each answerable by picking; every answer written back into the spec and
      logged under a dated Clarifications session.
- [ ] Requirements checklist generated and re-scored after each clarification; regressions reported.
- [ ] QA lens signs off (verifiable + acceptable) — else NOT READY.
- [ ] NOT READY ⇒ **no prp-plan, no code**.

## Dependencies

- `references/dor-rubric.md` — the DoR checklist + question-quality rubric.
- `references/spec-template.md` — the contract's shape.
- `references/clarify-protocol.md` — the bounded question loop.
- `references/checklist-generation.md` — the requirements checklist generator.
- Agents: `product-owner`, `lead-engineer`, `project-manager`, `qa-analyst`.
- Auto-invoked: `session-memory`, `ask-kb` (light), `constitution` (read-only), Jira injection
  (Atlassian MCP) for tickets.
