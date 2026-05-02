---
name: benchmark-kb
description: >
  Run bookrag retrieval quality benchmark against the obsidian-vault knowledge base.
  Execute /codebase-intelligence:benchmark-kb [domain] to benchmark semantic and hybrid
  retrieval modes and display MRR/Recall@5/Recall@10/Precision@5 metrics per mode.
  Optionally compare against a saved baseline to detect regressions. Domain argument:
  software-craft | functional-programming | all (default: all).
argument-hint: "[software-craft | functional-programming | all]"
version: 1.0.0
---

# benchmark-kb

Run bookrag retrieval quality benchmarks against the obsidian-vault knowledge base.
Reports MRR, Recall@5, Recall@10, and Precision@5 for `semantic` and `hybrid` modes.
Compares against a saved baseline when one exists.

---

## Paths

| Resource | Path |
|---|---|
| bookrag project | `~/Documents/ai-tools/skills-mono-repo` |
| DB | `~/Documents/ai-tools/skills-mono-repo/master-kb/domains/obsidian-vault/bookrag.db` |
| Settings | `~/Documents/ai-tools/skills-mono-repo/bookrag/config/settings.toml` |
| Fixtures dir | `~/Documents/ai-tools/skills-mono-repo/bookrag/data/benchmarks/` |
| Baselines dir | `~/Documents/ai-tools/skills-mono-repo/master-kb/data/eval/` |
| software-craft fixture | `~/Documents/ai-tools/skills-mono-repo/bookrag/data/benchmarks/software-craft.json` (25 queries) |
| functional-programming fixture | `~/Documents/ai-tools/skills-mono-repo/bookrag/data/benchmarks/functional-programming.json` (31 queries) |

---

## Step 1 — Parse domain argument

Read `$ARGUMENTS` (trimmed, lowercase):

| Argument | DOMAINS list |
|---|---|
| `software-craft` | `["software-craft"]` |
| `functional-programming` | `["functional-programming"]` |
| `all` or empty | `["software-craft", "functional-programming"]` |
| anything else | Print error: "Unknown domain '{arg}'. Use: software-craft \| functional-programming \| all" and stop |

Store as `{DOMAINS}`.

---

## Step 2 — Validate environment

Run these checks before benchmarking:

```bash
# Check uv is available
uv --version

# Check DB exists
ls ~/Documents/ai-tools/skills-mono-repo/master-kb/domains/obsidian-vault/bookrag.db

# Check each fixture exists (for each domain in DOMAINS)
ls ~/Documents/ai-tools/skills-mono-repo/bookrag/data/benchmarks/{domain}.json
```

Print summary:
```
Environment: uv ✅ | DB ✅ | Fixtures: {domain-list} ✅
```

If any check fails, print the error and go to **Fallback** section.

---

## Step 3 — Run benchmark for each domain

For **each domain** in `{DOMAINS}`:

**Check for baseline:**
```bash
ls ~/Documents/ai-tools/skills-mono-repo/master-kb/data/eval/{domain}-baseline.json
```

**If no baseline exists** — run without comparison:
```bash
uv run --directory ~/Documents/ai-tools/skills-mono-repo \
  bookrag benchmark \
  --queries ~/Documents/ai-tools/skills-mono-repo/bookrag/data/benchmarks/{domain}.json \
  --db ~/Documents/ai-tools/skills-mono-repo/master-kb/domains/obsidian-vault/bookrag.db \
  --settings ~/Documents/ai-tools/skills-mono-repo/bookrag/config/settings.toml \
  --modes semantic,hybrid \
  --output /tmp/bookrag-bench-{domain}.json
```

**If baseline exists** — run with comparison and drift check:
```bash
uv run --directory ~/Documents/ai-tools/skills-mono-repo \
  bookrag benchmark \
  --queries ~/Documents/ai-tools/skills-mono-repo/bookrag/data/benchmarks/{domain}.json \
  --db ~/Documents/ai-tools/skills-mono-repo/master-kb/domains/obsidian-vault/bookrag.db \
  --settings ~/Documents/ai-tools/skills-mono-repo/bookrag/config/settings.toml \
  --modes semantic,hybrid \
  --output /tmp/bookrag-bench-{domain}.json \
  --compare ~/Documents/ai-tools/skills-mono-repo/master-kb/data/eval/{domain}-baseline.json \
  --check-drift \
  --drift-threshold 0.05
```

Note: First run may take 30–60 s — embeddings are computed per query. Subsequent runs are faster (cached).

If the command exits non-zero and stderr contains `WARNING: sparse`, log: "⚠️ Sparse index detected for {domain} — hybrid mode may degrade. Run `bookrag build-sparse-index` to fix."

---

