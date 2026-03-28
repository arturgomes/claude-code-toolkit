# Feature: Enhance Ship Skill with PR Template Integration

## Summary

Extend the existing `ship.md` skill to automatically populate PR descriptions using the detailed structure defined in `PR_TEMPLATE.md`. The enhancement loads the template, extracts metadata from git commands (branch name, commits, diffs, author), intelligently fills template sections, and presents the filled template for user confirmation before PR creation. This maintains the proven 4-step workflow (scan, stage/commit, push, PR) while upgrading PR descriptions from simple bullet points to comprehensive, team-standard documentation.

## User Story

As a developer using the ship skill
I want the PR description to follow my existing PR_TEMPLATE.md format
So that all PRs maintain consistent, comprehensive documentation with technical details, testing scenarios, and review guidance

## Problem Statement

The current `ship.md` skill creates PRs with minimal descriptions (2-4 bullet points + test plan). This doesn't match the team's detailed PR template expectations defined in `PR_TEMPLATE.md`, which requires Description, Type of Change checkboxes, Technical Details, Testing scenarios, Screenshots, Checklist, Review Focus, and JIRA Links. PRs created via the skill require manual editing to meet standards.

## Solution Statement

Enhance Step 4 (Pull Request) of `ship.md` to:
1. Load `PR_TEMPLATE.md` content
2. Extract metadata from git commands (branch name for JIRA ticket, commits for description, diff stats for technical details, test files for testing section)
3. Parse and populate template sections with intelligent defaults
4. Remove HTML comments per template rules
5. Present filled template to user for confirmation/editing
6. Create PR with the confirmed template body

This preserves the existing workflow architecture while upgrading PR quality to match team standards.

## Metadata

| Field            | Value                                                         |
| ---------------- | ------------------------------------------------------------- |
| Type             | ENHANCEMENT                                                   |
| Complexity       | MEDIUM                                                        |
| Systems Affected | plugins/codebase-intelligence/skills/ship.md                 |
| Dependencies     | git, gh CLI (already required by ship.md)                     |
| Estimated Tasks  | 6                                                             |

---

## UX Design

### Before State
```
USER: /ship or use ship skill
  │
  ▼
Step 1: Scan (git status, diff, log) → shows files changed
  │
  ▼
Step 2: Stage & Commit → ASK user to confirm files + message
  │
  ▼
Step 3: Push → ASK user to confirm push
  │
  ▼
Step 4: Pull Request
  - Analyzes commits on branch
  - Drafts SIMPLE PR (2-4 bullets + test plan)
  - ASK user to confirm title + body
  - Creates PR with gh pr create
  - Shows PR URL

PAIN_POINT: PR body is minimal, doesn't match team template
DATA_FLOW: git commits → summarization → simple markdown → gh pr create
```

