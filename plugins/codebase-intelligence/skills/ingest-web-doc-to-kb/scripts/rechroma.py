#!/usr/bin/env python3
"""Rebuild a domain's ChromaDB dense index from its SQLite embeddings, in
bounded batches. Idempotent safety net: guarantees the dense index is complete
even if a single-shot upsert would exceed Chroma's max batch size (~5461).

Run with:  uv run --directory <repo> python rechroma.py <domain_bookrag_db>
"""
import sys

from bookrag.db import BookragDB
from bookrag.pipeline.chroma_store import chroma_path_for, upsert_to_chroma

db_path = sys.argv[1]
chroma_dir = chroma_path_for(db_path)

db = BookragDB(db_path)
embs = db.get_embeddings()
db.close()

BATCH = 4000
total = 0
for i in range(0, len(embs), BATCH):
    total += upsert_to_chroma(embs[i : i + BATCH], chroma_dir)

print(f"rechroma: re-upserted {total} vectors -> {chroma_dir}")
