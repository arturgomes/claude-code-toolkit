"""Web cache indexing and search module.

Provides BM25-based keyword indexing for cached web research with
Obsidian vault integration.
"""

from web_cache.indexer import CacheIndexer, CachedWebDocument
from web_cache.keywords import extract_keywords, extract_wikilinks, generate_tags
from web_cache.vault_writer import save_to_vault, generate_filename

__all__ = [
    'CacheIndexer',
    'CachedWebDocument',
    'extract_keywords',
    'extract_wikilinks',
    'generate_tags',
    'save_to_vault',
    'generate_filename',
]

__version__ = '0.1.0'
