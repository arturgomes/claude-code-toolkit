---
name: claude-md-init
description: >
  Scaffold a 12-rule CLAUDE.md behavioral contract at the repo root, with attributed rules
  (Karpathy 1–4 + Mnilax 5–12), an anti-rationalization table, and a tool-routing tail.
  Trigger on "/init-claude-md", "scaffold a CLAUDE.md", "behavioral contract", "init claude.md".
version: 1.0.0
---

# claude-md-init

**One job**: drop a known-good 12-rule CLAUDE.md scaffold at the target repo root so each new project starts with a behavioral contract instead of paraphrased prompts.

Source: `02-Notes/Telegram-Inbox/2026-05-10-12-rules-for-claude-code.md` (Karpathy rules 1–4, Mnilax rules 5–12).

Why a scaffold and not a frozen file: rules evolve. Skill emits a scaffold + cites the inbox source so users can re-check against newer guidance.

---

## When to use

- New repo with no `CLAUDE.md`.
- Existing `CLAUDE.md` <50 lines (stub) — user wants real scaffold.
- User asks "scaffold CLAUDE.md", "/init-claude-md", "what rules should my project have".

## When NOT to use

- `CLAUDE.md` already ≥50 lines — skill refuses unless `--append` mode requested.
- Repo is not a git repo (`git rev-parse --show-toplevel` fails) — abort.
- User wants to edit specific rules — direct edit, not scaffold.

---

## Workflow — 5 steps

### Step 1 — Detect target

```bash
REPO=$(git rev-parse --show-toplevel) || { echo "Not a git repo. Aborting."; exit 1; }
TARGET="$REPO/CLAUDE.md"
```

### Step 2 — Gate on existing file

```bash
if [ -f "$TARGET" ]; then
  LINES=$(wc -l < "$TARGET")
  if [ "$LINES" -ge 50 ]; then
    echo "CLAUDE.md already exists ($LINES lines). Use --append or edit directly. Aborting."
    exit 1
  fi
fi
```

If user passes `--append`, skip the abort but write under `## Appended by claude-md-init {date}` instead of overwriting.

### Step 3 — Emit scaffold

Write to `$TARGET` (or append). Use the template in `## Template` below verbatim. The numbered rule list MUST contain exactly 12 entries; the anti-rationalization table MUST have one row per rule.

### Step 4 — Append tool-routing tail

Detect installed plugin slash commands:

```bash
ls ~/.claude/plugins/installed/ 2>/dev/null | head
```

For each codebase-intelligence command, append a one-line entry under the `# Tool routing` tail block. If detection fails, emit a placeholder block the user can fill in.

### Step 5 — Print delta and stop

Print:
```
✏️  CLAUDE.md scaffolded: $TARGET ({N} lines, 12 rules)
   Anti-rationalization rows: 12
   Tool-routing entries: {M}
   NOT committed — review and commit manually.
```

Do **not** `git add` or `git commit`. User reviews and commits.

---

## Template

The scaffold body (write to `$TARGET`):

