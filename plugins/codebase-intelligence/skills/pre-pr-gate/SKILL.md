---
name: pre-pr-gate
description: >
  Mandatory mechanical + bot-parity gate that runs on the INTEGRATED branch before any PR is opened.
  Reproduces locally what CI, GitHub Copilot review, and Cursor bugbot will do to the PR: CI-parity
  install/typecheck/build/test, a dangling-and-unused-import sweep that CI does not catch, a hygiene
  sweep, an applyTo-scoped replay of the repo's own .github rulebook citing real rule IDs
  (FR-1 / FQ-4 / T-5 / DB-3 / PKG-1 / CORE-002 / SOLID-*), and a constitution + frozen-contract check
  no file-scoped rulebook can make. Emits a signed gate receipt; no receipt, no PR. Auto-invoked by prp-orchestrate (Phase G), prp-implement (Phase 4.9), ship (Step 3a), and
  worktree-lifecycle EXIT. Invoke manually on "run the pre-PR gate", "is this PR-ready",
  "check before I open the PR", "will CI pass".
version: 1.0.0
---

# pre-pr-gate

The last gate before a PR exists. Everything else in this plugin judges **intent and diffs**; this
skill judges the **integrated artifact** — the branch as CI and the review bots will actually see it.

**Why it exists (the failure it prevents):** N specialist worktrees each green in isolation can merge
into a branch that does not typecheck, does not build, or carries imports of files a sibling
specialist deleted. Per-diff review cannot see that — only a run on the merged HEAD can. One
unchecked merge broke 4 PRs; this gate is the fix.

## Model capability (read first)

Read `CI_MODEL_TIER` (`frontier | standard | light`, default `standard`). `frontier`: layers are
intent, run them in the cheapest correct order. `standard`/`light`: run every layer verbatim.

**Mandatory at every tier, never skipped, never sampled, no "small diff" exemption:**
L0 command resolution · L2 typecheck · L4 build · L5 tests · L6 import sweep · L7 bot-parity replay ·
L9 whenever a constitution or a frozen contract set exists · the receipt · and **no PR on a 🔴**. A gate that is skipped because the diff "looked small" is the
exact incident this skill exists to stop.

---

## Blocking semantics

| Marker | Meaning | Effect |
|---|---|---|
| 🔴 **BLOCK** | non-zero exit on a mandatory layer, or a MUST/MUST-NOT rule violation, or an unresolved/unused import | **no PR, no merge.** Fix, re-run the gate from L1. |
| ⚠️ **NOTE** | SHOULD/SHOULD-NOT violation, or a pre-existing finding outside the diff | recorded in the receipt + PR body; does not block |
| ✅ **PASS** | layer exited 0 with pasted evidence | merge-eligible |

Two hard rules:

1. **Evidence or it did not happen.** Every layer records the *verbatim command*, its *exit code*, and
   the decisive output line. "Ran typecheck, looks fine" is a gate failure, not a pass.
2. **Never edit the gate to make it pass.** Loosening a rule, adding `// @ts-ignore`, `eslint-disable`,
   `.skip`, or narrowing a glob to dodge a finding is itself a 🔴. Fix the code.

---

## L0 — Resolve the real gate commands (do this first; it is where gates silently die)

A gate that invokes a script the repo does not have is **worse than no gate** — it errors with
`Missing script:` (or exits 0 on some runners) and the run continues believing it is green. This
layer is the fix and it is mandatory.

1. **Determine scope.** The gate runs **once per repo that has diffs**. In a multi-repo org
   (e.g. `seathq-fe` + `seathq-be` + `seathq-core`) a change touching 3 repos runs 3 gates; a
   cross-repo contract change is only green when **all** of them are green.
2. **Resolve the package manager** from the lockfile (`package-lock.json` → npm, `pnpm-lock.yaml` →
   pnpm, `yarn.lock` → yarn). Never assume npm.
