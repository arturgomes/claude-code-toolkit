---
name: token-audit
description: >
  Audit a Claude Code setup for the 9 token-economy anti-patterns (`claude-code-optimization.md`),
  produce a structured report with score per pattern and total estimated overhead.
  Trigger on "/token-audit", "audit token usage", "where are my tokens going", "token economy check".
version: 1.0.0
---

# token-audit

**One job**: surface where tokens are leaking in a Claude Code setup and rank the leaks by estimated overhead so the user can cut the biggest one first.

Source: `02-Notes/Telegram-Inbox/2026-05-10-claude-code-optimization.md` — claims ~73% of tokens go to overhead in unaudited setups. We measure instead of trusting that claim.

Each audit pattern carries a `--why` citation pointing back to the inbox post for traceability and a tunable threshold so the user can re-calibrate without forking the skill.

---

## Tunable thresholds

Edit these in place when project norms differ:

```yaml
claude_md_max_lines: 300
read_repeat_top_n: 10
hook_inject_warn_bytes: 4000
schedule_wakeup_dead_zone: [270, 1200]    # half-open interval
mcp_count_warn: 6
edit_revert_window_turns: 10
plugin_version_window_days: 5
```

---

## When to use

- Wall-clock per turn has crept up; suspect context bloat.
- New project, calibrate baseline.
- After installing a new MCP / plugin — verify it isn't pulling its weight in idle cost.
- User says "/token-audit", "where are my tokens going".

## When NOT to use

- Bug-fix sessions — overhead measurement is noise here.
- Single-turn one-shots — audit's setup cost > savings.
- Brand-new clone with empty transcripts — most patterns return empty; re-run later.

---

## Inputs

Optional first argument:
- `--repo PATH` — defaults to `git rev-parse --show-toplevel`.
- `--why N` — print only the inbox citation for pattern N, then exit.

---

## Workflow — 9 audits + 1 rollup

Each audit is one shell snippet + a scoring line. Run them in order; collect findings in a buffer; write the report in step 10.

### A1 — CLAUDE.md bloat

```bash
F="$REPO/CLAUDE.md"
LINES=$(test -f "$F" && wc -l < "$F" || echo 0)
THRESHOLD=300
if [ "$LINES" -gt "$THRESHOLD" ]; then
  SCORE=$(( (LINES - THRESHOLD) * 10 ))   # ~10 tokens/line over budget
else
  SCORE=0
fi
```

`--why A1`: "CLAUDE.md is read every turn. Over ~300 lines, marginal lines are pure overhead — usually generic prose paraphrasing the model's own training."

### A2 — History re-reads

```bash
TRANSCRIPTS="$HOME/.claude/projects/$(echo "$REPO" | tr / -)/transcripts"
test -d "$TRANSCRIPTS" || TRANSCRIPTS=""
[ -n "$TRANSCRIPTS" ] && grep -h '"name":"Read"' "$TRANSCRIPTS"/*.jsonl 2>/dev/null \
  | grep -oE '"file_path":"[^"]+"' | sort | uniq -c | sort -rn | head -10
```

Score: top entry repeat count × estimated bytes per read (~3000). Threshold: any file read >5 times in one project is a finding.

`--why A2`: "Same file re-read N times leaves N copies in the rolling context. Cache it in session-memory or summarize."

### A3 — Hook injection cost

```bash
for S in "$REPO/.claude/settings.json" "$REPO/.claude/settings.local.json" "$HOME/.claude/settings.json"; do
  test -f "$S" && jq -r '.hooks | to_entries[]? | "\(.key): \(.value | tostring | length) bytes"' "$S"
done
```

Score: sum of bytes injected per turn × turns/session estimate. Warn over `hook_inject_warn_bytes`.

`--why A3`: "Hooks inject text on every matching event — sometimes every prompt submit. Cheap-looking strings compound."

### A4 — Cache-miss sleeps

```bash
TRANSCRIPTS="$HOME/.claude/projects/$(echo "$REPO" | tr / -)/transcripts"
[ -n "$TRANSCRIPTS" ] && grep -h 'ScheduleWakeup' "$TRANSCRIPTS"/*.jsonl 2>/dev/null \
  | grep -oE '"delaySeconds":[0-9]+' | awk -F: '$2 >= 270 && $2 < 1200 {print}' | wc -l
```

Each hit is a wasted cache (5-minute Anthropic prompt-cache TTL). Score: hits × ~50000 (typical conversation context).

`--why A4`: "ScheduleWakeup in [270, 1200) seconds pays the cache-miss without amortizing it. Drop to <270 or commit to ≥1200."

### A5 — Skill auto-load false positives

```bash
find "$HOME/.claude/plugins/installed" -name SKILL.md 2>/dev/null \
  | while read S; do
      NAME=$(yq -f extract '.name' "$S" 2>/dev/null)
      DESC=$(yq -f extract '.description' "$S" 2>/dev/null | tr -d '\n')
      WORDS=$(echo "$DESC" | wc -w)
      echo "$NAME: $WORDS words in description"
    done | sort -t: -k2 -rn | head
```

Long descriptions match more user prompts lexically and auto-fire when not wanted. Flag any description >40 words.

`--why A5`: "Skill descriptions are matched against the user's prompt; longer descriptions catch more false positives, each loading a fresh skill body into context."