```markdown
# CLAUDE.md — Behavioral Contract

This file is read by Claude Code at session start. Each rule closes a known failure mode.
Source: <https://example/12-rules-for-claude-code> (Karpathy 1–4, Mnilax 5–12, 2026-05-09).

## Rules

1. **Think Before Coding** — No silent assumptions. State what you're assuming. Surface tradeoffs. Ask before guessing. Push back when a simpler approach exists. *(Karpathy)*
2. **Simplicity First** — Minimum code that solves the problem. No speculative features. No abstractions for single-use code. If a senior engineer would call it overcomplicated, simplify. *(Karpathy)*
3. **Surgical Changes** — Touch only what you must. Don't "improve" adjacent code, comments, or formatting. Don't refactor what isn't broken. Match existing style. *(Karpathy)*
4. **Goal-Driven Execution** — Define success criteria. Loop until verified. Don't prescribe steps; describe what success looks like and let the agent iterate. *(Karpathy)*
5. **Don't make the model do non-language work** — No arithmetic in prose, no manual counting, no character-position math. Delegate to a tool. *(Mnilax)*
6. **Hard token budgets, no exceptions** — Cap context per task. Reject any input that doesn't fit. Truncate transcripts, summarize, or split before context overflow. *(Mnilax)*
7. **Surface conflicts, don't average them** — When sources disagree, list both and ask. Never silently pick the middle. *(Mnilax)*
8. **Read before you write** — Read every file you're about to edit, in full, in the same turn. No edits based on filename guesses. *(Mnilax)*
9. **Tests are not optional, but they're not the goal** — Every behaviour change ships with a test. Tests verify, they don't drive scope. *(Mnilax)*
10. **Long-running operations need checkpoints** — Save state every N steps. Resume from disk, not from rerun. *(Mnilax)*
11. **Convention beats novelty** — Match the codebase's existing pattern even if a "better" one exists. Novelty only with explicit user approval. *(Mnilax)*
12. **Fail visibly, not silently** — Exit nonzero on partial success. Print the failing input. Never swallow errors to keep going. *(Mnilax)*

## Anti-rationalization

For each rule, the table below maps the shortcut excuse to the forced action.
The excuse column captures what the model is likely to say when tempted to skip the rule;
the forced-action column is what to do instead.

| # | Rule | Shortcut excuse | Forced action |
|---|---|---|---|
| 1 | Think Before Coding | "I'll figure it out as I write." | Pause. Write one paragraph of assumptions before any tool call. |
| 2 | Simplicity First | "Adding a small abstraction now saves time later." | Inline it. Wait for the third repetition before extracting. |
| 3 | Surgical Changes | "While I'm here, I'll fix this nearby thing." | Note as follow-up. Don't touch it. |
| 4 | Goal-Driven Execution | "I'll just do step 1 and see." | Restate the success criterion. Loop until it passes. |
| 5 | No non-language work | "I can count these tokens roughly." | Call `wc`, `jq`, or a script. |
| 6 | Hard token budget | "One more file won't matter." | Run the budget check; if over, truncate or split. |
| 7 | Surface conflicts | "These sources mostly agree." | List the disagreement explicitly and ask. |
| 8 | Read before write | "The filename tells me what's inside." | Open the file, in full, this turn. |
| 9 | Tests required | "This change is too small to test." | Write one test. Run it. |
| 10 | Checkpoints | "I'll just keep going, it's fast." | Save state every ~3 tasks. |
| 11 | Convention beats novelty | "The existing pattern is awkward." | Match it. Propose the change separately. |
| 12 | Fail visibly | "I'll keep going and surface it at the end." | Exit nonzero now. Print the input that failed. |

## Tool routing

| Command | Use for |
|---|---|
| `/codebase-intelligence:prp-plan` | Convert a feature/PRD/ticket into a plan. |
| `/codebase-intelligence:prp-implement` | Execute a plan end-to-end with drift-guard and Context7. |
| `/codebase-intelligence:prp-pr-review` | Triage GitHub PR review comments via SKEPTIC. |
| `/codebase-intelligence:quality-review` | Function + test quality checklists on changed files. |
| `/codebase-intelligence:drift-guard` | Seven-question drift check before any "while I'm here" change. |

<!-- Add project-specific rules below this line. -->
```

---

## Validation

```bash
# Exists and >= 50 lines
test -s "$TARGET" && [ "$(wc -l < "$TARGET")" -ge 50 ]

# Under 200-line limit (Mnilax)
[ "$(wc -l < "$TARGET")" -le 200 ]

# 12 numbered rules
[ "$(grep -c '^[0-9]\+\. \*\*' "$TARGET")" -eq 12 ]

# Anti-rationalization table present with 12 rows
[ "$(awk '/^\| 1 \|/,/^$/' "$TARGET" | grep -c '^| [0-9]\+ |')" -ge 12 ]

# Tool routing block present
grep -q '^## Tool routing' "$TARGET"
```

All five must pass before reporting success.

---

## What this skill does NOT do

- Does **not** commit. User reviews and commits manually.
- Does **not** overwrite a ≥50-line existing CLAUDE.md without `--append`.
- Does **not** edit other config files (`.claude/settings.json`, `.gitignore`, etc.). Out of scope.
- Does **not** install slash commands. Only references them in the routing block.

---

## Dependencies

- Bash — `git`, `wc`, `grep`, `awk`.
- `Write` tool to drop the scaffold.

---

## Source patterns mirrored

- `product-spec/SKILL.md` — single-shot generator shape.
- `kb-indexer/SKILL.md` — bash-driven gates + validation block.
- `02-Notes/Telegram-Inbox/2026-05-10-12-rules-for-claude-code.md` — rule text + attribution.
