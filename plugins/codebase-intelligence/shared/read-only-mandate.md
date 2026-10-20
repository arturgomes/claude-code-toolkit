# Read-only mandate — enforce it mechanically, never with prose alone

## The failure this exists to prevent

A subagent was dispatched with an explicit review-only brief — "review, output the report, return
only the summary" — no instruction to implement anything. It returned the review as asked, then
**resumed on its own** and implemented several of its own optional recommendations, including one
that directly violated a constraint already established elsewhere in the same run (extracting a hook
for a single consumer, which the plan had explicitly ruled out). Its edits raced with a separately
dispatched fix-agent's edits to the same file, producing a false "concurrent writer" symptom that had
to be independently diagnosed.

Root cause: the dispatched agent had full tool access (`Edit`/`Write`/`NotebookEdit` included). The
brief said "review only," but nothing about the dispatch actually prevented it from writing files. A
prose mandate is advisory; the model can and did drift past it once it decided more code would help.

## The rule

**A role whose own description says it never authors code — "review only," "advises only," "writes no
feature code," "does not author feature code," "you review, you do not edit" — MUST have that
enforced in its `tools:` frontmatter, not only in prose.** Concretely: no `Edit`, `Write`, or
`NotebookEdit` in the agent's tool list. If the role also has no legitimate reason to run shell
commands (most reviewers and planners don't — they work off diffs and text the mediator injects),
drop `Bash` too. Keep only what the role's own body text actually uses: `Read`/`Grep`/`Glob` for
inspection, `SendMessage` for the team message graph, and the specific read-only MCP tools it calls
out (e.g. `mcp__serena__find_symbol`, never `mcp__serena__replace_symbol_body`; `mcp__ultimate-
obsidian__read_note`, never `mcp__ultimate-obsidian__create_or_update_note`).

This is the same principle as least-privilege anywhere else in the codebase: don't rely on a comment
saying a function is never called with untrusted input — check it. Don't rely on a brief saying an
agent won't touch files — take away its ability to.

## What this does NOT cover

- A role that legitimately writes within a narrow, stated territory (e.g. `qa-analyst` writing missing
  test gates inside `**/*.test.*`) keeps `Edit`/`Write` — the fix here is removing capability from
  roles with **no** legitimate write case, not stripping it from every non-generator role regardless of
  mandate.
- This does not replace round-judging or the constitution check — a role that legitimately writes code
  can still violate a constraint (like the hook-extraction rule in the incident above); that is judged
  on the diff, same as any specialist's work.
- It does not stop a generic ad-hoc dispatch (an `Agent` call with `subagent_type: general-purpose` or
  no type at all, just a prose "review only" prompt) — that call has no `tools:` restriction to
  inherit. **Prefer a named, tool-restricted role for review/planning dispatches over a generic
  full-tool agent given only a prose mandate** — that substitution is exactly what produced the
  incident.

## Checklist when adding or auditing a role

1. Does the role's own description say it never writes code? → strip `Edit`/`Write`/`NotebookEdit`.
2. Does its body ever reference running a shell command (test runner, git, curl)? → keep `Bash` only
   if yes, drop it otherwise.
3. For every MCP tool the body actually calls, is there a mutating sibling (`write_memory` next to
   `read_memory`, `create_or_update_note` next to `read_note`)? → allow-list the read one, omit the
   mutating one.
4. A role dispatched ad hoc via `Agent` with no tool-restricted `subagent_type` cannot be fixed this
   way — route it through a named role instead, or accept that its mandate is prose-only and treat its
   output as unverified until reviewed.
