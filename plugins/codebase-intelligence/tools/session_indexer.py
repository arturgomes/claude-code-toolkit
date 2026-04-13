#!/usr/bin/env python3
"""
Session Memory Indexer — BM25 keyword extraction and SQLite FTS5 search

Provides keyword extraction, session indexing, and full-text search for
Obsidian vault session notes. Mirrors web_cache pattern from memory-central.

Usage:
    python3 session_indexer.py --extract-keywords <vault-file>
    python3 session_indexer.py --index-session <vault-file>
    python3 session_indexer.py --search <keyword> [--ticket TICKET] [--limit N]
    python3 session_indexer.py --test
"""

import sqlite3
import re
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Tuple
import os

try:
    from rank_bm25 import BM25Okapi
    BM25_AVAILABLE = True
except ImportError:
    BM25_AVAILABLE = False
    print("Warning: rank_bm25 not installed. Install with: pip install rank-bm25")


def extract_keywords(content: str, top_n: int = 10) -> List[str]:
    """
    Extract top N keywords from content using BM25 scoring.

    Args:
        content: Text content to analyze
        top_n: Number of top keywords to return

    Returns:
        List of top keywords by BM25 score
    """
    if not BM25_AVAILABLE:
        # Fallback: simple word frequency
        words = re.findall(r'\b[a-z]{4,}\b', content.lower())
        word_freq = {}
        for word in words:
            if word not in {'this', 'that', 'with', 'from', 'have', 'been', 'were', 'will'}:
                word_freq[word] = word_freq.get(word, 0) + 1
        return [word for word, _ in sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:top_n]]

    # BM25-based extraction
    tokens = re.findall(r'\b[a-z]{4,}\b', content.lower())

    # Filter stopwords
    stopwords = {'this', 'that', 'with', 'from', 'have', 'been', 'were', 'will', 'when', 'what', 'where', 'which', 'should', 'would', 'could'}
    tokens = [t for t in tokens if t not in stopwords]

    if not tokens:
        return []

    # Build BM25 model (single document, so scores represent term importance)
    bm25 = BM25Okapi([tokens])
    scores = bm25.get_scores(tokens)

    # Get unique top keywords
    word_scores = {}
    for token, score in zip(tokens, scores):
        if token not in word_scores:
            word_scores[token] = score

    top_keywords = sorted(word_scores.items(), key=lambda x: x[1], reverse=True)[:top_n]
    return [kw for kw, _ in top_keywords]


def parse_frontmatter(content: str) -> dict:
    """
    Extract frontmatter from markdown file.

    Returns:
        dict with frontmatter fields, or empty dict if no frontmatter
    """
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return {}

    frontmatter = {}
    for line in match.group(1).split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            frontmatter[key.strip()] = value.strip()

    return frontmatter


def update_frontmatter_keywords(vault_path: Path, keywords: List[str]):
    """
    Update the keywords field in frontmatter with extracted keywords.
    """
    if not vault_path.exists():
        print(f"Error: File not found: {vault_path}")
        return

    content = vault_path.read_text()

    # Find frontmatter bounds
    match = re.match(r'^(---\n.*?\n---)', content, re.DOTALL)
    if not match:
        print(f"Warning: No frontmatter found in {vault_path}")
        return

    frontmatter = match.group(1)

    # Update keywords line
    keywords_str = f"keywords: [{', '.join(keywords)}]"

    # Replace existing keywords line or add if missing
    if re.search(r'keywords:\s*\[.*?\]', frontmatter):
        new_frontmatter = re.sub(r'keywords:\s*\[.*?\]', keywords_str, frontmatter)
    else:
        # Insert before closing ---
        new_frontmatter = frontmatter.replace('---', f'{keywords_str}\n---')

    new_content = content.replace(frontmatter, new_frontmatter, 1)
    vault_path.write_text(new_content)

    print(f"✅ Updated keywords in {vault_path.name}: {keywords}")


def get_index_path(ticket: str) -> Path:
    """
    Get the path to the SQLite index for a ticket.
    """
    memory_dir = Path.home() / '.claude' / 'memory' / ticket
    memory_dir.mkdir(parents=True, exist_ok=True)
    return memory_dir / 'session_index.db'


def index_session(vault_path: Path):
    """
    Index a session file into SQLite FTS5 database.
    """
    if not vault_path.exists():
        print(f"Error: File not found: {vault_path}")
        return

    content = vault_path.read_text()
    frontmatter = parse_frontmatter(content)

    ticket = frontmatter.get('ticket', 'GENERAL')
    branch = frontmatter.get('branch', 'unknown')
    date = frontmatter.get('date', datetime.now().strftime('%Y-%m-%d'))
    keywords = frontmatter.get('keywords', '[]')
    tags = frontmatter.get('tags', '[]')

    # Get index path for this ticket
    db_path = get_index_path(ticket)

    conn = sqlite3.connect(db_path)

    # Create FTS5 table if not exists
    conn.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS sessions USING fts5(
            title, content, keywords, tags, date, vault_path
        )
    """)

    # Remove existing entry for this file (if re-indexing)
    conn.execute("DELETE FROM sessions WHERE vault_path = ?", (str(vault_path),))

    # Insert new entry
    title = f"{ticket}/{branch}"
    conn.execute("""
        INSERT INTO sessions (title, content, keywords, tags, date, vault_path)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (title, content, keywords, tags, date, str(vault_path)))

    conn.commit()
    conn.close()

    print(f"✅ Indexed {ticket}/{branch} → {db_path}")


