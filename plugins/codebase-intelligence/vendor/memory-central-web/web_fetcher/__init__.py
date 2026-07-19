"""
Web Content Fetcher with Pagination

Fetches web pages, converts to markdown, and provides paginated access
to reduce context window consumption.
"""

from .fetcher import (
    fetch_url,
    html_to_markdown,
    paginate_markdown,
    get_chunk,
    PaginatedWebContent
)

from .session import WebFetchSession

__all__ = [
    'fetch_url',
    'html_to_markdown',
    'paginate_markdown',
    'get_chunk',
    'PaginatedWebContent',
    'WebFetchSession'
]