### After State
```
USER: /ship or use ship skill
  │
  ▼
[Steps 1-3 remain UNCHANGED]
  │
  ▼
Step 4: Pull Request (ENHANCED)
  4a. Load PR_TEMPLATE.md
  4b. Gather metadata (branch name, commits, diff stats, author)
  4c. Analyze and populate template sections:
      - Description: summarize commits (2-4 bullets)
      - Type: auto-detect from commit prefixes (feat/fix/refactor)
      - Technical Details: extract from commits + diff
      - Testing: list files changed in tests/
      - Links: extract JIRA ticket from branch name (pattern: [A-Z]+-[0-9]+)
      - Remove HTML comments
  4d. ASK user to confirm or edit filled template
  4e. Create PR with gh pr create --body "$TEMPLATE"
  4f. Show PR URL

VALUE_ADD:
✓ PR descriptions match team template automatically
✓ All sections populated with intelligent defaults
✓ JIRA tickets auto-linked from branch names
✓ Type checkboxes pre-selected
✓ Test files automatically listed
✓ User can still edit before creation

DATA_FLOW: PR_TEMPLATE.md + git metadata → template population → user confirmation → gh pr create
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| Step 4 (PR creation) | Simple 2-4 bullet description | Full template with Description, Type, Technical Details, Testing, Checklist, Review Focus, Links | PRs automatically meet team standards, less manual editing |
| PR confirmation | Title + short body | Title + full structured body | User reviews comprehensive PR before creation |
| JIRA linking | Manual addition | Auto-extracted from branch name | Automatic issue linking (e.g., `SIT-123` from branch `feature/SIT-123-add-auth`) |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `plugins/codebase-intelligence/skills/ship.md` | 1-71 | Existing workflow to EXTEND (Steps 1-3 stay unchanged) |
| P0 | `PR_TEMPLATE.md` | 1-84 | Template structure to MIRROR in output |
| P1 | `plugins/codebase-intelligence/skills/task-memory.md` | 58-66 | Heredoc pattern for file content |
| P2 | `plugins/codebase-intelligence/skills/kb-indexer.md` | 1-172 | Template loading and population pattern |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [gh CLI manual](https://cli.github.com/manual/gh_pr_create) | gh pr create | --body parameter usage |
| [Git log formats](https://git-scm.com/docs/git-log#_pretty_formats) | --pretty=format | Commit message extraction |

---

## Patterns to Mirror

**SKILL_YAML_FRONTMATTER:**
```yaml
# SOURCE: plugins/codebase-intelligence/skills/ship.md:1-17
# COPY THIS PATTERN for allowed-tools:
---
name: ship
description: Scan changes, commit, push, and create a PR — with confirmation at each step
argument-hint: "[optional commit message or PR title]"
disable-model-invocation: true
allowed-tools:
  - Bash(git status)
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git push *)
  - Bash(git checkout *)
  - Bash(git branch *)
  - Bash(gh pr create *)
  - Bash(gh pr view *)
  - Bash(cat *)  # ADD THIS for reading PR_TEMPLATE.md
---
```

**USER_CONFIRMATION_PATTERN:**
```markdown
# SOURCE: plugins/codebase-intelligence/skills/ship.md:43-44, 62
# COPY THIS PATTERN for Step 4 confirmation:
- **ASK the user to confirm or edit**: show the exact files to stage and the proposed commit message
- Only after confirmation: stage the files and create the commit

- **ASK the user to confirm or edit** the title and body
- Only after confirmation: create the PR with `gh pr create`
```

**GIT_METADATA_EXTRACTION:**
```bash
# SOURCE: PR_TEMPLATE.md:9-23
# COPY THIS PATTERN for gathering PR data:

# Get current branch name
git branch --show-current

# Get list of commits on this branch (not in main)
git log main..HEAD --author="Artur Gomes" --oneline

# Get detailed commit messages
git log main..HEAD --author="Artur Gomes" --pretty=format:"%B"

# Get the actual code changes
git diff main...HEAD

# Get file statistics
git diff main...HEAD --stat
```

**HEREDOC_FILE_READING:**
```bash
# SOURCE: task-memory.md:58-66 (adapted for reading)
# COPY THIS PATTERN for loading PR_TEMPLATE.md:

TEMPLATE_CONTENT=$(cat PR_TEMPLATE.md)
# Then use $TEMPLATE_CONTENT in string manipulation
```

**COMMIT_MESSAGE_STYLE:**
```markdown
# SOURCE: .git/logs/HEAD (recent commits)
# COPY THIS PATTERN for commit message analysis:
feat: rename commands to codebase-intelligence:prp-plan
fix: memory path back to ~/.claude/memory/
docs: rewrite README with accurate installation guide

