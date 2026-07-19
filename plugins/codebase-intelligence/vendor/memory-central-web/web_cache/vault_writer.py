from pathlib import Path
from datetime import datetime
from typing import List
import re


def generate_filename(title: str, url: str) -> str:
    """Generate filename slug from title or URL."""

    # Try title first
    if title and title.lower() not in ['', 'untitled', 'no title']:
        base = title
    else:
        # Extract from URL
        from urllib.parse import urlparse
        parsed = urlparse(url)
        base = parsed.netloc + parsed.path

    # Clean for filename
    slug = base.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = slug[:100]  # Limit length

    # Add date prefix
    date_prefix = datetime.now().strftime('%Y-%m-%d')
    return f"{date_prefix}-{slug}.md"


def generate_frontmatter(url: str, title: str, keywords: List[str], tags: List[str]) -> str:
    """Generate YAML frontmatter for Obsidian."""

    # Format tags with # prefix
    tag_list = ', '.join([f"#{tag}" for tag in tags])

    frontmatter = f"""---
title: {title}
url: {url}
type: web-cache
source: fetch-web
fetched: {datetime.now().isoformat()}
keywords: [{', '.join(keywords)}]
tags: [{tag_list}]
---

"""
    return frontmatter


def save_to_vault(
    vault_path: str,
    url: str,
    title: str,
    markdown_content: str,
    keywords: List[str],
    tags: List[str]
) -> str:
    """Save cached web content to Obsidian vault."""

    # Vault directory structure
    vault_root = Path(vault_path).expanduser()
    web_cache_dir = vault_root / "02-Notes" / "Web-Cache"
    web_cache_dir.mkdir(parents=True, exist_ok=True)

    # Generate filename
    filename = generate_filename(title, url)
    filepath = web_cache_dir / filename

    # Generate frontmatter
    frontmatter = generate_frontmatter(url, title, keywords, tags)

    # Combine frontmatter + content
    full_content = frontmatter + markdown_content

    # Write to file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(full_content)

    return str(filepath)
