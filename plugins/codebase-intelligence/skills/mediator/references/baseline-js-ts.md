# Baseline JS/TS rulebook (`JT-*`) — the floor when a repo ships no rules of its own

`rules-rubric.md` classifies whatever rules the **target repo** provides. Point it at a repo with no
`CLAUDE.md`, no `.claude/`, and no `.github/instructions/` and there is nothing to classify — the
verdict collapses to drift-guard, and a diff can be merge-eligible while doing things that are defects
in any JavaScript or TypeScript codebase.

This file is that floor. It is **project-agnostic and framework-agnostic**: no React, Next, MUI,
Prisma, Nest, or repo-layout rules live here (`utils/` and `types/` conventions, theme tokens,
component patterns are all a *repo's* business, bound via its own rulebook or a preset). Everything
below holds for any JS/TS code.

## ID namespace

Every rule is `JT-<FAMILY>-<n>`. The `JT-` prefix exists so a baseline finding is never mistaken for
one of the repo's own IDs (`FR-1`, `FQ-4`, `T-5`, `CORE-002`) in a verdict, a gate receipt, or a PR
comment. **Cite the full ID.** A reviewer must be able to tell instantly whether a finding came from
their rulebook or from this floor — the two carry different authority.

## Precedence — a floor, not a ceiling

1. **The repo's own rules always win on conflict**, including when they are *laxer*. A repo that
   states "arrow functions in props are fine" overrides anything here that says otherwise.
2. **Silence is not an opt-out.** A repo that says nothing about floating promises still gets
   `JT-ASYNC-1` — that is the entire point of a floor. What overrides a baseline rule is an
   *explicit* repo rule on the same subject, not the absence of one.
3. **Never escalate.** A baseline `SHOULD` stays advisory even if the repo treats the same idea as a
   MUST elsewhere; take the repo's severity when both speak.
4. **Disable per preset**: `baseline_rules: false` turns this file off entirely;
   `baseline_rules_exclude: [JT-TEST, JT-DEP-3]` drops a family or a single rule. Record any exclusion
   in the verdict/receipt so a silenced rule is visible rather than merely absent.

## What earns a blocking severity (and what does not)

A floor that blocks on taste stops being a floor and becomes an argument. The line:

- **MUST / MUST NOT — objective defects.** The code is wrong, or is one refactor away from being
  wrong, and you can demonstrate it: a swallowed error, a floating promise, `.sort()` without a
  comparator, a nested linear scan, an unbound method callback. The author can be shown the failure.
- **SHOULD / SHOULD NOT — judgment.** Complexity thresholds, naming, explicit return types,
  abstraction taste. Real signal, worth reporting, **not** worth blocking a merge on — because the
  author cannot refute a taste verdict with evidence, and a rulebook that issues unanswerable verdicts
  gets ignored wholesale, taking the objective rules down with it.

Deliberately advisory despite being conventionally "standards": `JT-TYPE-3`, `JT-FLOW-1`, `JT-FLOW-2`,
`JT-NAME-1`, `JT-NAME-3`. **Do not promote them here.** A repo that wants them blocking says so in its
own rulebook — where it also gets to pick its own thresholds, which is exactly where that decision
belongs.

## Do not double-report what a mechanical layer already blocks

`pre-pr-gate` L6 and L8 grep for several of these deterministically. Where a layer already reports a
finding, **cite the layer, do not raise the rule again** — one finding, one line. The baseline's job
on those is the part grep cannot do: judging whether the *justification* is real.

| Overlaps with | Rules |
|---|---|
| L6 (import sweep) | `JT-MOD-4` |
| L8 (hygiene grep) | `JT-TYPE-2`, `JT-NAME-2`, `JT-TEST-4`, `JT-DEP-1` |

---

## JT-TYPE — type safety · applyTo `**/*.{ts,tsx,mts,cts}`

- **JT-TYPE-1 (MUST NOT):** `any` in an exported signature or at an I/O boundary (network, storage,
  parsing, `JSON.parse` results). Use `unknown` and narrow. Internal `any` in a local is `SHOULD NOT`.
- **JT-TYPE-2 (MUST):** every suppression (`@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`,
  `eslint-disable*`) carries an adjacent comment naming *why* and, for anything non-trivial, a ticket.
  A bare suppression is a blocking finding — it converts a compiler guarantee into a silent assumption.
- **JT-TYPE-3 (SHOULD):** exported functions declare an explicit return type. Inference is fine
  internally; a public signature that drifts silently on refactor is not. *(Advisory: correct
  inference is not a defect, and blocking on this floods any repo that never adopted the convention.)*
- **JT-TYPE-4 (MUST NOT):** non-null assertion (`!`) used to silence the compiler where a guard,
  default, or narrowing is possible.
- **JT-TYPE-5 (MUST NOT):** double assertion (`as unknown as X`, `as any as X`). A single `as X` where
  a type guard would preserve safety is `SHOULD NOT`.
- **JT-TYPE-6 (SHOULD):** validate external data once at the boundary into a typed shape, rather than
  re-checking the same fields at each use site.

## JT-FLOW — control flow · applyTo `**/*.{ts,tsx,js,jsx,mjs,cjs}`

- **JT-FLOW-1 (SHOULD):** nesting depth ≤ 3; use early returns and guard clauses to flatten.
- **JT-FLOW-2 (SHOULD):** cyclomatic complexity ≤ 10 per function (count `if`/`else`, `switch` cases,
  `&&`/`||`, ternaries, `catch`).
  *(Both advisory: the thresholds are conventional, not universal, and a repo that wants them blocking
  should say so in its own rulebook — where it can also pick its own numbers. Deeply nested or complex
  code is a smell worth reporting; it is not by itself a defect the way a swallowed error is.)*
- **JT-FLOW-3 (MUST):** a `switch`/branch over a discriminated union handles every case, with an
  exhaustiveness check (`never`) on the default. A silently unhandled variant is a defect, not a style
  question — it is the failure that survives the next variant being added.
- **JT-FLOW-4 (SHOULD):** lookup object or `Map` instead of an `if`/`switch` chain over more than
  3 cases.
- **JT-FLOW-5 (SHOULD NOT):** boolean parameters that select behavior — prefer an options object or
  two named functions.

## JT-ASYNC — asynchrony · applyTo `**/*.{ts,tsx,js,jsx,mjs,cjs}`

- **JT-ASYNC-1 (MUST NOT):** floating promise. Every promise is awaited, returned, or explicitly
  discarded with `void` **and** a comment saying why fire-and-forget is correct here. This is the
  single most common source of silent failure and lost errors in JS.
- **JT-ASYNC-2 (MUST):** every rejection path is handled — a `.then()` that is not awaited or returned
  needs a `.catch()`.
- **JT-ASYNC-3 (MUST NOT):** mixing `await` and `.then()` chains within one flow.
- **JT-ASYNC-4 (SHOULD):** independent iterations run concurrently (`Promise.all` / `allSettled`)
  rather than `await` in a loop. Sequential is legitimate for rate limits, ordering, or back-pressure —
  say which, in a comment, and the rule is satisfied.
- **JT-ASYNC-5 (SHOULD):** cancellable or long-running IO accepts an `AbortSignal`.

## JT-ERR — errors · applyTo `**/*.{ts,tsx,js,jsx,mjs,cjs}`

- **JT-ERR-1 (MUST NOT):** empty or log-only `catch` that swallows the error and continues as though
  nothing failed. Handle it, enrich and re-throw, or let it propagate.
- **JT-ERR-2 (MUST):** throw `Error` or a subclass — never a string, literal, or plain object.
- **JT-ERR-3 (MUST):** re-throwing preserves the original (`new Error(msg, { cause })`). Losing the
  cause is what turns a five-minute diagnosis into an afternoon.
- **JT-ERR-4 (MUST NOT):** exceptions as control flow for expected conditions (not-found, validation
  failure, empty result) — return a typed result instead.
- **JT-ERR-5 (SHOULD):** the message names the identifying value (`id`, key, path), not just the
  operation that failed.

## JT-MOD — modules & imports · applyTo `**/*.{ts,tsx,js,jsx,mjs,cjs}`

- **JT-MOD-1 (MUST NOT):** import-time side effects in a library module — mutating globals, starting
  timers or connections, performing IO at module scope. It breaks testability, tree-shaking, and
  import order determinism. Entry points and explicit bootstrap files are exempt.
- **JT-MOD-2 (MUST NOT):** deep import into another package's internals (`pkg/dist/*`, `pkg/src/*`,
  `pkg/lib/*`) — consume its published entry or subpath export.
