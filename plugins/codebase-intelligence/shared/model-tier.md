# Model capability — `CI_MODEL_TIER`

The single definition of tier semantics for every command, skill, and agent in this plugin. Cite it;
do not restate it.

## Tier semantics

Everything here is **model-agnostic**. Read `CI_MODEL_TIER` — values `frontier` | `standard` |
`light`, default **`standard`** when unset or unknown.

- **`frontier`** — treat numbered sub-steps as *intent*: run them in the cheapest correct order and
  skip redundant per-step narration.
- **`standard` / `light`** — follow every numbered step verbatim.

No specific model id and no specific effort value is ever required for anything in this plugin to
execute.

## Invariants outrank the tier

**A tier changes how much narration a step gets. It never removes a step that a caller declared an
invariant.** Each citing file lists the invariants that are mandatory at EVERY tier *for itself* —
that list is the caller's, not this file's, because "which rules are load-bearing here" is exactly
the thing that differs per phase.

Two invariants hold everywhere, in every file, at every tier, with no exemption:

1. **Write-before-stop.** A durable finding is written before the phase reports. See
   `vault-persistence.md`.
2. **No "it was small" exemption.** A gate, assertion, or check is not skipped because the diff,
   change, or risk *looked* minor. That reasoning is the incident, not the mitigation.

### The PRP invariant set

The core PRP flow — `prp-plan`, `prp-implement`, `prp-loop`, and the skills they drive
(`drift-guard`, `loop-contract`, `session-memory`, `worktree-lifecycle`) — shares one invariant set.
Those files cite it by name rather than restating it:

> **executable gates · the AC anchor · drift checks · write-before-stop · the independent blind
> verifier · blast-radius routing**

Mandatory at every tier, never skipped. A skill with a *different* set (a gate's layer list, a
panel's readiness rules) states its own inline instead — "which rules are load-bearing here" is not
shareable.

## Evidence-first

Wherever a step asks you to justify or explain a choice, do not narrate open-ended reasoning — state
**which AC this serves + `file:line` proof**. Keep every structured verdict intact and in its
declared vocabulary (drift verdicts, 🔴/🟡/🟢/💡, ✅ ON TRACK, PASS/FAIL) — the verdict tokens are
parsed by later phases, so paraphrasing one breaks the flow that reads it.

## Blast-radius routing

Routing maps a unit of work to an executor tier. Tag every task with its blast radius:

```
Blast radius: green|yellow|red
```

- **green** — isolated, low-risk, well-mirrored → `light` or `standard`; keep explicit steps.
- **yellow** — cross-module, moderate risk (shared modules, schema-adjacent, config) → `standard`;
  keep explicit steps, and flag it in whatever ledger the caller keeps.
- **red** — auth / payments / deploy / db-migration, or any high blast radius → `frontier` if
  available. **Red is also a human gate** in every flow that has one; routing it to a stronger model
  is not a substitute for asking.

## Single-tier fallback

**Routing is advisory, never a required dependency.** When `CI_MODEL_TIER` is unset or unknown, or
only one model is available, run in **single-tier mode**: treat every task at `standard`, keep
explicit steps, run serial. Every invariant still holds — a fallback costs parallelism and narration
budget, never a gate.
