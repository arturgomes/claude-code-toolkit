# `shared/` — the contracts every command, skill, and agent cites instead of restating

A rule that is restated in fifteen files is fifteen rules. They start identical, drift one edit at a
time, and the drift is invisible because nobody diffs prose. This directory is the single copy of
every cross-cutting contract; each command, skill, and agent **cites** it in one line and keeps only
what is genuinely its own.

## The files

| File | Owns | Cited by |
|---|---|---|
| `model-tier.md` | `CI_MODEL_TIER` semantics, single-tier fallback, evidence-first rule, blast-radius routing | every command + every skill with a "Model capability" section |
| `vault-persistence.md` | The persistence contract: what must be a vault note, where each artifact type lives, the write protocol, write-scope, and the no-local-mirror rule | every command + every skill that produces a durable artifact |
| `branch-rule.md` | Never write on `main`/`master`/the base branch, and the mechanical assertion | `worktree-lifecycle`, `ship`, `pre-pr-gate`, `pr-description`, `mediator`, the specialist agents |
| `git-base-detection.md` | The canonical base-branch + merge-base + changed-files snippets | anything that diffs against the base or names a base |
| `comms-register.md` | Engineering vs Stakeholder register, and the red-flag escalation shape | every agent in `agents/` |
| `secret-scrub.md` | The pre-write secret scrub + redaction marker | anything that writes a note, a PR body, or a ledger row |

## How to cite

Relative to the citing file, because that is what the model resolves:

| Citing from | Path |
|---|---|
| `skills/<name>/SKILL.md` | `../../shared/<file>.md` |
| `skills/<name>/references/<ref>.md` | `../../../shared/<file>.md` |
| `commands/<name>.md` | `../shared/<file>.md` |
| `agents/<name>.md` | `../shared/<file>.md` |

A citation states what the file is being relied on for, so a reader knows whether they need to open
it:

```
Tier semantics: `../shared/model-tier.md`. Invariants mandatory at EVERY tier **for this command**:
…the list that is actually specific to this command…
```

## The rule for adding to this directory

**A block belongs here once it appears in three or more files.** Two is a coincidence; three is a
contract with no owner. `scripts/validate.sh` C8 enforces the other direction — every file here must
be cited at least once, every citation must resolve, and a block that gets re-inlined into three or
more files after being extracted is reported as a regression.

## What does NOT belong here

- **Anything one skill owns.** The rules rubric lives in `skills/mediator/references/`, the receipt
  format in `skills/pre-pr-gate/`, the spec shape in `skills/refinement/references/`. Other files
  cite those at their owner's path. Moving an owned artifact here would only hide who maintains it.
- **Per-file specifics.** Each skill's *own* invariant list, its *own* recipient routing, its *own*
  note target. The shared file defines the vocabulary; the citing file says which words apply to it.
  Extraction that swallows the specifics is how a shared block becomes wrong for six of its callers.
