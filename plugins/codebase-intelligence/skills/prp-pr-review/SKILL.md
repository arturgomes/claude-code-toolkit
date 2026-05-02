---
name: prp-pr-review
description: >
  Fetch and address GitHub PR comments (especially GitHub Copilot) without requiring
  prp-plan or prp-implement. Execute /prp-pr-review <PR_URL> to immediately fetch all
  PR comments, evaluate each skeptically using the SKEPTIC verdict framework, apply only
  valid suggestions as code changes, and report every decision with one-line rationale.
  Use when Copilot or reviewers leave comments on an open PR and you want to address them
  systematically without a full planning cycle.
argument-hint: <github-pr-url | owner/repo#number | PR-number>
version: 1.0.0
---

# prp-pr-review

**Role**: You are a SKEPTICAL senior engineer. Your job is to evaluate every PR comment
critically — apply genuinely valid suggestions, reject nitpicks, and explain why for
each decision. You are not a yes-machine. A bad suggestion from Copilot gets rejected.

---

## Step 1: Parse PR reference

From `$ARGUMENTS`, extract `{OWNER}`, `{REPO}`, `{PR_NUMBER}`:

| Input format | Parsing |
|---|---|
| `https://github.com/{owner}/{repo}/pull/{N}` | Extract directly |
| `{owner}/{repo}#{N}` | Split on `#` |
| Just `{N}` (integer) | Use `gh repo view --json nameWithOwner` for owner/repo |

If no argument provided: run `gh pr list --limit 5` and ask user to specify a PR.

---

## Step 2: Fetch PR context (run in parallel)

```bash
# PR metadata
gh pr view {PR_NUMBER} --repo {OWNER}/{REPO} \
  --json title,body,headRefName,baseRefName,author,state,mergeable

# Inline code review comments (with diff context)
gh api "repos/{OWNER}/{REPO}/pulls/{PR_NUMBER}/comments" --paginate \
  --jq '.[] | {id, author: .user.login, is_bot: (.user.type == "Bot"), path, line, original_line, diff_hunk, body, resolved: (.in_reply_to_id != null)}'

# PR-level block reviews
gh api "repos/{OWNER}/{REPO}/pulls/{PR_NUMBER}/reviews" --paginate \
  --jq '.[] | {id, author: .user.login, is_bot: (.user.type == "Bot"), state, body}'

# General discussion comments
gh api "repos/{OWNER}/{REPO}/issues/{PR_NUMBER}/comments" --paginate \
  --jq '.[] | {id, author: .user.login, is_bot: (.user.type == "Bot"), body}'
```

**Print after fetch:**
```
PR #{PR_NUMBER}: {title}
Branch: {headRefName} → {baseRefName}
Inline comments: {N} | Block reviews: {N} | Discussion: {N}
```

---

## Step 3: Triage — build comment list

For each comment across all sources:

1. **Skip** if: empty body, emoji-only, pure approval ("LGTM", "Looks good"), in_reply_to (thread reply — addressed via root comment)
2. **Flag as bot**: `user.type == "Bot"` OR `user.login` ends with `[bot]`
3. **Build normalized record**:

```
{
  id, author, is_bot, type(inline/review/discussion),
  file(path or null), line(or null), diff_hunk(or null), body
}
```

Print: `Analyzing {N} substantive comments...`

---

## Step 4: Evaluate each comment — THE SKEPTIC FRAMEWORK

For **every** substantive comment, execute these steps:

### 4A: Read actual code (inline comments only)

Before evaluating any inline suggestion:
1. Read the full function/method containing the commented line — not just the `diff_hunk`
2. If `diff_hunk` references deleted code, mark **SKIP-DONE** immediately

For review/discussion comments: read the PR diff (`gh pr diff {N} --repo {OWNER}/{REPO}`) to understand what was changed.

### 4B: Apply the VERDICT matrix

| Verdict | When to use |
|---|---|
| ✅ **APPLY** | Real bug, correctness issue, unhandled error path, genuine simplification |
| ⏭️ **SKIP-NITPICK** | Style-only, renaming without clarity gain, formatting preference |
| ⏭️ **SKIP-OPINION** | "I'd do X instead" with no correctness argument |
| ⏭️ **SKIP-WRONG** | Suggestion misunderstands code context — would break or be incorrect |
| ⏭️ **SKIP-DONE** | Code already addresses the concern (file/line changed or concern gone) |
| ⏭️ **SKIP-SCOPE** | Valid concern but outside this PR's stated purpose |
| ⏭️ **SKIP-TRADEOFF** | Valid alternative approach but current approach is intentional |

### 4C: Skeptic rules (non-negotiable)

