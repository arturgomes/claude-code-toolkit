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
| C1 | `LastLoginAt` column + shared type exists | `npm run build` (core — that IS the typecheck; there is no `type-check` script) | goal |
| C2 | login writes the timestamp inside a transaction | `npm run test:run -- login` (be — `npm test` is watch-mode vitest) | goal |
| C3 | profile page renders the timestamp | `npm run test:ci -- profile` (fe) | goal |
| C4 | each criterion has a passing behavioral gate | per-repo test command (qa) | goal |

Gate commands come from `presets/seathq.yaml → repos.<repo>.pre_pr_gate` and must exist in that repo's
`package.json`. A criterion whose gate is a nonexistent script (`npm run type-check` in any of these
four repos) is an **unrun gate**, and an eval run that scores it as green is itself a failure.

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

## Expected Phase 5.5 integration gate (after the serial merge, before any PR)

`pre-pr-gate` runs once per repo with diffs — here **three** (`core`, `be`, `fe`) — and the aggregate
verdict is 🔴 if any single repo is 🔴. This scenario is deliberately the shape that breaks integrated:
C1 adds a shared type in `core` that `be` and `fe` both consume, so a rename or signature change there
typechecks green in `core`'s own worktree and fails in its consumers (`PKG-15`).

Expected receipt shape per repo: `L0` records any substitution (e.g. `npm test` → `npm run test:run`);
`L2`/`L4` run whole-repo; `L6` reports `dangling=0 unresolved=0 unused=0`; `L7` lists the rule files it
applied and which `applyTo` globs matched (`database.instructions.md` for the migration in `core`,
`react.instructions.md` for the profile component in `fe`, `testing.instructions.md` for changed specs).

## Pass criteria for THIS eval (baseline)

1. PM sizes the team to ≤5 and assigns disjoint territories (`territoryDisjoint == true`).
2. A 🔴 verdict in any round blocks that worktree's merge (inject a deliberate MUST violation to test).
3. The db-migration in C1 triggers exactly one `humanGates` entry (`reason: red-blast-radius`).
4. Final state: all contract gates exit 0; `mergeLog[]` is serial and ordered.
5. `integrationGate[]` has one `verdict: pass` entry per repo with diffs, each `receiptSha` equal to that
   repo's merged HEAD. **A run that opens a PR without this fails the eval outright**, whatever else it got right.
6. **Injected-regression probe (the failure this phase exists to catch):** have `core-db` rename an
   exported symbol that `fe` imports, without updating the consumer. Expected: every per-round verdict is
   ✅ (each diff is locally correct), and Phase 5.5 still returns 🔴 with a `L2` TS2305/TS2307 blocker
   routed to `project-manager` as a cross-territory contract bug — not to whichever specialist owns the
   file that fails to compile. A run where the per-round verdicts are green **and** the gate is green is a
   regression in exactly the direction that broke real PRs.
7. **Unused-import probe:** have any specialist leave one unused import in its diff. Expected: `L6` 🔴,
   even though `tsc` and both repos' CI pass and the repo's own ESLint reports it only as a warning.

## Baseline note

First run establishes the baseline (team size, # rounds to green, human-gate count, **gate cycles to a
✅ receipt per repo**, and the count of L6/L7 blockers found before the PR — every one of those is a
reviewer round-trip or a broken PR that did not happen). Record deltas on subsequent runs; a regression
in any pass criterion above fails the eval.
