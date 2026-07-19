#!/usr/bin/env python3
"""Scrape a list of URLs to clean main-content markdown via trafilatura.

Run with:  uv run --with trafilatura python scrape.py <urls_file> <out_dir>
Writes one {slug}.md per URL (slug = last path segment, lowercased) with a
title + "Source: {url}" header. Skips empty/thin extractions.
"""
import sys
import time
from pathlib import Path

import trafilatura

urls_file = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)

urls = [u.strip() for u in urls_file.read_text().splitlines() if u.strip()]
# Boilerplate lines that commonly leak into extractions; dropped post-hoc.
JUNK = {
    "## Get the developer newsletter",
    "Product updates, how-tos, community spotlights, and more. Delivered monthly to your inbox.",
}

ok, fail = 0, 0
for i, url in enumerate(urls, 1):
    slug = url.rstrip("/").split("/")[-1].lower() or f"page-{i}"
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        print(f"[{i}/{len(urls)}] FETCH-FAIL  {slug}")
        fail += 1
        continue
    md = trafilatura.extract(
        downloaded,
        output_format="markdown",
        include_links=True,
        include_tables=True,
        include_formatting=True,
        favor_recall=True,
    )
    if not md or len(md.split()) < 50:
        print(f"[{i}/{len(urls)}] EMPTY/THIN  {slug} ({len((md or '').split())} words)")
        fail += 1
        continue
    body = "\n".join(ln for ln in md.splitlines() if ln.strip() not in JUNK)
    title = slug.replace("-", " ").title()
    (out_dir / f"{slug}.md").write_text(
        f"# {title}\n\nSource: {url}\n\n{body.strip()}\n", encoding="utf-8"
    )
    print(f"[{i}/{len(urls)}] OK  {slug}  ({len(body.split())} words)")
    ok += 1
    time.sleep(1)

print(f"\nDONE: {ok} ok, {fail} failed -> {out_dir}")
sys.exit(0 if ok else 1)
