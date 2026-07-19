#!/usr/bin/env python3
"""
Web Content Fetcher CLI

Fetch web pages as paginated markdown to reduce context window consumption.
"""

import click
import sys
import logging
import re
from pathlib import Path
from datetime import datetime

from web_fetcher import (
    fetch_url,
    html_to_markdown,
    paginate_markdown,
    get_chunk,
    WebFetchSession
)

from web_cache.indexer import CacheIndexer, CachedWebDocument
from web_cache.keywords import extract_keywords, extract_wikilinks, generate_tags
from web_cache.vault_writer import save_to_vault


# Configure logging
logging.basicConfig(
    level=logging.WARNING,  # Only warnings/errors by default
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """
    Fetch web pages as paginated markdown.

    Examples:

        # Fetch a page
        fetch-web.py fetch https://example.com

        # Navigate
        fetch-web.py next
        fetch-web.py prev
        fetch-web.py goto 5
    """
    pass


@cli.command()
@click.argument('url', type=str)
@click.option(
    '-p', '--page',
    type=int,
    default=1,
    help='Page number to display (default: 1)'
)
@click.option(
    '-s', '--chunk-size',
    type=int,
    default=500,
    help='Lines per chunk (default: 500)'
)
@click.option(
    '-v', '--verbose',
    is_flag=True,
    help='Enable verbose logging'
)
@click.option(
    '--no-cache',
    is_flag=True,
    help='Skip caching to vault'
)
@click.option(
    '--vault',
    default='~/Documents/Obsidian-Vault',
    help='Path to Obsidian vault'
)
def fetch(url: str, page: int, chunk_size: int, verbose: bool, no_cache: bool, vault: str):
    """
    Fetch web page and display as paginated markdown.

    Content is automatically cached unless --no-cache is specified.

    URL: Web page URL to fetch

    Examples:

        fetch-web.py fetch https://example.com
        fetch-web.py fetch https://docs.python.org/3/library/asyncio.html --page 2
        fetch-web.py fetch https://example.com --chunk-size 200
        fetch-web.py fetch https://example.com --no-cache
    """
    if verbose:
        logging.getLogger().setLevel(logging.INFO)

    try:
        click.echo(f"Fetching: {url}")

        # Create session and load URL
        session = WebFetchSession()
        result = session.load_url(url, chunk_size=chunk_size)

        # Navigate to requested page if not first
        if page > 1:
            result = session.goto(page)

        # Display content
        _display_chunk(result, url)

        # Auto-cache logic
        if not no_cache:
            try:
                if verbose:
                    click.echo("\n💾 Caching to vault...")

                # Check if already cached
                indexer = CacheIndexer()
                existing = indexer.get_cached_url(url)

                if existing:
                    if verbose:
                        click.echo(f"⚠️  URL already cached: {existing.filepath}")
                else:
                    # Extract title
                    full_markdown = session.get_full_content()
                    title_match = re.search(r'^#\s+(.+)$', full_markdown, re.MULTILINE)
                    title = title_match.group(1) if title_match else url

                    # Extract keywords and tags
                    keywords = extract_keywords(full_markdown, top_n=10)
                    wikilinks = extract_wikilinks(full_markdown)
                    tags = generate_tags(keywords, wikilinks, max_tags=5)

                    # Save to vault
                    filepath = save_to_vault(vault, url, title, full_markdown, keywords, tags)

                    # Update index
                    doc = CachedWebDocument(
                        url=url,
                        title=title,
                        content=full_markdown,
                        keywords=keywords,
                        fetched_at=datetime.now().isoformat(),
                        filepath=filepath
                    )
                    indexer.add_document(doc)

                    if verbose:
                        click.echo(f"✅ Cached to: {filepath}")

                indexer.close()

            except Exception as e:
                # Non-fatal: warn but continue
                click.echo(f"⚠️  Cache failed: {e}", err=True)

    except Exception as e:
        click.echo(f"❌ Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.option(
    '-v', '--verbose',
    is_flag=True,
    help='Enable verbose logging'
)
def next(verbose: bool):
    """
    Navigate to next page of current session.

    Example:

        fetch-web.py next
    """
    if verbose:
        logging.getLogger().setLevel(logging.INFO)

    try:
        session = WebFetchSession()

        # Try to restore session
        if not session.load():
            click.echo(
                "❌ No active session. Use 'fetch' command first.",
                err=True
            )
            sys.exit(1)

        # Navigate to next
        result = session.next()
        _display_chunk(result, session.url)

    except Exception as e:
        click.echo(f"❌ Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.option(
    '-v', '--verbose',
    is_flag=True,
    help='Enable verbose logging'
)
def prev(verbose: bool):
    """
    Navigate to previous page of current session.

    Example:

        fetch-web.py prev
    """
    if verbose:
        logging.getLogger().setLevel(logging.INFO)

    try:
        session = WebFetchSession()

        # Try to restore session
        if not session.load():
            click.echo(
                "❌ No active session. Use 'fetch' command first.",
                err=True
            )
            sys.exit(1)

        # Navigate to previous
        result = session.prev()
        _display_chunk(result, session.url)

    except Exception as e:
        click.echo(f"❌ Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('page_number', type=int)
@click.option(
    '-v', '--verbose',
    is_flag=True,
    help='Enable verbose logging'
)
def goto(page_number: int, verbose: bool):
    """
    Jump to specific page number.

    PAGE_NUMBER: Page number to jump to (1-indexed)

    Example:

        fetch-web.py goto 5
    """
    if verbose:
        logging.getLogger().setLevel(logging.INFO)

    try:
        session = WebFetchSession()

        # Try to restore session
        if not session.load():
            click.echo(
                "❌ No active session. Use 'fetch' command first.",
                err=True
            )
            sys.exit(1)

        # Navigate to page
        result = session.goto(page_number)
        _display_chunk(result, session.url)

    except Exception as e:
        click.echo(f"❌ Error: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('query')
@click.option('--limit', '-n', default=5, help='Number of results to return')
@click.option('--verbose', '-v', is_flag=True)
@click.option('--skill-mode', is_flag=True, help='JSON output for Claude Code skill consumption')
def search(query: str, limit: int, verbose: bool, skill_mode: bool):
    """Search cached web content using BM25 keyword matching.

    Searches the local cache before making new web requests.

    Example:
        fetch-web.py search "python async patterns"
        fetch-web.py search "python async" --skill-mode
    """
    try:
        indexer = CacheIndexer()
        results = indexer.search(query, limit=limit)

        if not results:
            if skill_mode:
                import json
                print(json.dumps({"results": [], "count": 0, "query": query}))
            else:
                click.echo("No cached results found.", err=True)
                click.echo(f"\nTry: fetch-web.py fetch <url>", err=True)
            indexer.close()
            sys.exit(0)

        if skill_mode:
            # JSON output for skills
            import json
            output = {
                "query": query,
                "count": len(results),
                "results": [
                    {
                        "title": doc.title,
                        "url": doc.url,
                        "filepath": str(doc.filepath),
                        "score": float(doc.score),
                        "keywords": doc.keywords,
                        "fetched_at": doc.fetched_at
                    }
                    for doc in results
                ]
            }
            print(json.dumps(output, indent=2))
        else:
            # Human-readable output
            click.echo(f"\n🔍 Found {len(results)} cached result(s) for '{query}':\n")

            for i, doc in enumerate(results, 1):
                click.echo(f"{i}. {doc.title}")
                click.echo(f"   URL: {doc.url}")
                click.echo(f"   Relevance: {doc.score:.2f}")
                click.echo(f"   Cached: {doc.fetched_at}")
                click.echo(f"   File: {doc.filepath}")

                if verbose:
                    click.echo(f"   Keywords: {', '.join(doc.keywords[:5])}")

                click.echo()

        indexer.close()

    except Exception as e:
        if skill_mode:
            import json
            print(json.dumps({"error": str(e)}), file=sys.stderr)
        else:
            click.echo(f"Error searching cache: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('url')
@click.option('--vault', default='~/Documents/Obsidian-Vault', help='Path to Obsidian vault')
@click.option('--verbose', '-v', is_flag=True)
@click.option('--skill-mode', is_flag=True, help='JSON output for Claude Code skill consumption')
def cache(url: str, vault: str, verbose: bool, skill_mode: bool):
    """Manually cache a URL without displaying content.

    Fetches, caches, and indexes without pagination.

    Example:
        fetch-web.py cache https://example.com
        fetch-web.py cache https://example.com --skill-mode
    """
    try:
        # Fetch content
        if verbose and not skill_mode:
            click.echo(f"Fetching {url}...")

        html_content = fetch_url(url)
        markdown_content = html_to_markdown(html_content)

        # Extract title (first # header or URL)
        title_match = re.search(r'^#\s+(.+)$', markdown_content, re.MULTILINE)
        title = title_match.group(1) if title_match else url

        # Extract keywords and tags
        keywords = extract_keywords(markdown_content, top_n=10)
        wikilinks = extract_wikilinks(markdown_content)
        tags = generate_tags(keywords, wikilinks, max_tags=5)

        # Save to vault
        filepath = save_to_vault(vault, url, title, markdown_content, keywords, tags)

        if verbose and not skill_mode:
            click.echo(f"Saved to: {filepath}")
            click.echo(f"Keywords: {', '.join(keywords)}")
            click.echo(f"Tags: {', '.join(tags)}")

        # Update index
        indexer = CacheIndexer()
        doc = CachedWebDocument(
            url=url,
            title=title,
            content=markdown_content,
            keywords=keywords,
            fetched_at=datetime.now().isoformat(),
            filepath=filepath
        )
        indexer.add_document(doc)
        indexer.close()

        if skill_mode:
            import json
            print(json.dumps({
                "url": url,
                "title": title,
                "filepath": str(filepath),
                "keywords": keywords,
                "tags": tags,
                "fetched_at": datetime.now().isoformat()
            }, indent=2))
        else:
            click.echo(f"\n✅ Cached: {title}")

    except Exception as e:
        if skill_mode:
            import json
            print(json.dumps({"error": str(e)}), file=sys.stderr)
        else:
            click.echo(f"Error caching URL: {e}", err=True)
        sys.exit(1)


def _display_chunk(result: dict, url: str):
    """Display chunk with navigation info."""
    # Header
    click.echo("=" * 80)
    click.echo(f"URL: {url}")
    click.echo(f"Page {result['page']} of {result['total_pages']} "
               f"(Total: {result['total_lines']:,} lines)")
    click.echo("=" * 80)
    click.echo()

    # Content
    click.echo(result['content'])

    # Footer with navigation
    click.echo()
    click.echo("=" * 80)

    nav_parts = []
    if result['page'] > 1:
        nav_parts.append("[prev]")
    if result['page'] < result['total_pages']:
        nav_parts.append("[next]")
    nav_parts.append(f"[goto N]")

    click.echo(f"Navigation: {' '.join(nav_parts)}")
    click.echo("=" * 80)


if __name__ == '__main__':
    cli()
