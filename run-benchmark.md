---
description: Run retrieval benchmark suite with skill validation and historical comparison
---

# Run Benchmark — Full Retrieval Quality Suite

Run the complete benchmark suite to evaluate retrieval quality and skill functionality.

## CRITICAL: Use ONLY the Unified Wrapper

**NEVER write inline bash blocks with exports, PYTHONPATH, or direct Python calls.**

**ALWAYS use `poor-man-mcp-search-engine` for ALL operations.**

## Step 1: Validate Environment

```bash
poor-man-mcp-search-engine query validate
```

## Step 2: Run Retrieval Benchmarks

### 2a: Semantic baseline (queries-v1)

```bash
poor-man-mcp-search-engine benchmark --queries examples/benchmark/queries-v1-labeled.jsonl \
    --mode semantic --label "semantic-$(date +%Y%m%d)"
```

### 2b: Hybrid baseline (queries-v1)

```bash
poor-man-mcp-search-engine benchmark --queries examples/benchmark/queries-v1-labeled.jsonl \
    --mode hybrid --label "hybrid-$(date +%Y%m%d)"
```

### 2c: Graph-expand mode (queries-v2)

Requires `data/reports/related_notes.json` (run `discover related-notes` first). Degrades gracefully if absent.

```bash
poor-man-mcp-search-engine benchmark --queries examples/benchmark/queries-v2-labeled.jsonl \
    --mode graph-expand --label "graph-expand-$(date +%Y%m%d)"
```

## Step 3: Compare Against Previous Run

```bash
poor-man-mcp-search-engine benchmark --list
```

If a previous run exists:
```bash
poor-man-mcp-search-engine benchmark --queries examples/benchmark/queries-v2-labeled.jsonl \
    --mode graph-expand --compare benchmarks/<prev-run>/report.json \
    --label "graph-expand-$(date +%Y%m%d)"
```

## Step 4: Exercise Skills

Run each skill to verify end-to-end functionality.

### 4a: /ask-kb-v1

Run `/ask-kb-v1 bounded context patterns for microservices` and verify:
- [ ] Retrieval returns at least 3 hits with `rerank_score` > -5.0
- [ ] Evidence is cited with `[source_relpath:line]`
- [ ] Research document generated in `thoughts/shared/kb/research/`

### 4b: /consult-kb-v1

Run `/consult-kb-v1 Should we use microservices for a small team?` and verify:
- [ ] Challenge flow returns both supporting and cautionary evidence
- [ ] Each category has at least 2 hits
- [ ] Feedback document generated in `thoughts/shared/kb/feedbacks/`

### 4c: /expand-kb-query-v1

Run `/expand-kb-query-v1 How can I improve hybrid retrieval precision?` and verify:
- [ ] Expanded query incorporates KB vocabulary from concepts.json
- [ ] Retrieval results are relevant to the expanded query
- [ ] Research document generated in `thoughts/shared/kb/research/`

### 4d: /ask-kb-v2

Run `/ask-kb-v2 graph-based retrieval patterns for knowledge bases` and verify:
- [ ] At least 1 hit has `"graph_neighbor": true` (check source citations in research doc)
- [ ] Research document generated in `thoughts/shared/kb/research/`
- [ ] No graceful degradation warning (graph expansion worked)

### 4e: /consult-kb-v3

Run `/consult-kb-v3 Should we add graph traversal to our RAG retrieval pipeline?` and verify:
- [ ] Challenge flow returns supporting + cautionary evidence
- [ ] Graph-expanded evidence includes hits marked `graph_neighbor: true`
- [ ] Feedback document generated in `thoughts/shared/kb/feedbacks/`

### 4f: /expand-kb-query-v3

Run `/expand-kb-query-v3 entity extraction for knowledge graph enrichment` and verify:
- [ ] Expanded query incorporates KB vocabulary (same as v1 baseline)
- [ ] Graph expansion step adds candidates
- [ ] Final reranked results include at least 1 `graph_neighbor: true` hit
- [ ] Research document generated in `thoughts/shared/kb/research/`

## Step 5: Verify Discover Subcommands

```bash
poor-man-mcp-search-engine discover --help
```

Must list all 12 subcommands: `related-notes`, `claims`, `concepts`, `cluster`, `duplicates`, `label-clusters`, `collocations`, `centrality`, `topics` (existing 9) + `chunk-graph`, `entity-graph`, `claim-graph` (new 3).