3. **Prefer the preset.** If the active preset defines a `pre_pr_gate` block for this repo, those
   commands are authoritative — they were verified against the repo.
4. **Otherwise derive, then VERIFY each script exists** before running it:
   ```bash
   # every script the gate intends to run must exist, or the gate is misconfigured — not passing
   for s in build test typecheck type-check lint; do
     node -e "const s=require('./package.json').scripts||{};process.exit(s['$s']?0:1)" \
       && echo "have: $s" || echo "MISSING: $s"
   done
   ```
   A `MISSING:` script is **not** a skip. Substitute the real underlying tool (`npx tsc --noEmit`,
   `npx eslint`, `npx vitest run`) and **record the substitution in the receipt**.
5. **Mirror CI, do not invent.** Read `.github/workflows/*.y*ml` and use the same commands CI uses
   (install flags included). If CI runs `npm run build` as its typecheck, the gate runs it too — plus
   its own typecheck, because CI's coverage is the floor, not the ceiling.
6. **Never run a mutating command as a gate.** `eslint --fix`, `prettier --write`, `--update-snapshots`
   change the tree and manufacture a pass. Gate commands are read-only:
   `npx eslint <files>` not `npm run lint` when that script is `eslint --fix`.

Record in the receipt: package manager, per-layer command, and every substitution with its reason.

---

## L1 — Install parity with CI

```bash
# lockfile-gated, exactly as CI installs — catches lockfile drift before CI does
npm ci --no-audit    # or the preset/CI-specified install command
```
A lockfile-drift failure here is a 🔴: it is the same failure CI would report, found earlier. If the
install needs a private registry the local environment lacks (e.g. AWS CodeArtifact), record
`degraded: install` in the receipt and state it in the PR body — **never** silently drop the layer.

## L2 — Typecheck the WHOLE repo (mandatory — the dangling-import net)

```bash
npx tsc --noEmit -p tsconfig.json ; echo "exit=$?"
```

Whole repo, **not** changed files: a deleted export breaks its *consumers*, and consumers are by
definition outside the diff of the specialist who deleted it. TS2307 (`Cannot find module`) and
TS2305 (`has no exported member`) are the integration failures this gate exists to catch.

Non-zero ⇒ 🔴. Do not proceed to L4/L5 until it is 0 (their failures will be noise).

## L3 — Lint the changed files, zero warnings

```bash
BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'); : "${BASE:=main}"
MB=$(git merge-base HEAD "origin/$BASE")
CHANGED=$(git diff --name-only --diff-filter=ACMR "$MB"..HEAD | grep -E '\.(ts|tsx|js|jsx|mjs)$' || true)
[ -n "$CHANGED" ] && npx eslint $CHANGED --max-warnings=0 ; echo "exit=$?"
```

Scoped to changed files **on purpose**: `--max-warnings=0` over a whole legacy repo fails on
pre-existing debt and trains everyone to ignore the gate. New code carries zero warnings; old
findings are ⚠️ NOTE, not 🔴.

## L4 — Build (CI parity)

```bash
npm run build ; echo "exit=$?"
```
Whatever CI's build step is. Non-zero ⇒ 🔴. For repos where `build` *is* `tsc --noEmit`, L2 and L4
coincide — run it once and note the coincidence in the receipt.

## L5 — Tests (CI-equivalent command, non-watch)

```bash
npm run test:ci ; echo "exit=$?"     # or test:run / test -- --run — never a watch-mode script
```

- A watch-mode script (`vitest`, `jest --watch`) as the gate command hangs the run: resolve to the
  non-watch variant (`vitest run`) and record the substitution.
- **Full suite on the integration branch.** CI's changed-files-only test scoping
  (`vitest related`) is an optimization for a single PR; the merged branch runs everything.
- A test that is newly `.skip` / `.only` / `it.todo` inside the diff ⇒ 🔴 (see L8).