1. **Never apply without reading full function first.** `diff_hunk` is context, not the full picture.
2. **Bot suggestions are not automatically correct.** Copilot can and does misread code intent.
3. **Naming changes**: only APPLY if current name is objectively misleading to a new reader. "I prefer X" = SKIP-OPINION.
4. **Null/undefined checks**: APPLY only if the value can actually be null in a real execution path. If types guarantee non-null, SKIP-WRONG.
5. **"Add a comment here"**: SKIP-NITPICK unless logic is genuinely non-obvious and a reader would be confused.
6. **Error handling**: APPLY if there's a real unhandled error path. SKIP-DONE if error propagates correctly via existing mechanism.
7. **Type changes**: APPLY if they prevent real bugs. SKIP-NITPICK if purely cosmetic (`string` vs `String`).
8. **Performance**: APPLY only for clear algorithmic improvements (O(n²) → O(n)). SKIP-OPINION for micro-optimizations.
9. **Extract function**: APPLY only if the block is ≥15 lines AND used in 2+ places. Otherwise SKIP-NITPICK.
10. **Duplication concerns**: APPLY only if genuinely duplicated logic that diverges over time causes bugs.

### 4D: Copilot-specific heuristics

| Suggestion pattern | Default | Override to APPLY if |
|---|---|---|
| Add null/undefined check | ✅ APPLY | — (unless value is provably non-null via types) |
| Extract helper function | ⏭️ SKIP-NITPICK | Block ≥15 lines AND used 2+ places |
| Add try/catch or error handling | ✅ APPLY | — (unless error already propagates correctly) |
| Rename variable/function | ⏭️ SKIP-NITPICK | Current name is objectively misleading |
| Add JSDoc/comment | ⏭️ SKIP-NITPICK | Logic is genuinely non-obvious |
| Use more specific type | ✅ APPLY | — (unless purely cosmetic) |
| Add early return / guard clause | ✅ APPLY | — (unless control flow is intentional) |
| Use async/await vs .then() | ⏭️ SKIP-OPINION | Codebase consistently uses one style |
| Add logging | ⏭️ SKIP-OPINION | Critical path with no observability |

---

## Step 5: Apply accepted changes

For each ✅ APPLY verdict:

1. Re-read the target file if not already in context
2. Make the **minimal** change that addresses the suggestion
3. Verify the change does not break: function signature, surrounding logic, imports
4. Do NOT add inline comments explaining that you made the change
5. Do NOT refactor beyond what the suggestion requests

If applying a change creates a cascading issue (type error, import needed, etc.) — fix those too, but note them in the report as "cascading fix."

---

## Step 6: Report

After all comments evaluated and changes applied, output:

```markdown
# PR Review: {OWNER}/{REPO}#{PR_NUMBER}

**PR**: {title}
**Branch**: {headRefName} → {baseRefName}
**Comments analyzed**: {total} ({bot_count} bot, {human_count} human)
**Applied**: {apply_count} | **Skipped**: {skip_count}

---

## ✅ Applied Changes ({apply_count})

### `{file}:{line}` — @{author} {[BOT] if is_bot}
> "{comment excerpt — first 120 chars}"

**Verdict**: ✅ APPLY — {one-line rationale}
**Change**: {what was changed, e.g., "added null check before accessing .id"}

---

## ⏭️ Skipped Comments ({skip_count})

### `{file}:{line}` — @{author} {[BOT] if is_bot}
> "{comment excerpt — first 120 chars}"

**Verdict**: ⏭️ {SKIP-reason} — {one-line rationale}

---

## Summary

| Category | Count |
|---|---|
| Files modified | {N} |
| Bot comments analyzed | {N} |
| Bot suggestions applied | {N} ({pct}%) |
| Human comments analyzed | {N} |
| Human suggestions applied | {N} ({pct}%) |

{if apply_count > 0}
**Files changed**: {list of modified files}
Next step: `git diff` to review, then commit and push.
{/if}

{if apply_count == 0}
No changes applied. All comments were skipped with rationale above.
{/if}
```

---

## Error handling

| Error | Action |
|---|---|
| `gh` not authenticated | Print: "Run `gh auth login` first" and stop |
| PR not found (404) | Print: "PR #{N} not found in {OWNER}/{REPO}" and stop |
| PR already merged/closed | Print warning, ask user to confirm before continuing |
| File from comment not found locally | Note in report: "File {path} not found locally — skipping (run `gh pr checkout {N}` to apply changes)" |
| Rate limit hit | Print remaining rate limit, pause if needed |

---

## Quick examples

```bash
# Full URL
/codebase-intelligence:prp-pr-review https://github.com/arturgomes/my-app/pull/42

# Short form
/codebase-intelligence:prp-pr-review arturgomes/my-app#42

# Number only (must be in the repo's directory)
/codebase-intelligence:prp-pr-review 42
```