- **JT-MOD-3 (MUST NOT):** circular imports between modules.
- **JT-MOD-4 (MUST):** no unused or stale imports. *(Mechanically blocked by `pre-pr-gate` L6 — cite
  the layer, do not double-report.)*
- **JT-MOD-5 (SHOULD):** named exports over a default export.

## JT-PURE — purity & state · applyTo `**/*.{ts,tsx,js,jsx,mjs,cjs}`

- **JT-PURE-1 (MUST NOT):** mutate a parameter or the contents of an argument the caller still owns.
- **JT-PURE-2 (MUST NOT):** shared mutable module-level state (a module-scope `let`/array/map written
  at runtime) — it leaks between tests and between requests.
- **JT-PURE-3 (MUST):** one responsibility per function.
- **JT-PURE-4 (MUST NOT):** a stateless class used only as a namespace for functions — export the
  functions.
- **JT-PURE-5 (SHOULD):** hidden dependencies (clock, randomness, environment, fetch) taken as
  parameters or injected, so the unit is testable without patching globals.

## JT-NAME — naming & comments · applyTo `**/*.{ts,tsx,js,jsx,mjs,cjs}`

- **JT-NAME-1 (SHOULD):** names state what the value is or what the function does. `data`, `info`,
  `handle`, `temp`, `obj`, single letters outside a tight loop or a math expression — all findings.
