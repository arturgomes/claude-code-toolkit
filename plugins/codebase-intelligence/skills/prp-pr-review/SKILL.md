---
name: prp-pr-review
description: >
  Fetch and triage GitHub PR comments via the SKEPTIC framework; applies only valid suggestions with one-line rationale per decision.
  Run as "/prp-pr-review <PR_URL>" when Copilot or reviewers leave comments on an open PR.
argument-hint: <github-pr-url | owner/repo#number | PR-number>
version: 1.0.1
---

# prp-pr-review

---

## Step 1: Parse PR reference

From `$ARGUMENTS`, extract `{OWNER}`, `{REPO}`, `{PR_NUMBER}`:

| Input format | Parsing |
|---|---|
| `https://github.com/{owner}/{repo}/pull/{N}` | Extract directly |
| `{owner}/{repo}#{N}` | Split on `#` |
| Just `{N}` (integer) | Use `gh repo view --json nameWithOwner` for owner/repo |

If no argument: run `gh pr list --limit 5` and ask user to specify a PR.

---

## Step 2: Fetch PR context (run in parallel)

Common jq projection for `pulls/comments`, `pulls/reviews`, `issues/comments`:
`.[] | {id, author: .user.login, is_bot: (.user.type == "Bot"), …}` (extra keys per endpoint listed below).

```bash
# PR metadata
gh pr view {PR_NUMBER} --repo {OWNER}/{REPO} --json title,body,headRefName,baseRefName,author,state,mergeable

# Inline code review comments — extra keys: path, line, original_line, diff_hunk, body, resolved: (.in_reply_to_id != null)
gh api "repos/{OWNER}/{REPO}/pulls/{PR_NUMBER}/comments" --paginate --jq '<projection + extra keys above>'

# PR-level block reviews — extra keys: state, body
gh api "repos/{OWNER}/{REPO}/pulls/{PR_NUMBER}/reviews" --paginate --jq '<projection + extra keys above>'

# General discussion — extra key: body
gh api "repos/{OWNER}/{REPO}/issues/{PR_NUMBER}/comments" --paginate --jq '<projection + extra keys above>'
```

**Print after fetch:**
```
PR #{PR_NUMBER}: {title}
Branch: {headRefName} → {baseRefName}
Inline comments: {N} | Block reviews: {N} | Discussion: {N}
```

---

## Step 3: Triage — build comment list

For each comment:

1. **Skip** if: empty body, emoji-only, pure approval ("LGTM", "Looks good"), `in_reply_to` set (thread reply — addressed via root)
2. **Flag as bot**: `user.type == "Bot"` OR `user.login` ends with `[bot]`
3. **Build normalized record**: `{id, author, is_bot, type(inline/review/discussion), file, line, diff_hunk, body}`

Print: `Analyzing {N} substantive comments...`

---

## Step 4: Evaluate each comment — THE SKEPTIC FRAMEWORK

### 4A: Read actual code (inline comments only)

Before evaluating any inline suggestion:
1. Read the full function/method containing the commented line — not just `diff_hunk`
2. If `diff_hunk` references deleted code → **SKIP-DONE**

For review/discussion: read PR diff (`gh pr diff {N} --repo {OWNER}/{REPO}`).

### 4B: Verdict matrix

When in doubt, default to ⏭️ SKIP-NITPICK. Bot suggestions are not authoritative — Copilot can and does misread intent. Never apply without reading the full function first.

| Verdict | When to use |
|---|---|
| ✅ **APPLY** | Real bug, correctness issue, unhandled error path, genuine simplification |
| ⏭️ **SKIP-NITPICK** | Style-only, renaming without clarity gain, formatting preference |
| ⏭️ **SKIP-OPINION** | "I'd do X instead" with no correctness argument |
| ⏭️ **SKIP-WRONG** | Suggestion misunderstands code context — would break or be incorrect |
| ⏭️ **SKIP-DONE** | Code already addresses the concern (file/line changed or concern gone) |
| ⏭️ **SKIP-SCOPE** | Valid concern but outside this PR's stated purpose |
| ⏭️ **SKIP-TRADEOFF** | Valid alternative approach but current approach is intentional |

### 4C: Copilot-specific heuristics

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

For each ✅ APPLY:

1. Re-read target file if not in context
2. Make the **minimal** change addressing the suggestion
3. Verify no break in: function signature, surrounding logic, imports
4. Do NOT add inline comments explaining the change
5. Do NOT refactor beyond the suggestion

If applying creates a cascading issue (type error, import) — fix it, note as "cascading fix" in report.

---

## Step 6: Report

Output format (schema):

- `# PR Review: {OWNER}/{REPO}#{PR_NUMBER}` — title, branch, comment counts (total, bot/human), applied/skipped counts
- `## ✅ Applied Changes ({N})` — one entry per APPLY: `### {file}:{line} — @{author} [BOT?]`, comment excerpt (first 120 chars), Verdict line, Change line. Omit section if N=0.
- `## ⏭️ Skipped Comments ({N})` — same record shape; Verdict + reason only. Omit if N=0.
- `## Summary` — table: Files modified, Bot comments analyzed, Bot suggestions applied (count + %), Human comments analyzed, Human suggestions applied (count + %).
- Footer: if applied>0 list modified files + "Next: `git diff` to review, then commit and push."; else "No changes applied. All comments skipped with rationale above."

---

## Error handling

| Error | Action |
|---|---|
| `gh` not authenticated | Print: "Run `gh auth login` first" and stop |
| PR not found (404) | Print: "PR #{N} not found in {OWNER}/{REPO}" and stop |
| PR already merged/closed | Print warning, ask user to confirm before continuing |
| File from comment not found locally | Note in report: "File {path} not found locally — run `gh pr checkout {N}` to apply" |
| Rate limit hit | Print remaining rate limit, pause if needed |
