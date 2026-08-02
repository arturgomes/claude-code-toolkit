# Orchestration presets

A **preset** binds the seven generic role agents (`agents/frontend-specialist.md`, …) to concrete
repos, stacks, rules, and gotchas — **without** putting any org specifics into the agent bodies
(AC-3). The agents stay portable; a preset is the swappable configuration layer.

`/prp-orchestrate "<goal>" --preset <name>` loads `presets/<name>.yaml`. With no `--preset`, the
orchestrator runs in generic single-repo mode (roles bind to `self` = the current repo).

## Schema

```yaml
preset: <name>                 # preset identifier
description: <one-line>

spec_artifacts: both           # both (default) | repo | vault — where spec.md / plan.md / tasks.md /
spec_repo_path: specs          #   contracts/ / checklists/ are written. The repo copy is what makes
                               #   intent reviewable in the PR next to the code; the vault copy is
                               #   what keeps it BM25-searchable across tickets.

constitution: .claude/constitution.md   # OPTIONAL — architectural non-negotiables + the three
                               #   Phase -1 gates. Read by refinement, prp-plan, spec-analyze, the
                               #   mediator's round verdict, and pre-pr-gate L9. Absent ⇒ silent
                               #   no-op; Status: draft ⇒ advisory only; Status: ratified ⇒ a MUST
                               #   violation is 🔴 and blocks fan-out, merge, and PR.

roles:                         # one entry per role you want bound (activate 2-5 per goal, not all 7)
  <role-name>:                 # MUST be one of the seven agent names
    repo: <repo-id-or-path>    # where this role's worktree is created; "self" = current repo
    stack: [<tech>, ...]       # frameworks/langs — drives Context7 lookups
    rule_emphases:             # role-specific .claude/ rules the mediator weights when judging
      - "<MUST|SHOULD|MUST NOT|SHOULD NOT>: <rule>"
    gotchas:                   # known traps injected into the specialist's brief (teammates wake
      - "<gotcha>"             #   with zero context — KB: Agent Teams P01)
    validation:                # executable gates this role's diff must pass
      - "<shell command>"
    territory:                 # glob patterns this role EXCLUSIVELY owns; MUST be pairwise-disjoint
      - "<glob>"               #   with every other active role's territory, within a slice (AC-4).
                               #   These are the FALLBACK bounds: when the plan's tasks carry  files: ,
                               #   the actual territory is DERIVED from the union of those paths, which
                               #   is what lets spec-analyze prove disjointness instead of trusting it.
                               #   A derived territory that escapes these globs is a preset/plan
                               #   mismatch — report it, do not silently widen the preset.

org_gotchas:                   # gotchas that apply to every role in this org
  - "<gotcha>"

repos:                         # OPTIONAL but STRONGLY recommended — per-repo pre-PR gate commands,
  <repo-name>:                 #   consumed by the  pre-pr-gate  skill (prp-orchestrate Phase 5.5).
    package_manager: npm       #   Without this block the gate derives commands and must verify each
    ci_workflow: <path|null>   #   one exists; with it, the commands are authoritative.
    pre_pr_gate:               # every command VERIFIED to exist in that repo's package.json
      install:   "<cmd>"       #   lockfile-gated, same as CI
      generate:  "<cmd>"       #   OPTIONAL — codegen (e.g. prisma:generate) that must precede typecheck
      typecheck: "<cmd>"       #   whole-repo; use  npx tsc --noEmit  if no script exists
      lint:      "<cmd>|null"  #   MUST be non-mutating (never  eslint --fix );  null  = repo has no linter
      build:     "<cmd>"       #   CI parity
      test:      "<cmd>"       #   full suite, NON-watch (never a bare  vitest / jest --watch )
      unused_imports: "<cmd>"  #   the dangling/unused-import check (L6) — blocking even if the repo warns
    rulebook:                  # the files pre-pr-gate L7 replays, in precedence order; annotate the
      - "<path>"               #   applyTo glob + rule-ID family per file
    blocking_rule_families: ["FR-1", ...]   # rule IDs treated as MUST for this repo
    notes: ["<cross-repo or gate caveat>"]

baseline_rules: true           # OPTIONAL (default true) — apply the project-agnostic JS/TS floor
                               #   (skills/mediator/references/baseline-js-ts.md, JT-* ids) on top of
                               #   whatever the repo ships. A repo with no rulebook classifies to
                               #   NOTHING without this, so a diff can be merge-eligible while
                               #   floating promises or swallowing errors. Repo rules win on conflict;
                               #   baseline severity is never escalated above the repo's.
baseline_rules_exclude:        # OPTIONAL — drop a family or a single rule. Exclusions are RECORDED in
  - "JT-TEST"                  #   the verdict and the gate receipt, never silently dropped, so a
  - "JT-DEP-3"                 #   switched-off rule stays visible.

rule_sources:                  # OPTIONAL — where this org's MUST/SHOULD rules live. Omit to use the
  - "CLAUDE.md"                #   mediator's default discovery (CLAUDE.md, .claude/*.md,
  - ".claude/**/*.md"          #   .github/copilot-instructions.md, .github/instructions/*.instructions.md).
  - ".github/copilot-instructions.md"
  - ".github/instructions/*.instructions.md"   # applyTo-scoped Copilot instruction files
```

## Rules

- **`territory` globs must be pairwise-disjoint** across all activated roles — the mediator asserts
  this in Phase B and aborts if any pair intersects (AC-4). This is the same no-collision guarantee
  the whole feature provides.
- **No org specifics in agent bodies.** If you find yourself wanting to edit an `agents/*.md` to add
  a stack or repo, add it here instead.
- **`role-name` keys must match the agent filenames** exactly: `frontend-specialist`,
  `backend-specialist`, `core-db-specialist`, `qa-analyst`, `project-manager`, `ux-specialist`,
  `pr-reviewer`.
- **Red blast-radius emphases** (auth / payments / deploy / db-migration) cause the mediator to
  escalate to a human rather than auto-merge (AC-1).
- **Every command in `validation` / `pre_pr_gate` must be verified to exist** in that repo's
  `package.json` before it is written here. A preset naming a script the repo lacks (`npm run type-check`
  in a repo with no such script) produces a gate that errors or silently no-ops — worse than no gate.
  Check with:
  ```bash
  node -e "const s=require('./package.json').scripts||{};for(const k of ['build','test','typecheck','type-check','lint'])console.log((s[k]?'have ':'MISSING ')+k+(s[k]?': '+s[k]:''))"
  ```
- **Gate commands must be read-only and non-watch.** `eslint --fix` / `prettier --write` mutate the tree
  and manufacture a pass; a bare `vitest` / `jest --watch` hangs the run. Record the real command instead.
- **`ci_workflow` is the floor, not the ceiling.** Read it so the gate matches CI's install flags and
  build step — then add what CI omits (most repos here never run ESLint in CI, which is exactly how
  unused/dangling imports reach the PR bots).

## Shipped presets

| Preset | Roles bound | Notes |
|---|---|---|
| `seathq` | fe → Next15/MUI7 · be → Fastify/TypeBox · core → shared DB/types (PascalCase quoted, D-1/D-3) · qa/pm/ux/pr | npm-ci lockfile gate; db-migration = red; per-repo `pre_pr_gate` + `rulebook` for all 4 repos (fe/be/core/common) |

To add a preset: copy `seathq.yaml`, retarget `roles.*.repo` / `stack` / `territory`, and run
`/prp-orchestrate "<goal>" --preset <yourname>`.
