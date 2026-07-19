# Eval scenario 01 — small full-stack goal (orchestration hill-climbing fixture)

A rerunnable end-to-end fixture so future `/prp-orchestrate` tuning is **measurable** — eval-based
hill-climbing, not vibes (KB: `claude-code` / Harness Patterns & Agent-Decomposition P07/P09).

## Goal (input)

```
/prp-orchestrate "Add a user-visible 'last login' timestamp: store it on login and show it on the
profile page." --preset seathq
```

## Expected decomposition (project-manager)

Contract criteria (each has an executable gate):

| id | criterion | gate | acRef |
|---|---|---|---|
| C1 | `LastLoginAt` column + shared type exists | `npm run type-check` (core) | goal |
| C2 | login writes the timestamp inside a transaction | `npm test -- login` (be) | goal |
| C3 | profile page renders the timestamp | `npm test -- profile` (fe) | goal |
| C4 | each criterion has a passing behavioral gate | `npm test` (qa) | goal |

## Expected team (2-5 active, NOT all 7)

`project-manager`, `core-db-specialist`, `backend-specialist`, `frontend-specialist`, `qa-analyst`.
(ux-specialist + pr-reviewer optional; pr-reviewer runs at verify. **Not** all 7.)

## Expected territory map (MUST be pairwise-disjoint — AC-4)

| role | territory globs |
|---|---|
| core-db-specialist | `src/db/**`, `src/types/**`, `migrations/**` |
| backend-specialist | `src/routes/**`, `src/services/**`, `src/plugins/**` |
| frontend-specialist | `src/components/**`, `src/app/**`, `src/hooks/**` |
| qa-analyst | `**/*.test.ts`, `**/*.spec.ts` |

Disjointness assertion: `territoryDisjoint == true` (no glob intersects another). If the migration in
C1 is a schema change, `core-db` flags **db-migration = red blast-radius** → human gate expected.

## Expected verdict shape (per round, per specialist)

```
Verdict: ✅ ON TRACK | ⚠️ DRIFT RISK | 🔴 DRIFTING
Territory: clean | BREACH: <files>
Blocks merge: yes iff 🔴
```

## Expected merge behavior

Serial merge order: core-db → backend → frontend (dependency order); a 🔴 on any specialist blocks
only that specialist's merge, not the others'.

## Pass criteria for THIS eval (baseline)

1. PM sizes the team to ≤5 and assigns disjoint territories (`territoryDisjoint == true`).
2. A 🔴 verdict in any round blocks that worktree's merge (inject a deliberate MUST violation to test).
3. The db-migration in C1 triggers exactly one `humanGates` entry (`reason: red-blast-radius`).
4. Final state: all contract gates exit 0; `mergeLog[]` is serial and ordered.

## Baseline note

First run establishes the baseline (team size, # rounds to green, human-gate count). Record deltas on
subsequent runs; a regression in any pass criterion above fails the eval.