## Step 4 — Display results

After each domain benchmark completes, read `/tmp/bookrag-bench-{domain}.json` and display a metrics table.

**Result JSON schema** (confirmed from `benchmark.py:116-127`):
```json
{
  "aggregate": { "mode": "...", "num_queries": 25, "mrr": 0.42, "recall@5": 0.68, "recall@10": 0.82 },
  "per_mode": {
    "semantic": { "mrr": 0.38, "recall@5": 0.62, "recall@10": 0.77, "precision@5": 0.19 },
    "hybrid":   { "mrr": 0.45, "recall@5": 0.71, "recall@10": 0.84, "precision@5": 0.23 }
  },
  "per_query": [...],
  "skipped_modes": []
}
```

**Table format (no baseline):**
```
## {domain} — {num_queries} queries

| Mode     | MRR  | Recall@5 | Recall@10 | Precision@5 |
|----------|------|----------|-----------|-------------|
| semantic | 0.38 | 0.62     | 0.77      | 0.19        |
| hybrid   | 0.45 | 0.71     | 0.84      | 0.23        |
```

**Table format (baseline present — add Δ columns):**

Read the baseline JSON from `~/Documents/ai-tools/skills-mono-repo/master-kb/data/eval/{domain}-baseline.json` and compute delta = current − baseline for each metric. Format delta as `+0.03` (green) or `-0.02` (regression).

```
## {domain} — {num_queries} queries

| Mode     | MRR  | Δ MRR | Recall@5 | Δ R@5 | Recall@10 | Δ R@10 | Precision@5 | Δ P@5 |
|----------|------|-------|----------|-------|-----------|--------|-------------|-------|
| semantic | 0.38 | +0.02 | 0.62     | -0.01 | 0.77      | +0.00  | 0.19        | +0.01 |
| hybrid   | 0.45 | +0.03 | 0.71     | +0.02 | 0.84      | +0.01  | 0.23        | +0.02 |
```

If `skipped_modes` is non-empty, print: "⚠️ Skipped modes: {list} — check bookrag output for reason."

If `per_mode` key is missing (older bookrag), fall back to `aggregate` and print: "⚠️ per_mode not found — showing aggregate only."

---

## Step 5 — Baseline management

**After displaying all domain results:**

**If no baseline exists for any domain benchmarked:**
```
No baseline found for: {domain-list}

To save today's results as the baseline, run:

  uv run --directory ~/Documents/ai-tools/skills-mono-repo \
    bookrag benchmark \
    --queries ~/Documents/ai-tools/skills-mono-repo/bookrag/data/benchmarks/{domain}.json \
    --db ~/Documents/ai-tools/skills-mono-repo/master-kb/domains/obsidian-vault/bookrag.db \
    --settings ~/Documents/ai-tools/skills-mono-repo/bookrag/config/settings.toml \
    --modes semantic,hybrid \
    --save-baseline ~/Documents/ai-tools/skills-mono-repo/master-kb/data/eval/{domain}-baseline.json

Run once per domain. Re-run after a DB rebuild to update the baseline.
```

**If drift was detected** (benchmark command exited non-zero with `--check-drift`):
```
⚠️ DRIFT DETECTED for {domain}:
  Metrics that regressed beyond 0.05 threshold:
  - {mode} {metric}: {baseline_val} → {current_val} (Δ {delta})

To acknowledge and update baseline, re-run with --save-baseline.
To investigate: check if DB was rebuilt or fixtures changed since last baseline.
```

**If baseline exists and no drift** (command exited 0 with `--check-drift`):
```
✅ No drift detected for {domain} (threshold: 0.05)
```

---

## Fallback

| Condition | Resolution |
|---|---|
| `uv: command not found` | Install uv: `curl -LsSf https://astral.sh/uv/install.sh \| sh` then restart shell |
| DB not found | Run `bookrag build` or `bookrag ingest` to create the DB first |
| Fixture not found | Run: `uv run --directory ~/Documents/ai-tools/skills-mono-repo bookrag create-benchmark --mode auto --domain {domain}` |
| `poor-man-mcp-search-engine: not found` | Ignore — `run-benchmark.md` in this repo is outdated. This skill uses `bookrag benchmark` directly |
| Fixture chunk IDs stale (after DB rebuild) | Re-run `bookrag create-benchmark --mode auto` to refresh fixture chunk IDs |
| bookrag exits non-zero (not drift) | Print stderr output; check `bookrag benchmark --help` for required flags |

---

## Quick examples

```bash
# Benchmark all domains (default)
/codebase-intelligence:benchmark-kb

# Single domain
/codebase-intelligence:benchmark-kb software-craft
/codebase-intelligence:benchmark-kb functional-programming
```