- **JT-NAME-2 (MUST NOT):** commented-out code in the diff. Version control already remembers it.
  *(Partly greppable — coordinate with L8.)*
- **JT-NAME-3 (SHOULD):** vocabulary consistent with the surrounding module — the same concept keeps
  the same name across the diff.
  *(`JT-NAME-1` and `JT-NAME-3` are advisory: naming is a judgment call, and a blocking verdict on it
  turns the rulebook into a taste argument the author cannot answer with evidence. Report them, argue
  them, don't gate merges on them. `JT-NAME-2` — committed commented-out code — stays blocking because
  it is objective.)*
- **JT-NAME-4 (SHOULD NOT):** comments that restate the code. Comment non-obvious business rules,
  performance or security reasoning, and known bugs (with a ticket) — nothing else.

## JT-SEC — correctness & safety · applyTo `**/*.{ts,tsx,js,jsx,mjs,cjs}`

- **JT-SEC-1 (MUST NOT):** `eval`, `new Function`, or a dynamic `require`/`import` built from
  non-constant input.
- **JT-SEC-2 (MUST NOT):** shell command built by string interpolation (`exec(\`cmd ${x}\`)`) — use the
  argv form (`execFile`/`spawn` with an array).
- **JT-SEC-3 (MUST NOT):** credentials, tokens, API keys, or URLs containing credentials committed in
  source, fixtures, or snapshots.
- **JT-SEC-4 (MUST):** `===` / `!==`, except a deliberate `== null` nullish check.
- **JT-SEC-5 (MUST NOT):** unvalidated external input reaching a filesystem path, a query string, or a
  redirect target.

## JT-TEST — tests · applyTo `**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts}`

- **JT-TEST-1 (MUST):** the test can fail for a real defect. A test that passes against a deliberately
  broken implementation is worse than no test — it certifies the bug.
- **JT-TEST-2 (MUST):** strongest appropriate assertion — `toEqual` / `toStrictEqual` /
  `toThrow(message)` over `toBeTruthy` / `toBeDefined` / bare `not.toBeNull`.
