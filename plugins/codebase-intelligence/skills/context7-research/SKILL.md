---
name: context7-research
description: >
  Fetch accurate, version-specific library documentation via the Context7 MCP before
  writing any code that uses an external dependency. Invoked automatically during
  prp-plan Phase 3 RESEARCH and prp-implement Phase 3 when a task involves a library.
  Also invoke manually when asked "how does X work in version Y", "what's the API for Z",
  "look up the docs for", or any question about a library's current interface.
  Prevents hallucinated API calls by grounding every library usage in live documentation.
version: 2.0.1
---

# context7-research

Fetches live, version-matched documentation through the Context7 MCP.
**No library API should be written from memory.** Always verify against Context7 first.

If Context7 MCP is unavailable, fall back to `codebase-intelligence:web-researcher` for docs but flag the response as **unverified** in the plan.

## Workflow

### Step 1 — Identify libraries in scope

Read the exact version of `{library}` from `package.json` (or `pyproject.toml` / `Cargo.toml` / `go.mod`) — never assume.

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

Compare findings to what the plan implements:
- ✅ API matches docs → Proceed
- ⚠️ API differs slightly → Update task before implementing
- 🔴 API doesn't exist → Raise immediately, fix plan
- 🟡 API is deprecated → Note, use recommended replacement

### Step 6 — Document findings

Write a `## Context7 Library Facts` block in the plan or implementation notes.

**Output schema**:
- Section heading: `## Context7 Library Facts`
- One sub-heading per `### {library-name}@{version}` with `Docs fetched: {topic}`
- Bullet groups (each: include only if any): **Confirmed signatures**, **Gotchas found in docs**, **Deprecated in this version**

---

## Integration

Auto-invoked during `prp-plan` Phase 3 RESEARCH and `prp-implement` Phase 3. If `Context7 Library Facts` already documents this `{library}@{version}`, reuse — don't refetch.