## L6 — Dangling + unused import sweep (🔴 — CI does NOT catch this)

The specific hole behind "unchecked dangling imports": in a repo whose CI runs only `build` + `test`
and whose ESLint preset reports `no-unused-vars` as a **warning**, an unused or stale import reaches
the PR unblocked — and the review bots flag every one of them. This gate blocks them locally instead.

`$MB` / `$CHANGED` come from L3's block — **re-derive them here if L3 was skipped** (a repo with
`lint: null` has no L3, and this layer still runs):

```bash
BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'); : "${BASE:=main}"
MB=$(git merge-base HEAD "origin/$BASE")
CHANGED=$(git diff --name-only --diff-filter=ACMR "$MB"..HEAD | grep -E '\.(ts|tsx)$' || true)
```

1. **References to files this branch deleted or moved:**
   ```bash
   git diff --diff-filter=DR --name-only "$MB"..HEAD | grep -E '\.(ts|tsx)$' \
   | sed -E 's#\.(ts|tsx)$##' | while read -r p; do
       m=$(basename "$p")
       grep -rIn --include='*.ts' --include='*.tsx' -E "from ['\"][^'\"]*/${m}['\"]" src 2>/dev/null \
         && echo "🔴 dangling import of deleted/moved module: $p"
     done
   ```
2. **Unresolved module specifiers** — already surfaced by L2 as TS2307; re-cite them here so the
   receipt shows the import story in one place.
3. **Unused imports/vars in changed files, treated as blocking regardless of the repo's severity:**
   ```bash
   [ -n "$CHANGED" ] && npx eslint $CHANGED \
     --rule '{"@typescript-eslint/no-unused-vars":"error","no-unused-vars":"off"}' --max-warnings=0
   ```
   **In a repo with no ESLint at all** (`lint: null` in the preset), this command has no config to load:
   fall back to `tsc`'s `noUnusedLocals` for the check and say so in the receipt —
   `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` (whole-repo, so pre-existing findings are
   ⚠️ NOTE and only findings inside the diff are 🔴). Never record the layer as ✅ when nothing ran.
4. **Optional deeper sweep** (only if already a devDependency — never install a tool to satisfy a
   gate): `npx knip --no-progress` or `npx depcheck` for orphaned files/exports/deps ⇒ ⚠️ NOTE.

Any finding from 1–3 ⇒ 🔴.

## L7 — Bot-parity rulebook replay (🔴 on MUST — this is what removes reviewer round-trips)

Replay the repo's **own** rulebook over the merged diff, exactly as the PR bots will, so the bots
have nothing left to say. Full procedure: `references/bot-parity.md`.

1. **Load every rule source** (preset `rule_sources` wins; otherwise this default set):
   `CLAUDE.md`, `.claude/**/*.md`, `.github/copilot-instructions.md`,
   `.github/instructions/*.instructions.md`, **plus the `JT-*` baseline floor**
   (`../mediator/references/baseline-js-ts.md`) over JS/TS files.

   The baseline is what stops this layer from passing vacuously in a repo that ships no rulebook —
   there, sources 1-4 are empty and L7 would otherwise report "0 MUST, 0 SHOULD" on a diff that floats
   promises and swallows errors. Repo rules win on conflict; baseline severity is never escalated;
   `baseline_rules: false` disables it and the receipt records that it was disabled.
2. **Honour `applyTo`.** Each `*.instructions.md` carries an `applyTo` glob in its frontmatter; its
   rules apply **only** to diff files matching that glob. A React instruction file does not judge a
   Prisma migration; a `**/*.spec.ts` testing file does not judge a component.
3. **Classify** each rule MUST / MUST NOT / SHOULD / SHOULD NOT (rubric:
   `../mediator/references/rules-rubric.md` Step 1). Bare checklist IDs default to SHOULD.