# Format: {type}: {description}
# Types: feat, fix, docs, refactor, test, chore
```

**TEMPLATE_COMMENT_REMOVAL:**
```markdown
# SOURCE: PR_TEMPLATE.md:27
# RULE: Never write HTML comments in output
# PATTERN: Strip lines matching <!-- .* -->
```

---

## Files to Change

| File                             | Action | Justification                            |
| -------------------------------- | ------ | ---------------------------------------- |
| `plugins/codebase-intelligence/skills/ship.md` | UPDATE | Enhance Step 4 with template loading and population logic |

---

## NOT Building (Scope Limits)

Explicit exclusions to prevent scope creep:

- **NOT auto-pushing PRs without confirmation** - Maintains user control over remote operations (security)
- **NOT modifying PR_TEMPLATE.md file** - It's a reference template, not a per-PR file
- **NOT generating test code** - Only listing test files that changed
- **NOT fetching JIRA issue details via API** - Just extracting ticket ID from branch name (e.g., `SIT-123`)
- **NOT supporting multiple PR templates** - Single template file only (`PR_TEMPLATE.md`)
- **NOT changing Steps 1-3** - Scan, stage/commit, push remain unchanged to preserve proven workflow
- **NOT storing PR drafts** - One-time generation per invocation
- **NOT validating JIRA ticket existence** - Assumes branch naming convention is correct

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

### Task 1: UPDATE `plugins/codebase-intelligence/skills/ship.md` (YAML frontmatter)

- **ACTION**: ADD `Bash(cat *)` to allowed-tools list
- **IMPLEMENT**: Insert `- Bash(cat *)` after line 17 (after `Bash(gh pr view *)`)
- **MIRROR**: `plugins/codebase-intelligence/skills/ship.md:6-17`
- **RATIONALE**: Enable reading PR_TEMPLATE.md file content
- **VALIDATE**: Check YAML syntax is valid (indentation matches existing lines)

### Task 1.5: UPDATE `plugins/codebase-intelligence/skills/ship.md` (add protected branch check in Step 2)

- **ACTION**: INSERT branch protection check at the start of Step 2 (Stage & Commit)
- **LOCATION**: After line 32 (after "## Step 2: Stage & Commit" header)
- **IMPLEMENT**: Add branch validation before allowing commits
- **CONTENT**:
```markdown

### Protected Branch Check

Before allowing any commits, verify the current branch:

```bash
# Get current branch name
CURRENT_BRANCH=$(git branch --show-current)

# Check if on a protected branch
if [[ "$CURRENT_BRANCH" =~ ^(main|master|develop|development|qa|staging|production|prod)$ ]]; then
  echo "ERROR: Cannot commit directly to protected branch: $CURRENT_BRANCH"
  echo "Please create a feature branch first:"
  echo "  git checkout -b feature/your-branch-name"
  exit 1
fi
```

- **STOP** if on a protected branch and show the error message
- Only proceed to staging if on a non-protected branch
```
- **RATIONALE**: Prevent accidental commits to protected branches (main, master, develop, qa, staging, production)
- **VALIDATE**: Logic is clear and stops execution before any staging occurs

### Task 2: UPDATE `plugins/codebase-intelligence/skills/ship.md` (Step 4 header)

- **ACTION**: REPLACE existing Step 4 header and intro text
- **LOCATION**: Lines 54-55 (## Step 4: Pull Request section)
- **OLD_TEXT**:
```markdown
## Step 4: Pull Request

- Check if a PR already exists for this branch (`gh pr view` — if it exists, show the URL and stop)
```
- **NEW_TEXT**:
```markdown
## Step 4: Pull Request (Enhanced with Template)

- Check if a PR already exists for this branch (`gh pr view` — if it exists, show the URL and stop)
```
- **VALIDATE**: Section header renders correctly in markdown

### Task 3: UPDATE `plugins/codebase-intelligence/skills/ship.md` (insert Step 4a-4c)

- **ACTION**: INSERT new sub-steps after line 56 (after "gh pr view" check, before "Analyze ALL commits")
- **IMPLEMENT**: Add detailed template loading and population instructions
- **CONTENT**:
```markdown

### Step 4a: Load PR Template

- Read the PR template file: `cat PR_TEMPLATE.md`
- Store content in a variable for manipulation
- If file doesn't exist, warn user and fallback to simple format (current behavior)

### Step 4b: Gather PR Metadata

Run these git commands to extract information for template population:

```bash
# Get current branch name
BRANCH=$(git branch --show-current)

# Extract JIRA ticket from branch name (pattern: [A-Z]+-[0-9]+)
TICKET=$(echo "$BRANCH" | grep -oE '[A-Z]+-[0-9]+' | head -1)

# Get commit messages on this branch (not in main)
COMMITS=$(git log main..HEAD --pretty=format:"%s")

# Get detailed commit messages for description
COMMIT_DETAILS=$(git log main..HEAD --pretty=format:"%B")

# Get file statistics
FILE_STATS=$(git diff main...HEAD --stat)

# Get files changed in tests/
TEST_FILES=$(git diff main...HEAD --name-only | grep -E '(test|spec)\.(ts|js|tsx|jsx|py|rb)' || echo "No test files modified")

# Get author name
AUTHOR=$(git config user.name)
```