def search_sessions(query: str, ticket: str = "all", limit: int = 5) -> List[Tuple]:
    """
    Search sessions using FTS5 full-text search.

    Args:
        query: Search query
        ticket: Ticket ID to search (or "all" for global search)
        limit: Maximum results to return

    Returns:
        List of (title, date, snippet, vault_path) tuples
    """
    results = []

    # Determine which indices to search
    if ticket == "all":
        memory_dir = Path.home() / '.claude' / 'memory'
        if not memory_dir.exists():
            print("No memory indices found")
            return results

        db_paths = list(memory_dir.glob('*/session_index.db'))
    else:
        db_path = get_index_path(ticket)
        if not db_path.exists():
            print(f"No index found for ticket {ticket}")
            return results
        db_paths = [db_path]

    # Search each index
    for db_path in db_paths:
        conn = sqlite3.connect(db_path)

        try:
            cursor = conn.execute("""
                SELECT title, date, snippet(sessions, 1, '**', '**', '...', 64), vault_path
                FROM sessions
                WHERE sessions MATCH ?
                ORDER BY rank
                LIMIT ?
            """, (query, limit))

            results.extend(cursor.fetchall())
        except sqlite3.OperationalError as e:
            print(f"Warning: Could not search {db_path}: {e}")
        finally:
            conn.close()

    # Sort all results by rank and limit
    return results[:limit]


def run_tests():
    """
    Run basic functionality tests.
    """
    print("Running session_indexer tests...")

    # Test 1: Keyword extraction
    test_content = """
    Investigated src/pdf/generator.ts:42 — PDF rendering with puppeteer
    Decision: Use puppeteer instead of wkhtmltopdf for better CSS support
    Implementation status: PDF generator service created
    """

    keywords = extract_keywords(test_content, top_n=5)
    print(f"✅ Test 1 (keyword extraction): {keywords}")
    assert len(keywords) > 0, "Keywords extraction failed"

    # Test 2: Frontmatter parsing
    frontmatter_content = """---
title: "Test Session"
ticket: TEST-123
branch: feature-test
date: 2026-04-13
keywords: [test, session, memory]
---

# Test content
"""

    fm = parse_frontmatter(frontmatter_content)
    print(f"✅ Test 2 (frontmatter parsing): {fm}")
    assert fm.get('ticket') == 'TEST-123', "Frontmatter parsing failed"

    # Test 3: Index path generation
    index_path = get_index_path('TEST-123')
    print(f"✅ Test 3 (index path): {index_path}")
    assert 'TEST-123' in str(index_path), "Index path generation failed"

    print("\n✅ All tests passed!")


def main():
    parser = argparse.ArgumentParser(description='Session Memory Indexer')
    parser.add_argument('--extract-keywords', metavar='FILE', help='Extract keywords from vault file')
    parser.add_argument('--index-session', metavar='FILE', help='Index session file into FTS5 database')
    parser.add_argument('--search', metavar='QUERY', help='Search sessions for keyword')
    parser.add_argument('--ticket', default='all', help='Ticket ID for search (default: all)')
    parser.add_argument('--limit', type=int, default=5, help='Max search results (default: 5)')
    parser.add_argument('--test', action='store_true', help='Run tests')

    args = parser.parse_args()

    if args.test:
        run_tests()
        return

    if args.extract_keywords:
        vault_path = Path(args.extract_keywords).expanduser()
        if not vault_path.exists():
            print(f"Error: File not found: {vault_path}")
            return

        content = vault_path.read_text()
        keywords = extract_keywords(content)
        update_frontmatter_keywords(vault_path, keywords)

    elif args.index_session:
        vault_path = Path(args.index_session).expanduser()
        index_session(vault_path)

    elif args.search:
        results = search_sessions(args.search, ticket=args.ticket, limit=args.limit)

        if not results:
            print(f"No results found for '{args.search}'")
            return

        print(f"\n🔍 Search results for \"{args.search}\":\n")
        for i, (title, date, snippet, vault_path) in enumerate(results, 1):
            # Create wikilink
            filename = Path(vault_path).stem
            print(f"{i}. [[{filename}]] — {date}")
            print(f"   {snippet}\n")

    else:
        parser.print_help()


if __name__ == '__main__':
    main()
