"""
Core web fetching and markdown conversion functionality.

Converts HTML web pages to clean markdown with pagination support.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional, Any, List
import logging

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    logging.warning("requests not available, HTTP fetching will fail")

try:
    import html2text
    HTML2TEXT_AVAILABLE = True
except ImportError:
    HTML2TEXT_AVAILABLE = False
    logging.warning("html2text not available, will use BeautifulSoup only")

try:
    from bs4 import BeautifulSoup
    BEAUTIFULSOUP_AVAILABLE = True
except ImportError:
    BEAUTIFULSOUP_AVAILABLE = False
    logging.error("BeautifulSoup4 not available, markdown conversion will fail")


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class PaginatedWebContent:
    """
    Container for paginated web content.

    Attributes:
        url: Source URL
        full_markdown: Complete converted markdown
        chunks: List of markdown chunks (pages)
        metadata: Conversion metadata
        chunk_size_lines: Lines per chunk
    """
    url: str
    full_markdown: str
    chunks: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    chunk_size_lines: int = 500


def fetch_url(url: str, headers: Optional[Dict[str, str]] = None) -> str:
    """
    Fetch HTML content from a URL.

    Args:
        url: URL to fetch
        headers: Optional HTTP headers

    Returns:
        Raw HTML string

    Raises:
        RuntimeError: If requests is not available
        requests.exceptions.RequestException: On HTTP errors

    Examples:
        >>> html = fetch_url("https://example.com")
        >>> assert "<html" in html.lower()
    """
    if not REQUESTS_AVAILABLE:
        raise RuntimeError(
            "requests library not available. "
            "Install with: pip install requests"
        )

    if headers is None:
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; WebFetcher/1.0)'
        }

    try:
        logger.info(f"Fetching URL: {url}")
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()  # Raise for 4xx/5xx errors

        logger.info(
            f"✅ Fetch successful ({len(response.text)} chars, "
            f"status {response.status_code})"
        )

        return response.text

    except requests.exceptions.Timeout:
        logger.error(f"Timeout fetching {url}")
        raise RuntimeError(f"Request timeout after 30 seconds: {url}")

    except requests.exceptions.ConnectionError:
        logger.error(f"Connection error for {url}")
        raise RuntimeError(f"Could not connect to {url}")

    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error {e.response.status_code} for {url}")
        raise RuntimeError(f"HTTP {e.response.status_code}: {url}")

    except Exception as e:
        logger.error(f"Unexpected error fetching {url}: {e}")
        raise RuntimeError(f"Failed to fetch {url}: {e}") from e


def html_to_markdown(html: str, base_url: str = "") -> str:
    """
    Convert HTML to clean markdown.

    Strategy:
    1. Try html2text (primary) - high fidelity with proper markdown
    2. Fallback to BeautifulSoup get_text() if html2text fails

    Args:
        html: Raw HTML string
        base_url: Base URL for resolving relative links

    Returns:
        Clean markdown string

    Raises:
        RuntimeError: If no conversion method available

    Examples:
        >>> html = "<h1>Title</h1><p>Text</p>"
        >>> md = html_to_markdown(html)
        >>> assert "# Title" in md
    """
    # Try html2text (primary method)
    if HTML2TEXT_AVAILABLE:
        try:
            logger.info("Using html2text for high-fidelity conversion...")

            h = html2text.HTML2Text()
            # Critical: disable line wrapping for LLM context
            h.body_width = 0
            h.ignore_links = False  # Preserve links
            h.ignore_images = False  # Preserve image references

            if base_url:
                markdown = html2text.html2text(html, baseurl=base_url)
            else:
                markdown = h.handle(html)

            logger.info(
                f"✅ html2text conversion successful ({len(markdown)} chars)"
            )

            return markdown

        except Exception as e:
            logger.warning(f"html2text conversion failed: {e}")
            logger.info("Falling back to BeautifulSoup...")

    # Fallback: BeautifulSoup text extraction
    if not BEAUTIFULSOUP_AVAILABLE:
        raise RuntimeError(
            "No HTML conversion method available. "
            "Install html2text or beautifulsoup4."
        )

    try:
        logger.info("Using BeautifulSoup for text extraction...")

        soup = BeautifulSoup(html, 'html.parser')

        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()

        # Get text with newline separators
        text = soup.get_text(separator='\n', strip=True)

        logger.info(
            f"✅ BeautifulSoup conversion successful ({len(text)} chars)"
        )

        return text

    except Exception as e:
        logger.error(f"BeautifulSoup conversion failed: {e}")
        raise RuntimeError(f"All HTML conversion methods failed: {e}") from e


def paginate_markdown(
    markdown: str,
    chunk_size: int = 500
) -> PaginatedWebContent:
    """
    Split markdown into paginated chunks.

    Args:
        markdown: Full markdown content
        chunk_size: Lines per chunk (default: 500)

    Returns:
        PaginatedWebContent with chunks

    Examples:
        >>> markdown = "\\n".join([f"Line {i}" for i in range(1500)])
        >>> content = paginate_markdown(markdown, chunk_size=500)
        >>> assert len(content.chunks) == 3
    """
    lines = markdown.split('\n')
    total_lines = len(lines)

    logger.info(
        f"Paginating {total_lines} lines into chunks of {chunk_size} lines"
    )

    chunks = []
    for i in range(0, total_lines, chunk_size):
        chunk_lines = lines[i:i + chunk_size]
        chunk = '\n'.join(chunk_lines)
        chunks.append(chunk)

    logger.info(f"✅ Created {len(chunks)} chunks")

    return PaginatedWebContent(
        url="",  # Will be set by caller
        full_markdown=markdown,
        chunks=chunks,
        metadata={
            "total_lines": total_lines,
            "total_chunks": len(chunks),
            "chunk_size": chunk_size
        },
        chunk_size_lines=chunk_size
    )


def get_chunk(content: PaginatedWebContent, page: int) -> Dict[str, Any]:
    """
    Retrieve a specific chunk/page.

    Args:
        content: Paginated content
        page: Page number (1-indexed)

    Returns:
        Dictionary with:
            - content: Chunk text
            - page: Current page number
            - total_pages: Total number of pages
            - total_lines: Total lines in document
            - error: Error message if page out of bounds

    Examples:
        >>> markdown = "\\n".join([f"Line {i}" for i in range(1500)])
        >>> content = paginate_markdown(markdown, chunk_size=500)
        >>> result = get_chunk(content, page=2)
        >>> assert "Line 500" in result["content"]
    """
    total_pages = len(content.chunks)

    # Handle out of bounds
    if page < 1:
        logger.warning(f"Page {page} < 1, clamping to page 1")
        page = 1
    elif page > total_pages:
        logger.warning(f"Page {page} > {total_pages}, clamping to last page")
        page = total_pages

    # Get chunk (convert to 0-indexed)
    chunk_text = content.chunks[page - 1]

    result = {
        "content": chunk_text,
        "page": page,
        "total_pages": total_pages,
        "total_lines": content.metadata.get("total_lines", 0),
        "chunk_size": content.chunk_size_lines
    }

    logger.info(f"Retrieved page {page}/{total_pages}")

    return result
