# Eval scenario 01 — small full-stack goal (orchestration hill-climbing fixture)

A rerunnable end-to-end fixture so future `/prp-orchestrate` tuning is **measurable** — eval-based
hill-climbing, not vibes (KB: `claude-code` / Harness Patterns & Agent-Decomposition P07/P09).

## Goal (input)

```
/prp-orchestrate "Add a user-visible 'last login' timestamp: store it on login and show it on the
profile page." --preset seathq
```

## Expected spec (refinement, Phase R)

| | |
|---|---|
| US1 (P1) | *see my last login on my profile* — **Independent Test**: log in twice as a test user, load `/profile`, the timestamp of the previous login is shown |
| FR-001 | System MUST record the login timestamp on every successful authentication |
| FR-002 | Users MUST see their previous login time on the profile page |
| SC-001 *(buildable)* | the profile page's p95 does not regress beyond +20 ms with the new field |
| SC-002 *(outcome)* | fewer "was that me?" support contacts — tracked, never a task |

A single-story goal is expected to produce **one** story slice plus a Foundational slice — not three
slices named after the three repos. A run that cuts slices by repo has confused lanes with slices and
fails the eval.

## Expected contracts (Phase 1.5 — frozen before any worktree forks)

| id | interface | provides | consumes | contract test | must fail at freeze |
|---|---|---|---|---|---|
| K1 | `LastLoginAt` on the shared user type | core-db | backend, frontend | `npm run test:run -- contracts/last-login` (core) | yes |

## Expected decomposition (project-manager)

Slices: `S0 foundational` (K1 + the migration) → `S1 US1 (P1)`.

Contract criteria (each has an executable gate):

| id | criterion | gate | acRef | slice |
|---|---|---|---|---|
| C1 | `LastLoginAt` column + shared type exists | `npm run build` (core — that IS the typecheck; there is no `type-check` script) | FR-001 | S0 |
| C2 | login writes the timestamp inside a transaction | `npm run test:run -- login` (be — `npm test` is watch-mode vitest) | FR-001 | S1 |
| C3 | profile page renders the timestamp | `npm run test:ci -- profile` (fe) | FR-002 | S1 |
| C4 | each criterion has a passing behavioral gate | per-repo test command (qa) | FR-001, FR-002 | S1 |
| C5 | profile p95 within +20 ms | `npm run bench -- profile` (fe) | SC-001 | S1 |

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

Disjointness assertion: `territoryDisjoint == true` (no glob intersects another), and each territory
must equal the **union of that lane's task `files:`** — a territory wider than its tasks is a preset
fallback leaking in, not a derivation. If the migration in C1 is a schema change, `core-db` flags
**db-migration = red blast-radius** → human gate expected.

## Expected Phase 0.5 analysis (before any worktree exists)

`spec-analyze` returns `coverage = 100%` over {FR-001, FR-002, SC-001(buildable), US1/AC1}, zero
unmapped tasks, zero territory overlaps, and K1 present with a failing contract test. SC-002 is
`outcome`-tagged and must **not** appear as uncovered work — reporting it as a coverage gap is a
false positive and fails the eval.

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
8. **Contract-freeze probe (the same regression, caught a phase earlier):** run the injected rename of
   probe 6 again, this time with K1 frozen. Expected: the rename is caught **in Phase C** as a
   frozen-contract edit 🔴 routed to `project-manager`, *before* the merge — not at Phase 5.5 after
   three worktrees of work. A run where the freeze exists and the break still reaches the integration
   gate means the freeze is decorative.
9. **Coverage probe:** delete the task implementing FR-002 from the plan. Expected: `spec-analyze`
   returns CRITICAL with FR-002 at zero coverage, `analyze.verdict = blocked`, and **no worktree is
   ever created**. A run that fans out and discovers the gap at convergence has the gate in the wrong
   place.
10. **Scope-creep probe:** add a plausible task nobody asked for (an admin export button). Expected:
    `spec-analyze` flags it HIGH as an unmapped task before it is written; if it is written anyway,
    `spec-converge` classifies it `unrequested` with `file:line` evidence and it is **reported, not
    deleted**.
11. **Checkpoint probe:** stop the run after S1's checkpoint. Expected: the branch builds, US1's
    Independent Test passes, and the feature is demoable — the checkpoint's whole claim.

## Baseline note

First run establishes the baseline (team size, # rounds to green, human-gate count, **gate cycles to a
✅ receipt per repo**, and the count of L6/L7 blockers found before the PR — every one of those is a
reviewer round-trip or a broken PR that did not happen). Record deltas on subsequent runs; a regression
in any pass criterion above fails the eval.