### A6 — MCP idle cost

```bash
MCPS=$(claude mcp list 2>/dev/null | wc -l)
echo "MCPs configured: $MCPS"
[ "$MCPS" -gt 6 ] && echo "WARN: $MCPS > 6"
```

Score: each MCP loads its full tool schema. Average schema size ~2000 bytes; score = (MCPs - 6) × 2000 when over threshold.

`--why A6`: "MCPs load every endpoint whether used or not. Prefer API endpoints over MCP servers when only one or two endpoints are needed."

### A7 — Extended thinking on by default

```bash
grep -RhnE 'thinking_budget|thinkingBudget|extended_thinking|claude_thinking' \
  "$REPO/.claude" "$HOME/.claude/settings.json" 2>/dev/null
```

Constant high-budget thinking flags inflate every turn. Flag any non-zero default.

`--why A7`: "Extended thinking is a per-turn cost; if it's always on, you're paying the ceiling on every easy turn."

### A8 — Wrong-direction generation

```bash
TRANSCRIPTS="$HOME/.claude/projects/$(echo "$REPO" | tr / -)/transcripts"
[ -n "$TRANSCRIPTS" ] && tail -n 2000 "$TRANSCRIPTS"/*.jsonl 2>/dev/null \
  | grep -c '"name":"Edit".*"replace_all":false' | head
```

Heuristic: high Edit-then-Edit-same-file count within last 10 turns ⇒ model is iterating wrong. Flag if >3 within window.

`--why A8`: "Multiple Edits on the same file across consecutive turns usually mean the agent is course-correcting against ambiguous instructions. Fix the prompt, not the file."

### A9 — Plugin auto-update churn

```bash
M="$REPO/.claude-plugin/marketplace.json"
[ -f "$M" ] && git -C "$REPO" log --since="$(date -d '5 days ago' '+%Y-%m-%d')" --oneline -- "$M" | wc -l
```

Score: marketplace.json revs in the window × ~500 bytes (skill-list delta read every session).

`--why A9`: "Plugin auto-updates mean the model re-loads skill descriptions on every change. Pin versions when iterating heavily."

### Step 10 — Rollup + report

```bash
mkdir -p ~/Documents/Obsidian-Vault/02-Notes/Reports
```

Compose report at `02-Notes/Reports/token-audit-{YYYY-MM-DD}.md` via `mcp__ultimate-obsidian__create_or_update_note` (mode: overwrite):

```markdown
---
title: token-audit-{date}
created: {YYYY-MM-DD}
project: {repo-name}
type: token-audit
tags: [token-audit, audit, claude-code]
---

# Token Audit — {repo-name} ({date})

| # | Pattern | Score (est. tokens) | Status |
|---|---|---|---|
| A1 | CLAUDE.md bloat | {N} | ✅/⚠️/🔴 |
| A2 | History re-reads | {N} | ... |
| A3 | Hook injection | {N} | ... |
| A4 | Cache-miss sleeps | {N} | ... |
| A5 | Skill auto-load false positives | {N} | ... |
| A6 | MCP idle cost | {N} | ... |
| A7 | Extended thinking default | {N} | ... |
| A8 | Wrong-direction generation | {N} | ... |
| A9 | Plugin auto-update churn | {N} | ... |

**Total estimated overhead**: {sum} tokens/session.
**Top three leaks**: {A_i}, {A_j}, {A_k}.

## Detail per pattern
{for each pattern: command output + score + remediation hint + inbox citation}

## Source
- `02-Notes/Telegram-Inbox/2026-05-10-claude-code-optimization.md`
```

Status rubric: ✅ score==0; ⚠️ score<2000; 🔴 score≥2000.

---

## Output

- **File**: `~/Documents/Obsidian-Vault/02-Notes/Reports/token-audit-{YYYY-MM-DD}.md`
- **Shape**: frontmatter + rollup table + detail block per pattern + source citation.

---

## Validation

```bash
REPORT=~/Documents/Obsidian-Vault/02-Notes/Reports/token-audit-$(date +%F).md

# 1. Report file exists
test -f "$REPORT"

# 2. All 9 patterns present
[ "$(grep -c '^| A[1-9] |' "$REPORT")" -eq 9 ]

# 3. Total line present
grep -q '^\*\*Total estimated overhead\*\*' "$REPORT"

# 4. Source citation present
grep -q 'claude-code-optimization.md' "$REPORT"
```

All four must pass before reporting success.

---

## What this skill does NOT do

- Does **not** modify settings, hooks, or CLAUDE.md. Findings only.
- Does **not** read transcript content beyond JSONL line counts. No conversation data leaves the audit script.
- Does **not** count actual tokens — only estimates from byte counts. For exact accounting, use the Anthropic billing dashboard.
- Does **not** rank by absolute token cost across users. Scores are relative within the session.

---

## Dependencies

- Bash — `jq`, `yq`, `grep`, `awk`, `wc`, `find`, `git`, `claude` CLI.
- MCP `ultimate-obsidian` — `create_or_update_note`.

---

## Source patterns mirrored

- `benchmark-kb/SKILL.md` — structured metric-report shape with tunable thresholds.
- `kb-indexer/SKILL.md` — multi-step bash workflow + validation block.
- `02-Notes/Telegram-Inbox/2026-05-10-claude-code-optimization.md` — 9 anti-pattern list.
