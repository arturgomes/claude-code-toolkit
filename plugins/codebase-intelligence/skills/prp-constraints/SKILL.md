---
name: prp-constraints
description: >
  Feedback loop. Reads the repo's auto-generated CONSTRAINTS.md at the start
  of every prp-plan / prp-implement run, and appends a new rule whenever a verifier rejects
  (pr-reviewer, prp-pr-review, pre-pr-gate fail). Rules the system has
  already learned the hard way never need to be re-learned.
version: 1.0.0
---

# prp-constraints

Closes the feedback loop between verifier rejections and the next planning / implementation run.

## File

`<repo-root>/.claude/CONSTRAINTS.md` — one file per repo, git-tracked, auto-loaded.

If the file does not exist on first APPEND, create it with the header below. Never create on LOAD.

```
# CONSTRAINTS.md
# Auto-generated from verifier rejections.
# Loaded by prp-plan / prp-implement before planning or coding.
# One line per rule. Hand-edits allowed; group by run.
```

## Protocol — LOAD

Called by prp-plan (Pre-Phase I.5) and prp-implement (Pre-Phase I.5), right after session-memory.

1. Read `<repo-root>/.claude/CONSTRAINTS.md` — if present, inject verbatim into context.
2. If absent, skip silently. First run on a repo has no constraints to load.
3. Treat every rule as a hard constraint for this run. If a rule contradicts the new task, STOP and flag it to the user — do not silently override.

## Protocol — APPEND

Called by: `prp-pr-review` and `pre-pr-gate` on any 🔴 blocking finding or hard fail, and by the mediator / main thread when `pr-reviewer` returns a `proposed-constraint:` line (pr-reviewer is read-only and cannot write the file). Append on the feature / integration branch, never on the base branch (`../../shared/branch-rule.md`) — the rule ships in the PR.

1. Reduce the rejection to one imperative line. Lead with the rule, not the incident.
   - Good: `never disable a failing test, escalate instead`
   - Bad: `in PROJ-421 at pr-reviewer step the agent disabled test_auth_timeout which blocked merge`
2. Dedup — grep CONSTRAINTS.md for the same rule (case-insensitive, strip punctuation). Skip if present.
3. Append under a dated section. Section header format:
   ```
   ## From run YYYY-MM-DD (<TICKET or project-slug>)
   ```
   Reuse an existing section if same date + ticket; otherwise add a new one.
4. One line per rule, imperative mood, no "the agent should" / "we must" scaffolding.
5. No PII, no secrets, no file paths unless the rule is path-scoped. The shared pre-write scrub (`../../shared/secret-scrub.md`) applies.

## Example — full file after three runs

```
# CONSTRAINTS.md
# Auto-generated from verifier rejections.
# Loaded by prp-plan / prp-implement before planning or coding.
# One line per rule. Hand-edits allowed; group by run.

## From run 2026-10-28 (PROJ-421)
- never disable a failing test, escalate instead
- do not modify files outside the task's stated scope

## From run 2026-10-30 (PROJ-430)
- every claimed metric must link to a source
- if two sub-agents contradict, flag both, do not pick a side

## From run 2026-11-01 (PROJ-442)
- PR descriptions must include "What changed" and "Why"
- do not add dependencies without checking license compatibility
```

## Signals it's working

- Verifier rejection rate for repeat causes drops over time.
- CONSTRAINTS.md grows for a few weeks then plateaus — new rejections start being novel, not repeats.

## Where it does not help

- Bad task definition — a rule can't un-vague an AC.
- Rules the human already enforces in CLAUDE.md — don't duplicate; link.
- Model regressions — that's observability (`token-audit`), not here.

## Related

- Observability: `token-audit`
- Guardrails: `constitution`, `drift-guard`
- Verifiers (callers of APPEND): `prp-pr-review`, `pre-pr-gate`, and `pr-reviewer` via its `proposed-constraint:` line