Verify Phase artifacts exist:
```bash
KB_ROOT="${KB_ROOT:-${CLAUDE_PROJECT_DIR:-.}}"
ls "$KB_ROOT/data/reports/chunk_graph.gexf"
ls "$KB_ROOT/data/reports/communities.json"
ls "$KB_ROOT/data/indices/entity_graph/entities.json"
ls "$KB_ROOT/data/indices/entity_graph/links.jsonl"
ls "$KB_ROOT/data/reports/claim_graph.json"
```

### Step 5b: Verify Query Subcommands

```bash
poor-man-mcp-search-engine query --help
```

Must list: `graph-expand`, `entity`, `challenge-v2`.

Smoke-test new subcommands:
```bash
# graph-expand (pipe-mode)
poor-man-mcp-search-engine query --stdout retrieve "RAG retrieval" | \
    poor-man-mcp-search-engine query --stdout graph-expand | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print('graph_expanded:', d.get('graph_expanded')); print('graph neighbors:', sum(1 for h in d['hits'] if h.get('graph_neighbor')))"

# entity search
poor-man-mcp-search-engine query entity "LangChain"

# challenge-v2
poor-man-mcp-search-engine query --stdout challenge-v2 "vector search is sufficient for RAG" | python3 -c "import json,sys; d=json.load(sys.stdin); print('claim_graph_evidence:', 'yes' if d.get('claim_graph_evidence') else 'no')"
```

## Step 6: Record Results

Save to `thoughts/shared/kb/research/YYYY-MM-DD-benchmark-results.md`:

```markdown
# Benchmark Results: YYYY-MM-DD

## Retrieval Metrics

| Metric | Semantic | Hybrid | Graph-Expand | Delta (Graph vs Semantic) |
|--------|----------|--------|--------------|---------------------------|
| MRR | X.XXXX | X.XXXX | X.XXXX | +/- X.XXXX |
| Recall@5 | X.XXXX | X.XXXX | X.XXXX | +/- X.XXXX |
| Precision@5 | X.XXXX | X.XXXX | X.XXXX | +/- X.XXXX |
| Graph Recall Gain | — | — | X.XXXX | (graph-expand only) |
| Queries improved by graph | — | — | N | (graph-expand only) |

## Discovery Artifacts

| Artifact | Exists | Size |
|----------|--------|------|
| collocations.json | Y/N | X bigrams, Y trigrams |
| centrality.json | Y/N | X chunks |
| topics.json | Y/N | X topics |
| chunk_graph.gexf | Y/N | X nodes, Y edges |
| communities.json | Y/N | X communities |
| entity_graph/entities.json | Y/N | X entities |
| entity_graph/links.jsonl | Y/N | X links |
| claim_graph.json | Y/N | X edges |

## Skill Validation

| Skill | Status | Graph Hits | Notes |
|-------|--------|------------|-------|
| /ask-kb | PASS/FAIL | N/A | |
| /ask-kb-v1 | PASS/FAIL | N/A | |
| /ask-kb-v2 | PASS/FAIL | X graph neighbors | |
| /consult-kb | PASS/FAIL | N/A | |
| /consult-kb-v1 | PASS/FAIL | N/A | |
| /consult-kb-v3 | PASS/FAIL | X graph neighbors | |
| /expand-kb-query | PASS/FAIL | N/A | |
| /expand-kb-query-v1 | PASS/FAIL | N/A | |
| /expand-kb-query-v3 | PASS/FAIL | X graph neighbors | |

## Query Subcommand Smoke Tests

| Subcommand | Status | Notes |
|------------|--------|-------|
| query graph-expand | PASS/FAIL | |
| query entity | PASS/FAIL | |
| query challenge-v2 | PASS/FAIL | |

## Delta vs Previous Run

[Include if --compare was used]

## Observations

[Any notable findings, especially: did graph expansion improve recall? Which query types benefited most?]
```

## Quick Reference

| Operation | Command |
|-----------|---------|
| Run benchmark (semantic) | `poor-man-mcp-search-engine benchmark --queries examples/benchmark/queries-v1-labeled.jsonl` |
| Run benchmark (graph-expand) | `poor-man-mcp-search-engine benchmark --queries examples/benchmark/queries-v2-labeled.jsonl --mode graph-expand` |
| Compare runs | `poor-man-mcp-search-engine benchmark --compare PREV --queries FILE` |
| List past runs | `poor-man-mcp-search-engine benchmark --list` |
| Discover help | `poor-man-mcp-search-engine discover --help` |
| Rebuild + discover | `poor-man-mcp-search-engine rebuild index --discover` |