4. **Cite by rule ID with `file:line` + the offending line + a concrete fix** — the output format
   every one of these rulebooks demands. `FR-1`, `FQ-4`, `T-5`, `DB-3`, `PKG-1`, `CORE-002`,
   `SOLID-SRP-001`, `CG-003` — the ID is the point: the human reviewer can match it to the bot.
5. **MUST / MUST NOT violation ⇒ 🔴.** Fix before the PR. SHOULD ⇒ ⚠️ NOTE in the PR body with the
   rationale, so a reviewer does not spend a round-trip asking.

## L8 — Hygiene sweep (grep the diff, not the repo)

```bash
git diff -U0 "$MB"..HEAD -- '*.ts' '*.tsx' | grep -nE '^\+' | grep -nE \
  'console\.(log|debug)|debugger|@ts-(ignore|nocheck)|eslint-disable(-next-line)?( |$)|\.only\(|\.skip\(|it\.todo|TODO:|FIXME|xit\(|fdescribe'
```
Each hit is 🔴 unless the diff carries an inline justification comment (a ticket reference for a
`TODO`, a documented reason for a suppression). Also 🔴:

- staged/committed secrets or env files (`.env*`, `*.pem`, `*.key`, `credentials.json`);
- a lockfile change with no dependency change in `package.json` (drift);
- generated output committed by hand (`*.generated.*`, `dist/`, `.next/`) — regenerate via the repo's
  generate script instead;
- **a commit on the base branch itself** — the gate runs on a feature branch, never on `main`/`master`.
  This is the backstop for the never-on-`main` rule the implementing surface asserts up front: if work
  reached this layer sitting on the base, every earlier assertion was bypassed, and the finding is
  🔴 regardless of how clean the diff is.

## L9 — Constitution + frozen-contract check (🔴 — the architecture layer nothing else covers)

L7 replays the repo's file-scoped rulebook. It cannot say *"this design has more moving parts than the
problem deserves"* or *"a lane quietly changed the interface everyone else compiled against"*. L9 does.

**Skip entirely when there is no constitution and no frozen contract set** — it is a silent no-op, not
a failure.

