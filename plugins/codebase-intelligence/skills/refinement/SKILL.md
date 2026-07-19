---
name: refinement
description: >
  Pre-planning grooming gate for /prp-orchestrate. Convenes a scrum-style refinement panel
  (product-owner + project-manager + lead-engineer + a QA lens) that grooms a goal/ticket/PRD into an
  unambiguous, no-assumptions contract — refined acceptance criteria + scenarios + Definition of Done
  derived from the ACs. Emits a binary Definition-of-Ready verdict: READY → proceed to planning; NOT
  READY → STOP before any planning/coding and return meaningful clarifying questions for the user.
  Invoke as /prp-orchestrate's first phase, or manually on "groom this ticket", "is this ready to build".
---

# refinement — Definition-of-Ready grooming gate

Runs **before** Phase 0 (prp-plan) in `/prp-orchestrate`. Its job: reach a verdict where **no
assumptions are made** and the acceptance criteria + scenarios + Definition of Done are enough to fully
produce the goal **and satisfy QA**. If that bar isn't met, **the flow stops here** — we do not plan or
code until the assignment is understood as a contract. Grounded in the `claude-code`,
`claude-certification`, and `llm-engineering` KB domains (separate-context adversarial panel; a
harness plans first and gets the plan approved before executing).

## Model capability (read first)

Read `CI_MODEL_TIER` (`frontier | standard | light`, default `standard`). `frontier`: sub-steps are
intent. `standard`/`light`: verbatim. Invariants mandatory at EVERY tier: the empty-assumption-ledger
rule, the AC↔DoD↔scenario coverage rule, the QA sign-off, and **STOP-before-plan on NOT READY**.

## The panel (fresh, independent contexts — never self-approve)

| Role | Lens |
|---|---|
| `product-owner` | business value; authors/challenges ACs + business scenarios; is the intent met? |
| `lead-engineer` | technical feasibility; unmade technical decisions; edge/error cases; technical DoD |
| `project-manager` | scope, dependencies, contract shape; every AC ↔ task/DoD; sizing |
| QA lens (`qa-analyst`) | can QA fully verify this? every AC → a testable scenario; would QA accept it? |

Each panelist reviews independently (separate contexts — KB: Harness Patterns P06, don't self-evaluate),
then the facilitator synthesizes. Keep the panel to these roles; do not fan out wider (KB: Agent Teams
P04 — small teams).

## Procedure

1. **Ingest + context.** Take the input (goal / `JIRA-TICKET` / `prd.md`). Pull prior context first:
   **session-memory** (Obsidian vault); the **related vault work** surfaced by Step V (searched by the
   Jira **project code** — related tasks/wiki/plans/reports/sessions, with their decisions, pitfalls,
   and open failures); and, for a ticket, **Jira** (AC + comments). Cheap KB lookups via **ask-kb** for
   domain norms are allowed; this is grooming, not full research (that's Phase 0). Reuse from related
   work is stated explicitly (an AC or decision carried over is cited, never silently assumed).
2. **Independent review.** Each panelist returns their lens output (see each agent's brief) — refined
   ACs, business + edge/error scenarios, technical DoD, and per-role readiness call + questions.
3. **Synthesize the contract draft:**
   - **Refined ACs** — testable, unambiguous, traceable to value.
   - **Scenarios** — happy + material edge + failure/refusal, per AC.
   - **Definition of Done — derived from the ACs** — every AC → ≥1 DoD item; no orphan DoD.
   - **Assumption ledger** — every implicit assumption listed and driven to `confirmed` or
     `open-question`.
4. **Grade against `references/dor-rubric.md`** (the 8-point checklist + empty-ledger rule + QA sign-off).
5. **Verdict:**
   - **READY** (all 8 ✅, ledger empty, QA signs off) → persist the refinement contract to
     `02-Notes/Plans/<slug>.refinement.md` and hand off to Phase 0 (prp-plan consumes it as the AC source).
   - **NOT READY** → **STOP.** Do not invoke prp-plan, do not touch code. Emit the clarifying questions
     per the question-quality rubric, grouped by category.
6. **Loop.** After answers arrive, re-run steps 3-5 until READY (or the user halts).

## Answering authority (who resolves the questions)

- **Default — the user answers.** Present the questions and STOP. Use the harness's user-question
  mechanism if available; otherwise write them to `02-Notes/Plans/<slug>.refinement.md` under
  `## Open Questions` and wait. Do not proceed.
- **On explicit delegation** (the user says "answer on my behalf", or `--groom-autonomous` is passed):
  the panel proposes an answer **with rationale** for each question and records it as a **ratifiable
  decision** (`confirmed (AI-proposed, awaiting ratification)`) — **never a silent assumption**. The
  no-assumptions invariant still holds: an AI-proposed decision is explicit, logged, and flagged for
  the user to confirm.

## Output

- READY: `02-Notes/Plans/<slug>.refinement.md` = refined ACs + scenarios + DoD + closed assumption
  ledger → consumed by Phase 0 (prp-plan) as the authoritative AC set.
- NOT READY: the same file with an `## Open Questions` section (category-grouped, rubric-shaped) and a
  hard STOP — no planning artifact, no code.
- **session-memory (read + write):** read prior session at the start (a recurring ambiguity may already
  be answered in `## General Rules`); on the verdict, write the DoR outcome to session-memory and
  record any **recurring ambiguity as a reusable pitfall** in `## General Rules` (e.g. "this domain's
  'export' always means CSV+PDF — ask once") so the next ticket doesn't re-litigate it. The mediator
  carries this forward as the single session-memory writer once refinement passes.

## Invariants (silent unless failed)

- [ ] Assumption ledger has **zero open rows** before READY.
- [ ] Every AC has ≥1 testable scenario AND ≥1 DoD item; every DoD item traces to an AC.
- [ ] QA lens signs off (verifiable + acceptable) — else NOT READY.
- [ ] NOT READY ⇒ **no prp-plan, no code**; questions returned to the user (or AI-proposed-for-
      ratification only on explicit delegation).
- [ ] Questions are meaningful (ambiguity + blocks + options + impact) — no filler.

## Dependencies

- `references/dor-rubric.md` — the DoR checklist + question-quality rubric.
- Agents: `product-owner`, `lead-engineer`, `project-manager`, `qa-analyst`.
- Auto-invoked: `session-memory`, `ask-kb` (light), Jira injection (Atlassian MCP) for tickets.
