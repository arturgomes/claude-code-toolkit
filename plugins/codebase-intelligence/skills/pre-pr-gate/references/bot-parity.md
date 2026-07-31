# Bot-parity replay — say it before the bot says it

The PR is reviewed by **GitHub Copilot code review** and **Cursor bugbot**. Both read the repo's own
instruction files. So does this layer. If the gate replays the same rulebook over the same diff with
the same output format, the bots arrive at a diff that already answers them — and the humans on the
team can skip re-deriving findings that are already cited and resolved.

This is a **fidelity** exercise, not a creative review. Cite the repo's rule IDs. Do not invent rules.

---

## Step 1 — Load the rulebook for this repo

Precedence (later refines earlier; a preset `rule_sources` list overrides this default set):

1. `<repo>/CLAUDE.md`, `<repo>/.claude/**/*.md`
2. `<repo>/.github/copilot-instructions.md` — repo-wide, applies to the whole diff
3. `<repo>/.github/instructions/*.instructions.md` — **`applyTo`-scoped** (see Step 2)
4. the active preset's `rule_emphases` for the role that authored the diff

```bash
ls -1 CLAUDE.md .claude/**/*.md .github/copilot-instructions.md \
      .github/instructions/*.instructions.md 2>/dev/null
```

If a repo has **no** rule source, say so explicitly in the receipt (`L7: no rule sources found`) —
that is a finding about the repo, not a pass.

## Step 2 — Honour `applyTo` (the most common replay error)

Each `*.instructions.md` has frontmatter like:

```yaml
applyTo: "**/*.{ts,tsx}"     # quality  — all TS
applyTo: "**/*.{tsx,jsx}"    # react    — components only
applyTo: "**/*.spec.ts"      # testing  — spec files only
applyTo: "**/*.{prisma,ts,sql}"  # database
```

Intersect each instruction file's glob with the diff's file list. A rule file whose glob matches no
changed file **does not run** — and that is recorded, so nobody wonders whether it was checked:

```bash
git diff --name-only --diff-filter=ACMR "$MB"..HEAD
```

Scoping errors both ways are real failures: judging a `.sql` migration by React rules produces noise
that gets the gate ignored; skipping `testing.instructions.md` on a changed spec file lets a bot
finding through.

## Step 3 — Classify, then grade

Use `../../mediator/references/rules-rubric.md` Step 1 verbatim so the mediator's per-round verdict
and this gate never disagree:

| Bucket | Signals | Gate effect |
|---|---|---|
| MUST | must / shall / always / required; a hard numeric limit (`≤ 10`) | 🔴 BLOCK |
| MUST NOT | must not / never / prohibited / do not / strictly prohibited | 🔴 BLOCK |
| SHOULD | should / prefer / recommended; a bare checklist ID (`FQ-2`) | ⚠️ NOTE |
| SHOULD NOT | should not / avoid / discouraged | ⚠️ NOTE |

An ambiguous line defaults to **SHOULD**. Never manufacture a blocking rule the repo did not state —
a false 🔴 destroys trust in the gate faster than a missed ⚠️.

## Step 4 — Emit in the rulebook's own output format

Every one of these instruction files ends with the same demand: *rule ID → severity → offending code
→ concrete fix*. Match it exactly:

```
[MUST] FR-2 — src/components/InvoiceTable.tsx:84
  onClick={() => handleSelect(row.id)}
  fix: const handleRowSelect = useCallback((id: string) => …, []); onClick={handleRowSelect}
  why it blocks: inline arrow defeats React.memo on every child row (repo rule FR-2, MUST)
```

Rule IDs are the interface between this gate and the bots. `FR-1` means the same thing in the receipt,
in the PR body, and in a bugbot comment.

## Step 5 — What to do with each verdict

- **MUST / MUST NOT** → fix the code now, re-run the gate from L1. Never negotiate a MUST in the PR body.
- **SHOULD / SHOULD NOT** → fix if cheap; otherwise carry it in the PR body as an explicit accepted
  note with a one-line rationale. An acknowledged ⚠️ costs a reviewer zero round-trips; an unmentioned
  one costs at least one.
- **Rule collision** (two sources conflict, e.g. repo-wide "prefer `type`" vs a scoped file's
  `interface` exception) → the **more specific** source wins (scoped `applyTo` beats repo-wide); record
  the collision in the receipt so it can be fixed in the rulebook rather than re-litigated per PR.

---

## Known rule families in the seathq repos (for orientation, not a substitute for reading them)

Read the files each run — they change. This table exists so a replay that finds *none* of these is
recognised as a loading bug.

| Repo | Sources | Rule-ID families |
|---|---|---|
| `seathq-fe` | `.github/copilot-instructions.md` + `instructions/{quality,react,testing}.instructions.md` | `CP-*` `TS-*` `CF-*` `DRY-*` `NS-*` (repo-wide) · `FQ-1…16` (`**/*.{ts,tsx}`) · `FR-1…4` (`**/*.{tsx,jsx}`) · `T-1…7` `TQ-1…13` (`**/*.spec.ts`) |
| `seathq-be` | `.github/copilot-instructions.md` (repo-wide, no scoped files) | `QLT-*` `CORE-001…007` `ARCH-001…009` `SOLID-{SRP,OCP,LSP,ISP,DIP}-*` `CG-001…007` `API-*` `SEC-*` `TEST-*` `PERF-*` `MAINT-*` |
| `seathq-core` | `.github/copilot-instructions.md` + `instructions/{database,package}.instructions.md` | `QLT-*` `CORE-*` `ARCH-*` `QP-*` `VER-*` `SEC-*` (repo-wide) · `DB-1…17` (`**/*.{prisma,ts,sql}`) · `PKG-1…22` (`**/*.{ts,json}`) |
| `seathq-common` | `CLAUDE.md` only | per that file |

Three of these carry **blocking** rules that a plain typecheck/build/test pass will never surface —
they are the highest-value part of this layer:

- `CORE-002` / `PKG-9` — **no dynamic imports**. `await import(...)` compiles and ships; it is a MUST NOT.
- `ARCH-008` / `SEC-006` / `DB-10` — **no raw SQL**; Prisma only (narrow parameterized `$queryRaw`
  inside `src/extensions/` is the sole approved exception in `seathq-core`).
- `CORE-007` — **nothing above imports** except comments / file-level directives / type-only imports.
- `PKG-1` / `ARCH-001` — public API only via the `src/index.ts` barrel; a deep-path import from a
  consumer is a MUST violation even though it resolves and builds fine.
- `CG-001…007` — `seathq-be`'s commit gate expects the SOLID check, the strict-types check, and the
  test-update check to be **documented in the PR notes**. The gate receipt satisfies this literally:
  paste it.