- **JT-TEST-3 (MUST):** expected values are computed independently — never by calling the code under
  test, and never by pasting its current output.
- **JT-TEST-4 (MUST NOT):** focused tests (`.only`, `fdescribe`) anywhere; `.skip` / `todo` without a
  ticket reference. *(Mechanically blocked by `pre-pr-gate` L8 — cite the layer.)*
- **JT-TEST-5 (MUST):** deterministic — no real clock, network, filesystem, or unseeded randomness.
- **JT-TEST-6 (MUST):** the test name states exactly what the assertion verifies.
- **JT-TEST-7 (SHOULD NOT):** asserting implementation details (internal call counts, private state)
  where the observable behavior could be asserted instead.
- **JT-TEST-8 (SHOULD):** edge, boundary, and error cases covered — empty, null/undefined, zero,
  maximum, failure path.
- **JT-TEST-9 (SHOULD NOT):** testing what the type system already guarantees.

## JT-FP — functional style · applyTo `**/*.{ts,tsx,js,jsx,mjs,cjs}`

JS gives you first-class functions, closures, and arrow syntax; the FP discipline that makes them pay
off is a *separate* thing, and the gap between the two is where a specific set of defects lives. This
family is the best KB-grounded one in the file — *Grokking Simplicity* (`functional-programming` domain)
teaches exactly this and its examples are written in JavaScript.

Deliberately does **not** repeat `JT-PURE` (parameter mutation, module state, injected dependencies).

- **JT-FP-1 (SHOULD):** separate **actions** (side effects), **calculations** (pure functions), and
  **data** (facts). A function that both computes a result and performs IO is two functions — extract
  the calculation, leave the action thin. *(KB: `grokking-simplicity` F01, A04 — calculations are
  testable, analyzable, and composable precisely because they are referentially transparent ·
  `functional-programming-in-scala` F01 pure core / thin shell.)*
- **JT-FP-2 (SHOULD):** implicit inputs and outputs made explicit — a calculation takes what it needs
  as arguments and returns its result, rather than reading module state or writing to it. *(KB:
  `grokking-simplicity` Functional Refactoring Checklist.)*
- **JT-FP-3 (SHOULD):** a function that both reads and writes is split into a read and a write.
  *(KB: same checklist — "Split Read/Write Operations".)*
- **JT-FP-4 (MUST NOT):** passing a method reference as a callback without binding —
  `items.forEach(obj.handle)` loses `this` and fails at runtime, not at compile time. Use
  `items.forEach(x => obj.handle(x))` or `.bind(obj)`. *(JS-specific.)*
- **JT-FP-5 (MUST NOT):** passing a multi-parameter function directly to `map` / `filter` / `forEach`,
  where the extra `(index, array)` arguments silently change behavior. The canonical case:
  `['1','2','3'].map(parseInt)` → `[1, NaN, NaN]`. Wrap it in an explicit single-argument arrow.
  *(JS-specific — and it type-checks, so nothing but a rule catches it.)*
- **JT-FP-6 (MUST NOT):** a closure capturing a mutable loop variable — `var` in a loop, or a `let`
  reassigned before an async callback runs. Capture per-iteration bindings (`let`/`const` inside the
  loop body) or pass the value as an argument. *(JS-specific.)*
- **JT-FP-7 (MUST NOT):** an object-spread accumulator inside `reduce`
  (`arr.reduce((acc, x) => ({ ...acc, [x.id]: x }), {})`) — it rebuilds the whole accumulator every
  iteration, making an O(n) transformation O(n²). Mutate a local accumulator inside the reduce, or use
  `Object.fromEntries` / a `Map`. *(JS-specific; see `JT-DSA-1`. The functional *style* here is fine —
  the copy per iteration is the defect.)*
- **JT-FP-8 (SHOULD):** compose small named functions instead of deep nesting. Where output and input
  shapes don't line up, adapt with partial application rather than a boilerplate wrapper. *(KB:
  `clojure-essential-guide` Function Design & Composition checklist — "use `comp` instead of deep
  nesting", "prefer `partial` over anonymous functions" · `domain-model-made-functional` X16, function
  shape mismatch.)*