1. **Constitution** (`.claude/constitution.md`, or the preset's `constitution:` path):
   - `Status: ratified` → every MUST/MUST-NOT violation in the diff is **🔴**, cited by principle id
     (`P-3`) with `file:line`. `Status: draft` → ⚠️ NOTE only.
   - Re-run the three Phase -1 gates against the **integrated** result, not the plan's prediction:
     `G-SIMPLICITY` (component count), `G-ANTI-ABSTRACTION` (wrappers whose second consumer never
     materialized), `G-INTEGRATION-FIRST` (contract tests exist and were failing first).
   - **A carried violation needs its Complexity Tracking row to already exist in `plan.md`, complete
     in all three columns.** A missing row, an empty "simpler alternative rejected because", or a row
     written during this run to excuse this diff ⇒ 🔴. The row is the argument; without it the
     violation is just a violation.
2. **Frozen contracts** (`orchestration-state.json → contracts[]`):
   - a file in the frozen set modified by anything other than a recorded amendment ⇒ 🔴;
   - a contract whose test does not run, or whose `failedAtFreeze` is false ⇒ 🔴 (it proved nothing);
   - a symbol a consumer imports that is absent from the frozen set ⇒ 🔴 (L2 usually catches this
     first; cite both so the receipt tells the whole story in one place).
3. **Never widen a threshold to pass.** Editing the constitution, its component budget, or a contract
   during the gate run is itself a 🔴 — the same rule as loosening a lint severity.

Carry every surviving Complexity Tracking row into the receipt. The reviewer should meet the
justification and the code that cost it on the same screen.

---

## The gate receipt (no receipt ⇒ no PR)

Write `<repo>/.claude/pre-pr-gate.json` (schema: `references/gate-receipt.schema.json`) **and** emit
this block for the PR body and the caller:

```
### Pre-PR gate — {repo} @ {short-sha} — {✅ PASS | 🔴 BLOCK}
L0 commands   : pm={npm|pnpm|yarn} · substitutions: {script → real command, or none}
L1 install    : {✅|🔴|degraded} `{cmd}` exit={n}
L2 typecheck  : {✅|🔴} `{cmd}` exit={n} {first error line, if any}
L3 lint       : {✅|🔴|n/a} `{cmd}` exit={n} ({k} changed files)
L4 build      : {✅|🔴} `{cmd}` exit={n}
L5 tests      : {✅|🔴} `{cmd}` exit={n} ({passed}/{total})
L6 imports    : {✅|🔴} dangling={n} unresolved={n} unused={n}
L7 bot-parity : {✅|🔴} MUST={n} SHOULD={n} — sources: {rule files applied}
                baseline JT-*: {applied | disabled | excluded: JT-TEST, …} MUST={n} SHOULD={n}
L8 hygiene    : {✅|🔴} {findings or none}
L9 arch       : {✅|🔴|n/a} constitution={ratified|draft|none} MUST={n} · contracts frozen={n} violated={n}
                complexity rows carried: {violation → simpler alternative rejected because …, or none}
Blockers      : {rule-ID/layer + file:line, one per line, or "none"}
Verdict       : {✅ PR-ready | 🔴 BLOCKED — do not open the PR}
```

Multi-repo runs emit one block per repo plus an aggregate verdict: **🔴 if any repo is 🔴.**

**Put the block in the PR description.** That is what lets the rest of the team skip re-checking:
the bots' own rule IDs are already answered, with commands and exit codes, before anyone looks.

## Re-run rule

A 🔴 is fixed by changing the code, then **re-running the gate from L1** on the new HEAD — never by
re-reading the old receipt. A receipt is bound to a commit SHA; a receipt whose `sha` is not the
current HEAD is **stale and invalid**, and a stale receipt is treated as no receipt.

Bounded loop: at most **3** fix→re-run cycles. Still 🔴 after 3 ⇒ stop, report the surviving
blockers, and hand back to the human. Do not open the PR to "let CI decide".

---

## Invariants (checked silently; reported only on failure)

- [ ] Every intended gate command was verified to exist (L0) — no `Missing script:` treated as a pass.
- [ ] No mutating command used as a gate.
- [ ] Typecheck + build ran on the **whole** repo at the **integrated** HEAD, not per-worktree.
- [ ] Tests ran non-watch, full suite.
- [ ] Dangling/unresolved/unused imports block, even where the repo's own lint only warns.
- [ ] Rule sources loaded and applied `applyTo`-scoped; MUST violations block; findings cite rule IDs.
- [ ] Constitution (when ratified) re-checked on the integrated result; every carried violation has a
      complete 3-column Complexity Tracking row that predates this run.
- [ ] No frozen contract modified outside a recorded amendment; every contract test ran and had failed
      at freeze time.
- [ ] Receipt written, SHA-bound, and pasted into the PR body.
- [ ] No PR / no merge while the verdict is 🔴. No exemption for diff size.

## What this skill does NOT do

- Does not open, approve, or merge the PR — it only permits or blocks (`ship` still opens it).
- Does not install tools, add dependencies, add CI jobs, or edit the repo's rule files.
- Does not rewrite `ship`, `session-memory`, `worktree-lifecycle`, or the mediator's per-round judging.
- Does not replace CI — it front-runs it, and always treats CI's coverage as the minimum.
- Does not silence a finding by config change: config-loosening to pass is itself a 🔴.

## Dependencies

`git`, the repo's package manager, the repo's own toolchain (`tsc` / `eslint` / test runner) — all via
`npx`, nothing new installed. Reads the active `presets/*.yaml` (`pre_pr_gate`, `rule_sources`).
Shares the rule-classification rubric with `../mediator/references/rules-rubric.md`.
References: `references/bot-parity.md`, `references/gate-receipt.schema.json`.
