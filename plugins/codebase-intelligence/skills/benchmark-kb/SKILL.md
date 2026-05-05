---
name: benchmark-kb
description: >
  Benchmark bookrag retrieval on the obsidian-vault KB; reports MRR/Recall@5/Recall@10/Precision@5 per mode
  with optional regression check against a saved baseline. Domain: software-craft | functional-programming | all.
argument-hint: "[software-craft | functional-programming | all]"
version: 1.0.1
---

# benchmark-kb

Run bookrag retrieval quality benchmarks against the obsidian-vault knowledge base.
Reports MRR, Recall@5, Recall@10, and Precision@5 for `semantic` and `hybrid` modes.
Compares against a saved baseline when one exists.

Bookrag project root: `~/Documents/ai-tools/skills-mono-repo`. Paths inline in commands below.

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

```bash
uv --version
ls ~/Documents/ai-tools/skills-mono-repo/master-kb/domains/obsidian-vault/bookrag.db
ls ~/Documents/ai-tools/skills-mono-repo/bookrag/data/benchmarks/{domain}.json   # per domain
```

Print: `Environment: uv ✅ | DB ✅ | Fixtures: {domain-list} ✅`

If any check fails, go to **Fallback**.

---

## Step 3 — Run benchmark for each domain

For each domain in `{DOMAINS}`:

Check baseline:
```bash
ls ~/Documents/ai-tools/skills-mono-repo/master-kb/data/eval/{domain}-baseline.json
```

**Canonical command:**
```bash
uv run --directory ~/Documents/ai-tools/skills-mono-repo \
  bookrag benchmark \
  --queries ~/Documents/ai-tools/skills-mono-repo/bookrag/data/benchmarks/{domain}.json \
  --db ~/Documents/ai-tools/skills-mono-repo/master-kb/domains/obsidian-vault/bookrag.db \
  --settings ~/Documents/ai-tools/skills-mono-repo/bookrag/config/settings.toml \
  --modes semantic,hybrid \
  --output /tmp/bookrag-bench-{domain}.json
```

Tail-flag variants (append to canonical command):
- **Compare against baseline**: add `--compare ~/Documents/ai-tools/skills-mono-repo/master-kb/data/eval/{domain}-baseline.json --check-drift --drift-threshold 0.05`
- **Save new baseline**: add `--save-baseline ~/Documents/ai-tools/skills-mono-repo/master-kb/data/eval/{domain}-baseline.json`

Note: First run 30–60 s (embeddings computed per query); subsequent runs cached.

If exit non-zero with stderr `WARNING: sparse`: log "⚠️ Sparse index detected for {domain} — hybrid mode may degrade. Run `bookrag build-sparse-index` to fix."

---

## Step 4 — Display results

Read `/tmp/bookrag-bench-{domain}.json` (schema: `aggregate{mode,num_queries,mrr,recall@5,recall@10}`, `per_mode.{semantic,hybrid}.{mrr,recall@5,recall@10,precision@5}`, `per_query[]`, `skipped_modes[]`).

**No-baseline table:**
```
## {domain} — {num_queries} queries

| Mode     | MRR  | Recall@5 | Recall@10 | Precision@5 |
|----------|------|----------|-----------|-------------|
| semantic | …    | …        | …         | …           |
| hybrid   | …    | …        | …         | …           |
```

**Baseline-present table:** read `~/Documents/ai-tools/skills-mono-repo/master-kb/data/eval/{domain}-baseline.json`, compute Δ = current − baseline per metric, format `+0.03` / `-0.02`. Add Δ columns after each metric.

If `skipped_modes` non-empty: "⚠️ Skipped modes: {list} — check bookrag output for reason."
If `per_mode` missing (older bookrag): fall back to `aggregate`, print "⚠️ per_mode not found — showing aggregate only."

---

## Step 5 — Baseline management

**No baseline exists**: print save instructions using the **Save new baseline** tail-flag from Step 3 ("run once per domain; re-run after DB rebuild").

**Drift detected** (non-zero exit with `--check-drift`):
```
⚠️ DRIFT DETECTED for {domain}:
  - {mode} {metric}: {baseline_val} → {current_val} (Δ {delta})
To acknowledge: re-run with --save-baseline.
To investigate: check if DB was rebuilt or fixtures changed.
```

**No drift** (exit 0 with `--check-drift`): `✅ No drift detected for {domain} (threshold: 0.05)`

---

## Fallback

| Condition | Resolution |
|---|---|
| `uv: command not found` | Install: `curl -LsSf https://astral.sh/uv/install.sh \| sh` then restart shell |
| DB not found | Run `bookrag build` or `bookrag ingest` to create the DB first |
| Fixture not found | `uv run --directory ~/Documents/ai-tools/skills-mono-repo bookrag create-benchmark --mode auto --domain {domain}` |
| `poor-man-mcp-search-engine: not found` | Ignore — outdated `run-benchmark.md` reference. This skill uses `bookrag benchmark` directly |
| Fixture chunk IDs stale (after DB rebuild) | Re-run `bookrag create-benchmark --mode auto` to refresh fixture chunk IDs |
| bookrag exits non-zero (not drift) | Print stderr; check `bookrag benchmark --help` for required flags |