- **JT-FP-9 (SHOULD NOT):** higher-order or point-free abstraction that costs more readability than
  the duplication it removes. *(KB: `grokking-simplicity` A13 — the book that spends five chapters
  teaching first-class functions also says plainly that overusing them reduces readability, and that
  their use "should be justified by real improvements in clarity or reduction of duplication". This
  rule is the counterweight to `JT-FP-8` and is meant to be cited **against** an over-clever diff.)*

## JT-DSA — data structures & algorithms · applyTo `**/*.{ts,tsx,js,jsx,mjs,cjs}`

Complexity defects survive review because every one of them *works* — on the reviewer's ten-row
fixture. They surface in production, at a data size nobody tested, as a timeout rather than an error.
That is what makes them a rulebook's job rather than a profiler's.

- **JT-DSA-1 (MUST):** no linear scan nested inside a loop over another collection —
  `a.find(...)` / `.includes(...)` / `.indexOf(...)` / `.filter(...)` **inside** an iteration of `b` is
  O(n·m). Build a `Map`/`Set` index once, then look up in the loop. *(KB: `thinkingfunctionallywith`
  F08 — quadratic collapses to linear by carrying the accumulated work.)*
- **JT-DSA-2 (MUST):** membership testing on a collection that can grow uses a `Set`, not
  `Array.includes`. *(KB: `pythonobject-orientedprogramming5e` A27, X28 — hash lookup vs linear scan;
  the difference is negligible only while the collection stays small, which is not a property you
  control.)*
- **JT-DSA-3 (MUST):** the structure is chosen from the **access pattern**, not from habit — `Map` for
  keyed lookup, `Set` for uniqueness, array for ordered/indexed iteration, an explicit queue structure
  for FIFO. Specifically: **`Array.prototype.shift()` in a loop is O(n) per call** — an array is not a
  queue. *(KB: `learnpythonprogramming4e` P35 · `artofwritingefficientprograms` X11 — the mismatch is
  between structure and access pattern, not structure and problem.)*
- **JT-DSA-4 (MUST):** `.sort()` always receives an explicit comparator — the default is
  **lexicographic**, so `[10, 9, 1].sort()` yields `[1, 10, 9]`. And `sort`, `reverse`, `splice`,
  `fill`, `copyWithin` **mutate in place**: copy first (`[...xs].sort(cmp)`) unless mutation is the
  intent. *(JS-specific; not from the KB.)*
- **JT-DSA-5 (MUST):** use `Map` — not a plain object — for a dictionary with dynamic or
  externally-supplied keys. Object keys collide with `Object.prototype` (`__proto__`, `constructor`),
  coerce to strings, and integer-like keys silently reorder iteration. *(JS-specific; not from the KB.)*
- **JT-DSA-6 (MUST NOT):** mutate a collection while iterating it — including `splice` inside a
  `for`/`forEach` over the same array, and adding to a `Set`/`Map` inside its own `for...of`.
- **JT-DSA-7 (MUST NOT):** recursion whose depth is driven by caller-controlled input, without an
  explicit bound. JS engines do not guarantee tail-call elimination — deep input becomes a
  `RangeError`, not a slow result. Convert to an explicit stack or bound the depth. *(JS-specific.)*
- **JT-DSA-8 (MUST NOT):** loop-invariant work left inside the loop — `Object.keys`/`entries` of an
  unchanging value, a `RegExp` recompiled per iteration, a repeated `JSON.parse`, a query or lookup
  whose result never changes. Hoist it.
- **JT-DSA-9 (SHOULD):** know which copies are shallow. `{...obj}`, `Object.assign`, `slice`, and
  `Array.from` copy one level — nested objects stay shared, and mutating them still reaches the
  caller. Copy deeply at a trust boundary, or keep the value immutable. *(KB: `fluent-python` P10 ·
  `grokking-simplicity` P07/P08, X08 — copy in **both** directions at the boundary; a one-way or
  shallow copy is the documented failure.)*