### Step 4c: Analyze and Populate Template

Parse the template and fill sections with intelligent defaults:

1. **Description section**:
   - Summarize commits into 2-4 bullet points
   - Add "Fixes #(issue)" line, replacing "(issue)" with $TICKET if found, otherwise leave as placeholder

2. **Type of Change checkboxes**:
   - Auto-detect from commit message prefixes:
     - `fix:` → mark "Bug fix"
     - `feat:` → mark "New feature"
     - `refactor:` → mark "Refactoring"
     - `docs:` → mark "Documentation update"
     - `perf:` → mark "Performance improvement"
   - Mark checkbox by replacing `[ ]` with `[x]`

3. **Technical Details / What changed**:
   - List key files modified from $FILE_STATS
   - Extract architectural notes from commit messages (look for multi-line commits)

4. **Testing section**:
   - List files from $TEST_FILES
   - If $TEST_FILES is empty, write "No test files modified in this PR"

5. **Links section**:
   - Replace "(issue)" with actual JIRA ticket: `Issue number [${TICKET}](link/to/jira)`
   - If no ticket found, leave as placeholder

6. **Remove HTML comments**:
   - Strip all lines matching `<!-- .* -->` per template rules (PR_TEMPLATE.md:27)

7. Store the filled template in a variable for user review

```
- **MIRROR**: PR_TEMPLATE.md:9-23 for git commands, line 27 for comment removal rule
- **VALIDATE**: Logic is clear and follows existing Step 4 pattern

### Task 4: UPDATE `plugins/codebase-intelligence/skills/ship.md` (update existing Step 4 instructions)

- **ACTION**: REPLACE lines 57-62 (old PR drafting logic) with new template-based flow
- **OLD_TEXT**:
```markdown
- Analyze ALL commits on this branch vs the base branch (not just the latest commit)
- Draft a PR title (under 72 chars) and body with:
  - Summary: 2-4 bullet points
  - Test plan: how to verify
- **ASK the user to confirm or edit** the title and body
- Only after confirmation: create the PR with `gh pr create`
```
- **NEW_TEXT**:
```markdown

### Step 4d: Present Filled Template

- Show the user the populated template
- **ASK the user to confirm or edit** the title and filled template body
- Use AskUserQuestion tool to allow editing the PR description before creation
- If user edits, use their edited version; otherwise use the populated template

### Step 4e: Create Pull Request

- Only after user confirmation: create the PR using:
  ```bash
  gh pr create --title "TITLE" --body "$(cat <<'EOF'
  $FILLED_TEMPLATE_CONTENT
  EOF
  )"
  ```
