---
name: doubt-driven
description: >
  Mid-flight adversarial review: spawn a fresh-context sub-agent to falsify the implementing
  agent's strongest claims via grep, then surface mismatches before more code is written.
  Trigger on "/doubt-this", "challenge my plan", "stress-test this", or auto-invoked from
  prp-implement at task N/2 (one-shot per session).
version: 1.0.0
---

# doubt-driven

**One job**: catch confident-but-wrong claims at the midpoint of an implementation run, when the cost of a course-correction is still low.

Why this exists: `drift-guard` checks self-consistency, but the same context grades itself. Confirmation bias persists across that check. A fresh-context sub-agent that only sees the **claims + file:line refs** — not the prior reasoning — can falsify with grep what the main agent has rationalized.

Pattern source: Doubt-Driven Development (`agent-skills-framework.md`).

---

## When to use

- **Auto**: `prp-implement` at task ⌈N/2⌉. One-shot per session.
- **Manual**: user says "doubt this", "challenge my plan", "are you sure about X", "/doubt-this".
- **Triggered**: when a single task has produced ≥3 files of changes without validation, or when the implementing agent has used phrases like "this is the only call site", "nothing else uses this", "this is safe to remove".

## When NOT to use

- Before any code is written (nothing to falsify yet).
- After all tasks complete (drift-guard final gate covers it).
- On trivial single-file changes (<30 LOC, no cross-file refs).
- More than once per session (diminishing returns; user can re-invoke manually if needed).

---

## Workflow — CLAIM → EXTRACT → DOUBT → RECONCILE → STOP

### Step 1 — CLAIM

List the 3 strongest load-bearing claims the implementing agent has made so far. Look for absolute language:

- "This is the only call site of X."
- "Nothing else imports Y."
- "Function Z is dead code."
- "The API returns exactly these fields."
- "This pattern is used nowhere else."

If fewer than 3 such claims exist, the session is too shallow to doubt — skip with `Skipped: insufficient claims (N<3)` and continue.

### Step 2 — EXTRACT

For each claim, pull the file:line reference that grounds it. Order matters: collect file:line evidence before forming a conclusion — evidence gathered under a conclusion is contaminated. Format:

```
CLAIM 1: "X is the only consumer of Y"
  REF: src/foo/bar.ts:42 — imports Y
  REF: src/foo/bar.ts:88 — calls Y(...)

CLAIM 2: ...
```

If a claim has no concrete reference → flag it `UNGROUNDED` and surface immediately; do not pass to sub-agent.

### Step 3 — DOUBT (spawn adversary)

Spawn one fresh sub-agent via `Agent(general-purpose)` with **only the claims + refs** — no prior session context, no plan, no memory.

Sub-agent prompt template:

```
You are an adversarial reviewer. You have NOT seen the implementation. Your only
inputs are the claims below.

Your job: try to FALSIFY each claim using grep, find, and ripgrep on the repo
rooted at {repo-path}. Do not trust the references — treat them as the claim
to be disproved, not evidence in favor.

For each claim, run:
  1. A broad grep for the symbol/identifier (case-insensitive, all extensions).
  2. A find for files matching the pattern that the claim says do not exist.
  3. Any test files or generated code (build outputs, .d.ts, dist/) that may reference it.

Report ONLY:
  - Claim N: ✅ confirmed (grep returned nothing contradicting)
  - Claim N: ❌ FALSIFIED — `<grep hit at path:line>`
  - Claim N: ⚠️  AMBIGUOUS — `<reasoning>`

Do not propose fixes. Do not explain. Report under 200 words total.

CLAIMS:
{paste CLAIM/REF block from Step 2}
```

Sub-agent runs in foreground; await its report (typically <30s).

### Step 4 — RECONCILE

Compose a mismatch table from the sub-agent's report:

| # | Claim (short) | Sub-agent verdict | File:line evidence | Severity |
|---|---|---|---|---|
| 1 | "X is only call site" | ❌ FALSIFIED | `tests/foo.spec.ts:14` also calls | HIGH |
| 2 | "Y is unused" | ✅ confirmed | — | — |
| 3 | "Z has no other importers" | ⚠️ AMBIGUOUS | matches in `dist/` only | LOW |

Severity rubric:
- **HIGH** — falsified claim that load-bears a deletion, refactor, or "no migration needed" assertion.
- **MEDIUM** — falsified claim that affects test coverage or scope.
- **LOW** — ambiguous match in generated/build artifacts only.

