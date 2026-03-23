---
name: context7-research
description: >
  Fetch accurate, version-specific library documentation via the Context7 MCP before
  writing any code that uses an external dependency. Invoked automatically during
  prp-plan Phase 3 RESEARCH and prp-implement Phase 3 when a task involves a library.
  Also invoke manually when asked "how does X work in version Y", "what's the API for Z",
  "look up the docs for", or any question about a library's current interface.
  Prevents hallucinated API calls by grounding every library usage in live documentation.
user-invocable: true
---

# context7-research

Fetches live, version-matched documentation through the Context7 MCP.
**No library API should be written from memory.** Always verify against Context7 first.

## When to use

Trigger this skill before implementing code that:
- Calls a function or method from an external package
- Uses a framework's lifecycle hooks or configuration API
- Imports from a library where the API may have changed between versions
- Requires understanding of a library's current error types or response shapes

## Workflow

### Step 1 — Identify libraries in scope

From the plan's `package.json` dependency list and the current task, extract:
```
{library-name}@{exact-version-from-package.json}
```

Never assume a version. Always read it from `package.json` (or `pyproject.toml`, `Cargo.toml`, `go.mod`).

### Step 2 — Resolve library ID via Context7

```
mcp: context7 → resolve-library-id
query: "{library-name}"
```

Take the best match. If ambiguous, prefer the one matching the package's npm/PyPI name exactly.

### Step 3 — Fetch relevant documentation

```
mcp: context7 → get-library-docs
library_id: "{resolved-id}"
topic: "{specific area needed — e.g. 'retry', 'auth middleware', 'schema validation'}"
tokens: 5000   ← keep focused; increase only if the topic is genuinely complex
```

Fetch only the section relevant to the current task. Do not dump entire library docs.

### Step 4 — Extract actionable facts

From the fetched docs, capture:
- **Exact function/method signatures** with parameter names and types
- **Required vs optional parameters**
- **Error types thrown** and their meanings
- **Breaking changes** noted in the version's changelog section (if present)
- **Deprecations** — is the API the plan references still current?

### Step 5 — Cross-check against the plan

Compare the Context7 findings against what the plan says to implement:

| Plan says | Context7 says | Action |
|-----------|---------------|--------|
| API matches docs | ✅ Confirmed | Proceed |
| API differs slightly | ⚠️ Deviation | Update task before implementing |
| API doesn't exist | 🔴 Hallucination | Raise immediately, fix plan |
| API is deprecated | 🟡 Warning | Note, use recommended replacement |

### Step 6 — Document findings

Write a `## Context7 Library Facts` block in the plan or implementation notes:

```markdown
## Context7 Library Facts

### {library-name}@{version}
Docs fetched: {topic}

**Confirmed signatures:**
- `functionName(param1: Type, param2?: Type): ReturnType`
- `ClassName.method(options: OptionsType): Promise<Result>`

**Gotchas found in docs:**
- {gotcha from official docs}

**Deprecated in this version:**
- `oldFunction()` → use `newFunction()` instead
```

---

## Integration with prp-plan Phase 3

During RESEARCH, run Context7 **before** the `prp-core:web-researcher` agent for any
library-related questions. Provide the confirmed signatures to the web-researcher so
it searches for usage patterns rather than basic API questions.

## Integration with prp-implement Phase 3

Before writing any task that uses an external library:
1. Check if the plan's `Context7 Library Facts` section already has this library documented
2. If yes → use those facts (skip the MCP call)
3. If no → run Context7 now, document findings, then implement

## MCP requirement

Context7 is registered once via `claude mcp add` (Claude Code terminal):

```bash
claude mcp add context7 \
  --scope user \
  --transport http \
  https://mcp.context7.com/mcp
```

`--scope user` makes it available in every project automatically. No per-repo config needed.

If Context7 MCP is unavailable: fall back to `prp-core:web-researcher` for docs,
but flag the response as **unverified** and note it in the plan.