- Handle the case where template body contains special characters (use heredoc for safety)
```
- **VALIDATE**: Flow maintains user confirmation pattern, uses heredoc for safety

### Task 5: UPDATE `plugins/codebase-intelligence/skills/ship.md` (update Rules section)

- **ACTION**: ADD new rules about template fallback and protected branches
- **LOCATION**: Lines 65-71 (## Rules section)
- **INSERT_AFTER**: Line 70 (after "If $ARGUMENTS is provided...")
- **CONTENT**:
```markdown
- If PR_TEMPLATE.md is not found, fallback to simple format (2-4 bullets + test plan)
- NEVER skip the user confirmation step for the filled template
- NEVER allow commits to protected branches (main, master, develop, development, qa, staging, production, prod)
- Check branch name at the start of Step 2 and STOP with error if on protected branch
```
- **VALIDATE**: Rules section is complete and consistent

### Task 6: VALIDATE the updated skill file

- **ACTION**: Read the entire updated `ship.md` file and verify coherence
- **CHECK**:
  - [ ] YAML frontmatter includes `Bash(cat *)`
  - [ ] Step 2 includes protected branch check before staging
  - [ ] Step 4 is enhanced with sub-steps 4a-4e
  - [ ] Old PR drafting logic is replaced (not duplicated)
  - [ ] User confirmation pattern is preserved
  - [ ] Rules section includes template fallback rule AND protected branch rule
  - [ ] File is valid markdown
- **VALIDATE**: Use markdown linter or manual review for structure

---

## Testing Strategy

### Manual Testing Checklist

Since this is a skill file (markdown with instructions), testing is manual execution:

| Test Scenario | Steps | Expected Result |
|---------------|-------|-----------------|
| **Happy path with JIRA branch** | 1. Create branch `feature/SIT-123-test`<br>2. Make changes, commit with `feat:` prefix<br>3. Run ship skill<br>4. Confirm PR creation | PR body has Description filled, "New feature" checked, Links section has `SIT-123` |
| **Branch without JIRA ticket** | 1. Create branch `feature/test-no-ticket`<br>2. Make changes<br>3. Run ship skill | PR body has "Fixes #(issue)" placeholder, rest of template filled |
| **Mixed commit types** | 1. Commit with `fix:` and `feat:` prefixes<br>2. Run ship skill | Both "Bug fix" and "New feature" checkboxes marked |
| **Test files changed** | 1. Modify `src/app.test.ts`<br>2. Run ship skill | Testing section lists `src/app.test.ts` |
| **No test files changed** | 1. Modify only `src/app.ts` (no tests)<br>2. Run ship skill | Testing section says "No test files modified in this PR" |
| **PR_TEMPLATE.md missing** | 1. Rename PR_TEMPLATE.md temporarily<br>2. Run ship skill | Fallback to simple format, warning shown |
| **User edits template** | 1. Run ship skill<br>2. Edit the description in confirmation step<br>3. Confirm | PR created with user's edited content |
| **Existing PR on branch** | 1. Create PR manually<br>2. Run ship skill | Shows existing PR URL, stops without creating duplicate |

### Edge Cases Checklist

- [ ] Branch name with no letters (numeric only) → JIRA extraction fails gracefully
- [ ] Commit messages with no conventional prefix → Type section has no checkboxes marked (all unchecked)
- [ ] Very long commit messages (>1000 chars) → Summarization truncates intelligently
- [ ] Special characters in commit messages (quotes, backticks) → Heredoc escaping works
- [ ] PR_TEMPLATE.md file is empty → Fallback to simple format
- [ ] Author name contains special characters → Name renders correctly in template
- [ ] Diff output is huge (100+ files) → Template doesn't overflow, shows summary
- [ ] User runs ship on main branch → Protected branch check stops execution with error
- [ ] User runs ship on master branch → Protected branch check stops execution with error
- [ ] User runs ship on develop/qa/staging → Protected branch check stops execution with error

---

## Validation Commands

**IMPORTANT**: This is a skill file (markdown), not executable code. Validation is primarily manual.

### Level 1: FILE_STRUCTURE

```bash
# Validate YAML frontmatter
head -20 plugins/codebase-intelligence/skills/ship.md | grep -E "^(name|description|allowed-tools):"

# Check markdown syntax
npx markdownlint-cli plugins/codebase-intelligence/skills/ship.md || echo "Install markdownlint: npm i -g markdownlint-cli"
```

**EXPECT**: YAML keys present, markdown lint passes (or manual review confirms structure)

### Level 2: PATTERN_VERIFICATION

```bash
# Verify Bash(cat *) is in allowed-tools
grep -n "Bash(cat \*)" plugins/codebase-intelligence/skills/ship.md