- **JT-DSA-10 (SHOULD):** a function worse than O(n log n) on caller-controlled input carries a
  one-line complexity note stating the bound and the expected n. The note is what lets the next reader
  see the cliff without re-deriving it.
- **JT-DSA-11 (SHOULD NOT):** restructure for performance without a measurement. Correctness and
  clarity first; profile, then optimize the path that actually costs. *(KB: `effective-python` A33 ·
  `code-complete` A45/A71 · `artofwritingefficientprograms` X01 · `softwarearchitecturewithkotlin` P21
  — every one of these books says the same thing independently.)* This rule cuts **against** the rest
  of the family on purpose: `JT-DSA-1`/`-2`/`-3` are asymptotic defects that are wrong at any scale,
  and are worth fixing on sight; a constant-factor rewrite is not, until measured.

## JT-DEP — dependencies · applyTo `**/package.json`

- **JT-DEP-1 (MUST):** a dependency change and its lockfile change land together, in both directions.
  *(Partly greppable — coordinate with L8.)*
- **JT-DEP-2 (MUST NOT):** a wildcard or `latest` version range.
- **JT-DEP-3 (MUST):** a new runtime dependency is justified in the PR body — what it replaces, why
  the standard library or an existing dependency does not suffice.
- **JT-DEP-4 (MUST):** in a *published library* package, anything the consumer also installs (a
  framework, a runtime, a test library) is a `peerDependency`, never a `dependency` — a duplicated
  copy in the consumer's tree is a real, hard-to-diagnose defect.

---

## Output format (same as the repo rulebooks, so findings interleave cleanly)

```
{file}:{line}: {🔴|⚠️} {JT-ID}: {what is wrong}. {concrete fix}.
```

MUST / MUST NOT ⇒ 🔴 blocking. SHOULD / SHOULD NOT ⇒ ⚠️ advisory note with a rationale. Quote the
offending line; never paraphrase a rule instead of citing its ID.

## Provenance — what is KB-grounded and what is not

Be honest about this when citing a rule; the two carry different weight in an argument.

| | Families | Basis |
|---|---|---|
| **KB-grounded** | `JT-FP` (most), `JT-DSA-1/2/3/9/10/11`, `JT-PURE` (partly) | The vault's `functional-programming` and `software-craft` domains — `grokking-simplicity` (whose examples are **in JavaScript**), `fluent-python`, `learnpythonprogramming4e`, `pythonobject-orientedprogramming5e`, `artofwritingefficientprograms`, `effective-python`, `code-complete`, `thinkingfunctionallywith`, `domain-model-made-functional`, `clojure-essential-guide`, `functional-programming-in-scala`. Language-agnostic principles, applied here to JS/TS. |
| **Not KB-grounded** | `JT-TYPE`, `JT-ASYNC`, `JT-MOD`, `JT-SEC`, `JT-DEP`, and every rule marked *(JS-specific)* | The vault holds **no JavaScript or TypeScript language book** (the only JS/TS-adjacent entries are `learnmodelcontextprotocolwithtypescript` and `building-micro-frontends`, neither about language craft). These rest on general knowledge plus observed repo idiom, and should be treated as defaults to be argued with, not citations. |

Closing that gap is a one-command job — `/add-pdf-to-kb` on a JS/TS craft title (*Effective TypeScript*,
*JavaScript: The Good Parts*, *You Don't Know JS*) would let the `JT-TYPE` / `JT-ASYNC` families cite a
source the way the FP family already does.

## Invariants

- [ ] Findings cite `JT-*` IDs in full — never bare numbers, never merged with the repo's own IDs.
- [ ] A rule's provenance is stated when it is contested — KB-grounded rules cite the book; the rest
      are defaults, and saying so is not a weakness of the rule, it is the honest strength of it.
- [ ] A repo rule on the same subject wins; baseline severity is never escalated above it.
- [ ] Rules excluded by preset are **recorded**, not silently dropped.
- [ ] Nothing framework-, layout-, or org-specific is ever added to this file — that belongs in the
      repo's own rulebook or its preset.
