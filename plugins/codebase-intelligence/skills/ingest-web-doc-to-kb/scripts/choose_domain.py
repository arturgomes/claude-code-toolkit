#!/usr/bin/env python3
"""Auto-pick the best-fit KB domain for a freshly scraped corpus (no prompts).

Scores each registered domain's keywords/description against a sample of the
scraped markdown. Prints the chosen existing domain name, or "NEW:<slug>" when
nothing scores well enough (caller then registers a new domain).

Run with:  uv run --directory <repo> python choose_domain.py \
             <registry_path> <markdown_dir> <fallback_slug>
"""
import re
import sys
from pathlib import Path

from bookrag.domain import DomainRegistry

registry_path = sys.argv[1]
markdown_dir = Path(sys.argv[2])
fallback_slug = sys.argv[3]

STOP = set(
    "the a an and or of for to in on with by from as is are be this that these those "
    "your you it its their building build using use how we our what when where why".split()
)


def tokens(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2 and w not in STOP]


# Sample up to 10 files, first ~400 words each.
sample_words: list[str] = []
for f in sorted(markdown_dir.rglob("*.md"))[:10]:
    sample_words.extend(f.read_text(encoding="utf-8", errors="ignore").split()[:400])
sample = set(tokens(" ".join(sample_words)))

registry = DomainRegistry(registry_path)
best_name, best_score = None, 0
for dc in registry.list_domains():
    kw = set(tokens(" ".join(dc.keywords) + " " + (getattr(dc, "description", "") or "")))
    score = len(kw & sample)
    if score > best_score:
        best_name, best_score = dc.display_name, score

# Require a modest overlap; otherwise propose a new domain.
if best_name and best_score >= 3:
    print(best_name)
else:
    print(f"NEW:{fallback_slug}")