# Verify Step 4a, 4b, 4c, 4d, 4e sections exist
grep -n "### Step 4[a-e]:" plugins/codebase-intelligence/skills/ship.md
```

**EXPECT**:
- "Bash(cat *)" found on line ~18
- Five matches for Step 4a through 4e

### Level 3: MANUAL_EXECUTION

```bash
# Test the skill end-to-end
1. Create test branch: git checkout -b feature/TEST-999-validate-ship
2. Make a small change: echo "test" >> README.md
3. Invoke skill: Use ship skill in Claude Code
4. Follow prompts through Steps 1-4
5. Verify Step 4 loads PR_TEMPLATE.md
6. Verify filled template is shown for confirmation
7. Confirm or cancel (test both paths)
```

**EXPECT**:
- PR_TEMPLATE.md content is read
- Template sections are populated with metadata
- User can edit before creation
- PR is created with filled template body

---

## Acceptance Criteria

- [ ] `ship.md` YAML frontmatter includes `Bash(cat *)` in allowed-tools
- [ ] Step 2 includes protected branch check that prevents commits to main/master/develop/qa/staging/production
- [ ] Protected branch check stops execution with clear error message and suggests creating a feature branch
- [ ] Step 4 has sub-steps 4a (Load Template), 4b (Gather Metadata), 4c (Populate), 4d (Confirm), 4e (Create)
- [ ] Git commands extract: branch name, JIRA ticket, commits, diff stats, test files, author
- [ ] Template population logic fills: Description, Type checkboxes, Technical Details, Testing, Links
- [ ] HTML comments are stripped from template output
- [ ] User confirmation step is preserved (ASK before creating PR)
- [ ] Fallback to simple format if PR_TEMPLATE.md is missing
- [ ] Rules section includes template fallback rule AND protected branch rule
- [ ] Manual testing confirms PR body matches PR_TEMPLATE.md structure
- [ ] Manual testing confirms ship stops with error when run on protected branches
- [ ] No regressions in Steps 1-3 (scan, stage/commit, push)

---

## Completion Checklist

- [ ] Task 1: `Bash(cat *)` added to allowed-tools
- [ ] Task 1.5: Protected branch check added to Step 2
- [ ] Task 2: Step 4 header updated to "Enhanced with Template"
- [ ] Task 3: Sub-steps 4a-4c inserted with template loading logic
- [ ] Task 4: Sub-steps 4d-4e replace old PR drafting logic
- [ ] Task 5: Rules section updated with fallback rule AND protected branch rule
- [ ] Task 6: Full file validation completed
- [ ] Level 1: File structure validation passes
- [ ] Level 2: Pattern verification passes
- [ ] Level 3: Manual execution test passes (including protected branch test)
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk               | Likelihood   | Impact       | Mitigation                              |
| ------------------ | ------------ | ------------ | --------------------------------------- |
| Accidental commit to protected branch | HIGH | CRITICAL | Protected branch check at start of Step 2, stops execution immediately with error |
| PR_TEMPLATE.md structure changes | MEDIUM | LOW | Fallback to simple format if template parsing fails |
| Branch naming convention varies | MEDIUM | LOW | JIRA extraction regex is lenient, leaves placeholder if not found |
| Git commands fail (not a git repo) | LOW | HIGH | ship.md already assumes git repo, no additional risk |
| Template population creates malformed markdown | LOW | MEDIUM | Use heredoc for safe string handling, user reviews before creation |
| Very large diff output breaks template | LOW | LOW | Git commands use `--stat` for summary, not full diff content |

---

## Notes

**Design Decisions**:
- Chose to extend existing `ship.md` rather than create separate skill to avoid duplication
- Added protected branch check at start of Step 2 to prevent accidental commits to main/master/develop/qa/staging/production
- Protected branch list uses regex matching for flexibility (covers common variants like development, prod, production)
- Maintained Steps 1-3 flow, but added safety check before any staging occurs
- Used heredoc pattern for template body to safely handle special characters
- Extraction regex `[A-Z]+-[0-9]+` matches common JIRA ticket formats (e.g., SIT-123, PROJ-456)
- Auto-detection of commit types uses conventional commit prefixes (feat/fix/docs/refactor/perf)

**Trade-offs**:
- More complex Step 4 instructions vs. better PR quality → chose quality
- Auto-population vs. manual editing → chose auto-population with user confirmation
- Single template file vs. multiple templates → chose single for simplicity

**Future Considerations**:
- Could add configuration file for custom JIRA URL patterns
- Could support multiple PR templates (e.g., PR_TEMPLATE_FEATURE.md, PR_TEMPLATE_HOTFIX.md)
- Could integrate with JIRA API to fetch issue details (title, description) for even richer PR context
- Could store PR drafts in `.claude/memory/` for recovery if gh pr create fails

**Confidence**: This plan leverages existing proven patterns (ship.md workflow, task-memory.md heredoc, PR_TEMPLATE.md structure) and adds minimal new logic (template parsing + population). Risk is LOW because fallback to simple format is built in.
