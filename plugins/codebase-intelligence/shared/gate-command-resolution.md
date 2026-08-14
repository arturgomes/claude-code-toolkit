# Resolving a real gate command

A gate that invokes a script the repo does not have is **worse than no gate**: it errors with
`Missing script:` — or exits 0 on some runners — and the run continues believing it is green. Any file
that runs a build / test / typecheck / lint as a gate resolves it through this contract first.

## 1. Resolve the package manager from the lockfile

`package-lock.json` → npm · `pnpm-lock.yaml` → pnpm · `yarn.lock` → yarn. **Never assume npm.**

## 2. Prefer the preset

If the active preset defines a `pre_pr_gate` block for this repo, those commands are authoritative —
they were verified against the repo.

## 3. Otherwise derive, then verify every script exists before running it

```bash
node -e "const s=require('./package.json').scripts||{};for(const k of ['build','test','typecheck','type-check','lint'])console.log((s[k]?'have ':'MISSING ')+k+(s[k]?': '+s[k]:''))"
```

**A `MISSING` script is not a skip.** It is a misconfiguration. Substitute the real underlying tool
(`npx tsc --noEmit`, `npx eslint`, `npx vitest run`) and **record the substitution with its reason**
wherever this run keeps its evidence — the receipt, the report, the ledger row.

## 4. Mirror CI, do not invent

Read `.github/workflows/*.y*ml` and use the commands CI actually uses, install flags included. If CI
runs `npm run build` as its typecheck, run that too — **plus** the dedicated typecheck. CI's coverage
is the floor, never the ceiling.

## 5. Never run a mutating command as a gate

`eslint --fix`, `prettier --write`, `--update-snapshots` change the tree and manufacture a pass. Gate
commands are read-only: `npx eslint <files>`, not `npm run lint` when that script is `eslint --fix`.

## 6. Never run a watch-mode command as a gate

A bare `vitest` or `jest --watch` hangs the run forever. Resolve to the non-watch variant
(`vitest run`, `jest --ci`) and record the substitution.

## 7. Loosening a gate to pass it is itself a failure

Lowering a lint severity, widening a glob, adding `@ts-ignore` / `eslint-disable` / `.skip`, or
relaxing a threshold so the gate goes green is a 🔴 and a `drift-guard` Q5 failure — not a fix.
