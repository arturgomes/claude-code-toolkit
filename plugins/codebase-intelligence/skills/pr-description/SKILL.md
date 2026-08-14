---
name: pr-description
description: >
  The default PR description generator for every pull request this toolkit opens. Derives the title
  as `[TICKET] task description` (repo root folder name when there is no ticket), writes the body from
  the branch's real diff — never a placeholder — carries the pre-pr-gate receipt and review fan-out
  verbatim, and persists the whole description as a vault note in `02-Notes/pr-descriptions/` BEFORE
  the PR is opened. Auto-invoked by ship (Step 4), worktree-lifecycle (EXIT), prp-implement (Phase 5),
  and mediator (Phase E4) — those callers never ask whether to use it. Invoke manually on "write the PR
  description", "draft a PR body", "/pr-description".
version: 1.0.0
allowed-tools:
  - Bash(git *)
  - Bash(gh pr view *)
  - Read
  - Grep
  - Glob
---

# pr-description

**Every PR this toolkit opens gets its description from here.** This is not an option a caller weighs
— `ship`, `worktree-lifecycle` EXIT, `prp-implement`, and the `mediator` invoke it unconditionally and
never ask the user whether to use it. The only confirmation that survives is the outward-facing one:
creating the PR itself.

The description is a **vault artifact first and a PR body second**. The vault note is written before
`gh pr create` runs, so a description exists even when the PR is never opened, the run is interrupted,
or the branch is parked for a week.

---

## Step 1 — Resolve the working directory (portable — never hardcode a path)

```bash
ROOT=$(git rev-parse --show-toplevel) || { echo "🔴 not a git repo"; exit 1; }
# The repo name is the MAIN checkout's folder. `--git-common-dir` resolves a
# worktree back to the repo it belongs to; plain `basename "$ROOT"` does not, and
# in a worktree yields the worktree folder (`.wt/fe-804-uat`) instead of the repo
# (`seathq-fe`) — poisoning the `[repo]` title tag on a ticketless branch,
# `project:` in the frontmatter, and the `-{repo}` filename suffix.
REPO=$(basename "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")")
[ -z "$REPO" ] && REPO=$(basename -s .git "$(git remote get-url origin 2>/dev/null)")
[ -z "$REPO" ] && REPO=$(basename "$ROOT")
```

