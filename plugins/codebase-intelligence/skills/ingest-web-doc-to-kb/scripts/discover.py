#!/usr/bin/env python3
"""Discover ingestable sub-pages from a documentation index/landing URL.

Fetches the given URL and returns every same-host link whose path sits *under*
the given URL's path prefix (depth-1 crawl of an index page). If none are found,
returns the URL itself (single-page mode).

Usage:  python3 discover.py <url> [max_pages]
Output: one absolute URL per line on stdout. Stderr carries a one-line summary.
Stdlib only — no third-party deps, so it runs under system python3.
"""
import re
import sys
import urllib.parse
import urllib.request

url = sys.argv[1].strip()
max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 300

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

try:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
except Exception as exc:  # noqa: BLE001
    sys.stderr.write(f"discover: fetch failed ({exc}); single-page mode\n")
    print(url.rstrip("/"))
    sys.exit(0)

p = urllib.parse.urlparse(url)
host = p.netloc
index_path = p.path.rstrip("/") or "/"
prefix = index_path + "/" if index_path != "/" else "/"

hrefs = re.findall(r'href=["\']([^"\'>]+)', html, flags=re.IGNORECASE)
found: set[str] = set()
for h in hrefs:
    full = urllib.parse.urljoin(url, h)
    pp = urllib.parse.urlparse(full)
    if pp.scheme not in ("http", "https") or pp.netloc != host:
        continue
    path = pp.path
    if prefix != "/" and not path.startswith(prefix):
        continue
    if path.rstrip("/") == index_path:  # skip the index itself
        continue
    # skip obvious non-article assets
    if re.search(r"\.(png|jpe?g|gif|svg|webp|pdf|zip|css|js|ico|xml|json)$", path, re.I):
        continue
    clean = f"{pp.scheme}://{pp.netloc}{path}".rstrip("/")
    found.add(clean)

urls = sorted(found)[:max_pages]
if not urls:
    sys.stderr.write("discover: no sub-pages under prefix; single-page mode\n")
    urls = [url.rstrip("/")]
else:
    sys.stderr.write(f"discover: {len(urls)} sub-pages under {prefix}\n")
print("\n".join(urls))
