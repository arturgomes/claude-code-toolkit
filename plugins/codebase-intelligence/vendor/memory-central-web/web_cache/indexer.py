import sqlite3
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import datetime


@dataclass
class CachedWebDocument:
    """Represents a cached web document."""
    url: str
    title: str
    content: str
    keywords: List[str]
    fetched_at: str
    filepath: str
    score: float = 0.0


class CacheIndexer:
    """Manages SQLite FTS5 index for web cache."""

    def __init__(self, db_path: str = "~/.claude/memory/WEB-CACHE-001/cache_index.db"):
        self.db_path = Path(db_path).expanduser()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = None

    def create_index(self) -> None:
        """Initialize SQLite FTS5 tables."""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS fts_cache USING fts5(
                url UNINDEXED,
                title,
                content,
                keywords UNINDEXED,
                fetched_at UNINDEXED,
                filepath UNINDEXED
            )
        """)
        self.conn.commit()

    def add_document(self, doc: CachedWebDocument) -> None:
        """Add document to FTS5 index."""
        if not self.conn:
            self.create_index()

        # Check if URL already exists, update if so
        cursor = self.conn.execute(
            "SELECT rowid FROM fts_cache WHERE url = ?", (doc.url,)
        )
        existing = cursor.fetchone()

        if existing:
            self.conn.execute("""
                UPDATE fts_cache SET
                    title = ?, content = ?, keywords = ?,
                    fetched_at = ?, filepath = ?
                WHERE url = ?
            """, (doc.title, doc.content, ','.join(doc.keywords),
                  doc.fetched_at, doc.filepath, doc.url))
        else:
            self.conn.execute("""
                INSERT INTO fts_cache (url, title, content, keywords, fetched_at, filepath)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (doc.url, doc.title, doc.content, ','.join(doc.keywords),
                  doc.fetched_at, doc.filepath))

        self.conn.commit()

    def search(self, query: str, limit: int = 5) -> List[CachedWebDocument]:
        """Search cache using FTS5 BM25 ranking."""
        if not self.conn:
            self.create_index()

        cursor = self.conn.execute("""
            SELECT url, title, content, keywords, fetched_at, filepath, rank
            FROM fts_cache
            WHERE fts_cache MATCH ?
            ORDER BY rank
            LIMIT ?
        """, (query, limit))

        results = []
        for row in cursor:
            results.append(CachedWebDocument(
                url=row[0],
                title=row[1],
                content=row[2],
                keywords=row[3].split(',') if row[3] else [],
                fetched_at=row[4],
                filepath=row[5],
                score=abs(row[6])  # FTS5 rank is negative
            ))

        return results

    def get_cached_url(self, url: str) -> Optional[CachedWebDocument]:
        """Check if URL is already cached."""
        if not self.conn:
            self.create_index()

        cursor = self.conn.execute("""
            SELECT url, title, content, keywords, fetched_at, filepath
            FROM fts_cache WHERE url = ?
        """, (url,))

        row = cursor.fetchone()
        if row:
            return CachedWebDocument(
                url=row[0], title=row[1], content=row[2],
                keywords=row[3].split(',') if row[3] else [], fetched_at=row[4],
                filepath=row[5]
            )
        return None

    def close(self) -> None:
        """Close database connection."""
        if self.conn:
            self.conn.close()