### Step 5 — STOP

Decide based on the highest severity, and emit exactly ONE verdict line as the first line of the STOP decision block. The verdict line MUST begin with one of the tokens `HALT:`, `CONTINUE:`, or `PASS:` — this is the `^(HALT|CONTINUE|PASS):` contract that the Validation section greps for. No other prefix is valid, and the line is written verbatim into the report file so `grep -E '^(HALT|CONTINUE|PASS):'` matches it.

- **Any HIGH** → emit a line starting `HALT:` and halt implementation. Example: `HALT: 1 HIGH mismatch (claim 1 falsified at tests/foo.spec.ts:14) — implementation stopped`. Surface the mismatch table to the user. Do not proceed until the user acknowledges and updates the plan or directs override. Append the decision to session-memory.
- **MEDIUM only** → emit a line starting `CONTINUE:` and continue. Example: `CONTINUE: 2 MEDIUM mismatches logged — affected tasks adjusted`. Log mismatches in session-memory under `### Doubt-driven findings` and adjust affected tasks.
- **LOW only or all confirmed** → emit a line starting `PASS:` and continue. Example: `PASS: doubt check passed at task N/2 (3 claims confirmed)`. Append the same one-line note to session-memory.

The emitted token (`HALT` / `CONTINUE` / `PASS`) is the machine-checkable STOP verdict; the Validation grep fails the run if none of the three appears at line-start in the report.

Always write the result to `02-Notes/Reports/{TICKET}-{BRANCH}-doubt-{YYYY-MM-DD}.md`:

```
mcp__ultimate-obsidian__create_or_update_note({
  filepath: "02-Notes/Reports/{TICKET}-{BRANCH}-doubt-{YYYY-MM-DD}.md",
  mode: "overwrite",
  content: "{frontmatter + claim table + verdict}"
})
```

---

## Output

- **File**: `02-Notes/Reports/{TICKET}-{BRANCH}-doubt-{YYYY-MM-DD}.md`
- **Shape**: frontmatter (`title`, `ticket`, `branch`, `date`, `type: doubt-review`) + claim table + severity rollup + STOP decision.
- **Session-memory entry**: appended under `### Doubt-driven findings` via `session-memory` SESSION END protocol.

---

## Validation

```bash
# Report file written
test -f ~/Documents/Obsidian-Vault/02-Notes/Reports/{TICKET}-{BRANCH}-doubt-*.md

# Claim count ≥ 3 OR explicit Skipped header
grep -E '^(CLAIM 1:|Skipped: insufficient claims)' ~/Documents/Obsidian-Vault/02-Notes/Reports/{TICKET}-{BRANCH}-doubt-*.md

# Verdict line present
grep -E '^(HALT|CONTINUE|PASS):' ~/Documents/Obsidian-Vault/02-Notes/Reports/{TICKET}-{BRANCH}-doubt-*.md
```

---

## Integration with prp-implement

Hooked once per session at Step 3.7b, immediately after the mid-task drift check (Step 3.7) and before the milestone memory save (Step 3.8). The hook computes `midpoint = ceil(total_tasks / 2)` and fires only when the current task index equals that midpoint. Skip if `total_tasks < 4` (too shallow to bisect meaningfully).

---

## What this skill does NOT do

- Does **not** re-run after the first invocation in a session. One-shot. User can re-trigger manually.
- Does **not** modify code. Surfaces mismatches; the main agent or user fixes.
- Does **not** read the plan, the session memory, or prior context. The sub-agent is intentionally context-starved — that's the whole mechanism.
- Does **not** trust the references in the CLAIMS list. They are the things being tested, not the evidence.

---

## Dependencies

- `Agent` tool with `subagent_type: general-purpose` (fresh context).
- MCP `ultimate-obsidian` — `create_or_update_note` for the report.
- Bash — `grep`, `find`, `rg` (sub-agent uses these).

---

## Source patterns mirrored

- `drift-guard/SKILL.md` — seven-question structure → adapted to five-step CLAIM→STOP.
- `quality-review/SKILL.md` — multi-checklist rollup pattern → adapted to severity rubric.
- Doubt-Driven Development (`02-Notes/Telegram-Inbox/2026-05-12-agent-skills-framework.md`).