Do **not** prefer the remote URL over the local folder: a remote is often named differently from the
checkout (`seathq-demo`'s origin is `NicoAndru/seathq.git`), so remote-first silently renames the repo.
Remote is a fallback only, for the case where `--git-common-dir` is unavailable.

If the caller named a worktree or a sibling checkout, resolve it the same way with `git -C <dir>`.
State which directory was chosen, **and which repo name you derived, and from where** — a worktree run
that reports the worktree folder as the repo has already gone wrong. **Never** assume a repo lives under
any particular parent — the caller's checkout is wherever `git rev-parse` says it is.

## Step 2 — Verify the branch (the base-branch rule applies here too)

`$BASE` from `../../shared/git-base-detection.md`, then the assertion from
`../../shared/branch-rule.md`. A detached HEAD or the base branch itself is a hard stop, not a
warning: there is no PR to describe.

## Step 3 — Establish the real base

A local base branch is routinely stale by dozens of commits, which silently inflates the diff with
other people's work and attributes it to this PR:

```bash
git fetch origin --quiet
MERGE_BASE=$(git merge-base HEAD "origin/$BASE")
BEHIND=$(git rev-list --count "HEAD..origin/$BASE")
```

Use `$MERGE_BASE` everywhere below. If `$BEHIND` is non-zero, say so in the report — the branch is
behind and may need a merge before review.

## Step 4 — Check the tree is clean

```bash
git status --porcelain
```

Anything uncommitted is **not** in the PR, so describing it as done would be a lie. Note the
discrepancy instead. (`git checkout <ref> -- <file>` leaves the index dirty — a common leftover.)

## Step 5 — Gather the changes (never filter by author)

A branch's commits are the branch's commits. An author filter silently yields an empty changelog
whenever the git identity differs from the one assumed:

```bash
git log "$MERGE_BASE"..HEAD --oneline --no-merges
git log "$MERGE_BASE"..HEAD --no-merges --pretty=format:"%B"
git diff "$MERGE_BASE"...HEAD --stat
git diff "$MERGE_BASE"...HEAD
```

## Step 6 — Derive the title: `[TICKET] task description title`

**Mandatory format, every PR, no exceptions:**

```
[SEATHQ-804] Price-edit cell: stop deleting in-progress drafts on keystroke
[claude-code-toolkit] Persist orchestration state to the vault
```

Ticket resolution, first hit wins:

1. An explicit ticket passed by the caller (plan slug, `--ticket`, refinement contract).
2. The branch name — `\b[A-Z][A-Z0-9]+-[0-9]+\b`, upper-cased (`feature/seathq-804-x` → `SEATHQ-804`).
3. The branch's commit subjects, same regex.
4. **No ticket anywhere → the repo name** (`$REPO` exactly as derived in Step 1 — the *main checkout's*
   folder, never the worktree you happen to be standing in), verbatim, not `GENERAL` and not a guessed
   project code. A run in `claude-code-toolkit` is tagged `[claude-code-toolkit]`. A run inside a
   worktree such as `.wt/fe-804-uat` is still tagged `[seathq-fe]`; if your tag looks like a branch
   slug or a scratch directory, Step 1 fell through to the wrong fallback.

The description half is the *change*, not the file list, in the imperative, ≤72 chars for the whole
title including the bracket. Truncate the description, never the ticket tag.

## Step 7 — Fill the template from the actual diff

Every section is filled from what the code does. **A placeholder left in place is a defect** — if a
section does not apply, say why in one line and move on.

```markdown
# [{TICKET}] {title}

## Description
<!-- business context and what changed, not a file listing -->

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix/feature causing existing functionality to change)
- [ ] Refactoring (code improvement without changing behavior)
- [ ] Documentation update
- [ ] Performance improvement

## Technical Details

### What changed?
- key architectural decisions
- dependencies added/updated
- design patterns used

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] Edge cases covered

**Test scenarios:**
1.
2.

## Screenshots/Videos
<!-- UI changes: before/after. Behavioural change: say so and cite the test transcript. -->

## Checklist
- [ ] Builds without errors/warnings
- [ ] Types properly defined
- [ ] No debugging leftovers
- [ ] Documentation updated (when applicable)
- [ ] Breaking changes documented (when applicable)

## Pre-PR gate
<!-- MANDATORY: the pre-pr-gate receipt block verbatim, one per repo, SHA-bound to the pushed HEAD -->

## Review fan-out
<!-- MANDATORY when the caller ran one: per-reviewer verdict + aggregate, or the tiny-PR skip line -->

## Review Focus
<!-- the most complex or risky parts of the diff, and any inherited blast radius -->

## Links
Issue: {ticket URL, when a tracker is configured}
PR: {filled in after creation}
```

Check the Type-of-Change and Checklist boxes **from the diff**, not from intent.

## Step 8 — Honesty rules (these outrank filling the template)

- **Only tick a Checklist box you actually verified.** Did not run the build? Say so instead of ticking.
- **Quote real gate output and capture exit codes inside the log**:
  `{ npm run test:ci; echo "EXIT=$?"; } > log 2>&1`. A trailing `tail`/`cat`/`echo` after a redirect
  makes the task report the *last* command's status, which reads as a pass.
- **A repo that is already red on a clean checkout is judged on count parity against the base**, not on
  the exit code. Measure the base the same way (ideally in a detached worktree) and state both numbers.
- **Name inherited blast radius** in Review Focus — a pre-existing bug you noticed, behaviour from a
  sibling PR, a second mount site of a component you edited. Otherwise the reviewer attributes it here.
- Prefer a **draft** PR when an unresolved product question could still change the implementation.

## Step 9 — Persist to the vault (MANDATORY — before the PR is opened)

The vault is the system of record. This write is not deferred to shutdown and is not optional.

**Path** — the existing convention in `02-Notes/pr-descriptions/`, which is the ontology's home for
the `pr-description` node type:

```
02-Notes/pr-descriptions/{YYYY-MM-DD}-{TICKET}-{slug}[-{repo}].md
```

- `{slug}`: kebab-case of the title's description half, 3-6 words.
- **`-{repo}` is required whenever one ticket spans more than one repo** — without it the second
  repo's description overwrites the first's on the same day. Include it by default in multi-repo runs.

**Frontmatter** — typed relations per `02-Notes/Wiki/knowledge-graph-ontology.md`. `pr-description`
may emit `up`, `implements`, `documents`, `affects`, `related`. **Omit any key whose target does not
resolve to an existing note** — a dangling edge fails `check-graph-acs.sh`; an absent key never does.

```yaml
---
title: {YYYY-MM-DD}-{TICKET}-{slug}
created: {YYYY-MM-DD}
source: PR description
project: {repo}
branch: {branch}
ticket: {TICKET}            # omit when the tag is a repo folder name, not a real ticket
pr: "{url}"                 # added after creation
type: pr-description
schema_version: 1
tags: [pr-description, {repo}, {TICKET}]
up: "[[{TICKET}]]"          # only if 03-Systems/tickets/{TICKET}.md exists
implements: "[[{plan-note}]]"   # only if the plan note exists
---
```

**Write, then verify:**

```
mcp__ultimate-obsidian__check_exists({ filepath: "02-Notes/pr-descriptions/{file}.md" })
mcp__ultimate-obsidian__create_or_update_note({ filepath: ..., mode: "overwrite", content: ... })
mcp__ultimate-obsidian__index_note({ vault_path: "~/Documents/Obsidian-Vault/02-Notes/pr-descriptions/{file}.md" })
```

Run the pre-write secret scrub (`../../shared/secret-scrub.md`) over the body first — PR descriptions quote logs, and
logs carry tokens. Replace every match with `[REDACTED]`.

**A failed vault write is a blocker, not a warning.** Report it and stop before `gh pr create`; do not
"save it locally for now". A repo-local or scratch copy (`artur-documents/`, `/tmp`, the session
scratchpad) is never a substitute for the vault note — write one only if the caller explicitly asked
for a second copy, and only after the vault write returned OK.

## Step 10 — Hand back

Return to the caller:

- the **title** (`[TICKET] …`),
- the **body** (ready to pass to `gh pr create --body-file`),
- the **vault note path**.

**Do not push and do not open the PR.** Opening is outward-facing and belongs to the caller — `ship`
Step 4, `worktree-lifecycle` EXIT, or `mediator` Phase E4 — which confirms it with the user. After the
PR exists, the caller passes the URL back and this skill patches `pr:` and the `## Links` section into
the vault note.

---

## Rules

- Never ask *whether* to write a PR description. Callers invoke this by default; the user opted into
  that once, not once per PR.
- Never emit a title without a `[TICKET]` / `[repo]` tag.
- Never leave a template placeholder in a body that reaches GitHub.
- Never open the PR from inside this skill.
- Never claim a gate passed without its verbatim command and exit code.
- Never skip the vault write, and never let a scratch file stand in for it.
