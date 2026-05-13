---
name: skillify
description: >
  Extract a reusable SKILL.md draft from a completed plan + report pair in the Obsidian vault.
  Trigger on "skillify this", "extract a skill from this report", "/skillify <report-path>",
  or after `prp-implement` finishes when the user wants to cache the pattern for reuse.
version: 1.0.0
---

# skillify

**One job**: turn a completed plan+report pair into a draft SKILL.md so the next session reuses the pattern instead of rediscovering it.

Sources: a `02-Notes/Plans/completed/{plan}.plan.md` archived plan + its `02-Notes/Reports/{plan}-report.md`.
Output: a draft at `~/skill-drafts/{slug}.SKILL.md` — **never written directly into the plugin**. The user reviews, edits, then commits.

---

## When to use

- A `prp-implement` run just finished and the resulting Report contains a workflow worth reusing (≥3 named steps + ≥1 validation command).
- A vault Report describes a recurring SOP (audit, scaffold, extraction) that today lives only as prose.
- The user explicitly asks "skillify this <report>".

## When NOT to use

- One-off bug fix with no transferable pattern.
- Report shorter than 50 lines (insufficient signal).
- Plan never reached implementation (no validated steps to compress).
- A skill for this pattern already exists under `plugins/codebase-intelligence/skills/` — update it instead.

---

## Inputs

Accept one of:
- **Report path** — vault-relative, e.g. `02-Notes/Reports/foo-report.md`.
- **Plan path** — vault-relative; skill resolves the matching report by name.
- **TICKET/BRANCH** — looks up the session file at `02-Notes/Sessions/{TICKET}-{BRANCH}.md` and walks back to the plan + report.

If none provided, ask the user once for the report path.

---

## Workflow — 5 steps

### Step 1 — Read source pair

```
mcp__ultimate-obsidian__read_note({ filepath: "02-Notes/Reports/{slug}-report.md" })
mcp__ultimate-obsidian__read_note({ filepath: "02-Notes/Plans/completed/{slug}.plan.md" })
```

If the plan is not yet archived, fall back to `02-Notes/Plans/{slug}.plan.md`.

Pull from the report:
- AC list (what the pattern actually solves).
- Validation commands that *actually ran* (not just the ones listed in the plan).
- Intelligence Summary — KB patterns applied, Context7 facts, drift removals.

Pull from the plan:
- Step-by-Step Tasks (these are the workflow seeds).
- Patterns to Mirror (these become "Mirrors:" in the draft).
- NOT-in-scope list (becomes "When NOT to use").

### Step 2 — Extract trigger conditions

A skill only earns its keep if it auto-fires on the right phrases. Distill from the report:
- **3+ trigger phrases** the user would say next time. E.g. `"audit my tokens"`, `"where are my tokens going"`, `"/token-audit"`.
- **Auto-invoke hook** (optional) — does another command fire this? E.g. `Auto-invoked from prp-implement midpoint`.
- **Skip rule** — when should the skill explicitly *not* fire?

### Step 3 — Compress to ≤300-line draft

Target shape mirrors `drift-guard/SKILL.md` and `kb-indexer/SKILL.md`:

```markdown
---
name: {kebab-slug}
description: >
  {one-line purpose}. Trigger on "{phrase 1}", "{phrase 2}", "{phrase 3}".
version: 0.1.0
---

# {kebab-slug}

**One job**: {single sentence}.

## When to use / When NOT to use
- {bullets distilled from AC + NOT-in-scope}

## Workflow — {N} steps
### Step 1 — {imperative title}
{shell snippet OR MCP call OR checklist}

### Step 2 — ...

## Output
- Path: `{exact path the skill writes}`
- Shape: `{frontmatter + sections}`

## Validation
```bash
{one-line check that proves the skill ran successfully}
```

## What this skill does NOT do
- {explicit rejections}
```

Hard limits on the draft:
- ≤300 lines total.
- No prose paragraphs longer than 4 lines — convert to checklist.
- Every shell command must be copy-pasteable (no `...` placeholders that need humans to fill).
- Cite the source report at the bottom: `Source: [[{slug}-report]]`.

### Step 4 — Write to skill-drafts (not plugin)

```bash
mkdir -p ~/skill-drafts
```

Write the draft via `Write` tool to `~/skill-drafts/{slug}.SKILL.md`. **Never write directly under `plugins/codebase-intelligence/skills/`** — that's the user's promotion step.

Print:
```
✏️  Draft written: ~/skill-drafts/{slug}.SKILL.md ({N} lines)
   Review, edit, then promote with:
     mv ~/skill-drafts/{slug}.SKILL.md plugins/codebase-intelligence/skills/{slug}/SKILL.md
```

### Step 5 — Verify and report

```bash
test -f ~/skill-drafts/{slug}.SKILL.md && head -1 ~/skill-drafts/{slug}.SKILL.md | grep -q '^---$' \
  || echo "BAD: missing frontmatter"

wc -l ~/skill-drafts/{slug}.SKILL.md
```

Report to user: draft path, line count, the 3 trigger phrases, top-3 commands the skill will run, and one suggested smoke-test invocation.

---

## Output

- **File**: `~/skill-drafts/{slug}.SKILL.md`
- **Shape**: frontmatter (`name`, `description`, `version`) + body of ≤300 lines composed of `## When to use`, `## When NOT to use`, `## Workflow`, `## Output`, `## Validation`, `## What this skill does NOT do`, `## Source`.

---

## Validation

```bash
# 1. File exists and starts with frontmatter
test -f ~/skill-drafts/{slug}.SKILL.md && head -1 ~/skill-drafts/{slug}.SKILL.md | grep -q '^---$'

# 2. Frontmatter parses
yq -f extract '.name' ~/skill-drafts/{slug}.SKILL.md >/dev/null

# 3. Trigger phrases present (≥3 occurrences of "Trigger" or quote-wrapped phrases on description line)
grep -c '"' ~/skill-drafts/{slug}.SKILL.md   # expect ≥6 (3 phrases × 2 quotes)

# 4. Under 300 lines
[ "$(wc -l < ~/skill-drafts/{slug}.SKILL.md)" -le 300 ]
```

All four must pass before reporting success.

---

## What this skill does NOT do

- Does **not** commit the draft into the plugin. Promotion is manual.
- Does **not** edit `.claude-plugin/plugin.json` or `marketplace.json` — that happens at promotion time.
- Does **not** invent workflow steps that did not appear in the source report. If the report has gaps, surface them; do not paper over them.
- Does **not** run on plans without a corresponding report. Implementation evidence is required.

---

## Dependencies

- MCP `ultimate-obsidian` — `read_note`, `list_vault`.
- Bash — `mkdir`, `wc`, `grep`, `head`, optionally `yq`.
- `Write` tool for the draft file.

---

## Source patterns mirrored

- `kb-indexer/SKILL.md` — shell-driven SOP shape, registry-update pattern.
- `drift-guard/SKILL.md` — checklist body, explicit "does NOT do" section.
- `session-memory/SKILL.md` — MCP call format and vault-relative pathing.
