"""
Session state manager for interactive web fetching.

Maintains current URL, page number, and content for navigation.
"""

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional, Dict, Any
import json
import logging

from .fetcher import PaginatedWebContent, fetch_url, html_to_markdown, paginate_markdown, get_chunk


logger = logging.getLogger(__name__)


@dataclass
class WebFetchSession:
    """
    Session state for interactive web fetching.

    Attributes:
        url: Current URL
        current_page: Current page number (1-indexed)
        content: Paginated content
        session_file: Path to session state file
    """
    url: str = ""
    current_page: int = 1
    content: Optional[PaginatedWebContent] = None
    session_file: Path = Path("/tmp/web-fetch-session.json")

    def load_url(
        self,
        url: str,
        chunk_size: int = 500,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Load a new URL into the session.

        Args:
            url: URL to fetch
            chunk_size: Lines per chunk
            headers: Optional HTTP headers

        Returns:
            First page content
        """
        logger.info(f"Loading URL into session: {url}")

        # Fetch and convert
        html = fetch_url(url, headers=headers)
        markdown = html_to_markdown(html, base_url=url)

        # Paginate
        self.content = paginate_markdown(markdown, chunk_size=chunk_size)
        self.content.url = url  # Set the URL in content
        self.url = url
        self.current_page = 1

        # Save session
        self.save()

        # Return first page
        return self.get_current()

    def next(self) -> Dict[str, Any]:
        """Navigate to next page."""
        if not self.content:
            raise RuntimeError("No content loaded. Use load_url() first.")

        total_pages = len(self.content.chunks)
        if self.current_page < total_pages:
            self.current_page += 1
            self.save()
            logger.info(f"Navigated to next page: {self.current_page}/{total_pages}")
        else:
            logger.warning(f"Already at last page ({self.current_page}/{total_pages})")

        return self.get_current()

    def prev(self) -> Dict[str, Any]:
        """Navigate to previous page."""
        if not self.content:
            raise RuntimeError("No content loaded. Use load_url() first.")

        if self.current_page > 1:
            self.current_page -= 1
            self.save()
            logger.info(f"Navigated to previous page: {self.current_page}")
        else:
            logger.warning("Already at first page")

        return self.get_current()

    def goto(self, page: int) -> Dict[str, Any]:
        """Jump to specific page."""
        if not self.content:
            raise RuntimeError("No content loaded. Use load_url() first.")

        total_pages = len(self.content.chunks)
        if 1 <= page <= total_pages:
            self.current_page = page
            self.save()
            logger.info(f"Jumped to page {page}/{total_pages}")
        else:
            logger.warning(f"Page {page} out of bounds (1-{total_pages}), clamping")
            self.current_page = max(1, min(page, total_pages))
            self.save()

        return self.get_current()

    def get_current(self) -> Dict[str, Any]:
        """Get current page content."""
        if not self.content:
            raise RuntimeError("No content loaded. Use load_url() first.")

        return get_chunk(self.content, self.current_page)

    def get_full_content(self) -> str:
        """Return the full markdown content (all pages combined).

        Useful for caching complete content.
        """
        if not self.content:
            return ""

        return self.content.markdown

    def save(self) -> None:
        """Save session state to file."""
        if not self.content:
            return

        state = {
            "url": self.url,
            "current_page": self.current_page,
            "chunk_size": self.content.chunk_size_lines,
            "total_pages": len(self.content.chunks),
            "total_lines": self.content.metadata.get("total_lines", 0)
        }

        try:
            with open(self.session_file, 'w') as f:
                json.dump(state, f, indent=2)
            logger.debug(f"Session saved to {self.session_file}")
        except Exception as e:
            logger.warning(f"Failed to save session: {e}")

    def load(self) -> bool:
        """
        Load session state from file.

        Returns:
            True if session loaded successfully, False otherwise
        """
        if not self.session_file.exists():
            logger.debug("No session file found")
            return False

        try:
            with open(self.session_file, 'r') as f:
                state = json.load(f)

            # Validate required fields
            if not all(k in state for k in ['url', 'current_page']):
                logger.warning("Invalid session file")
                return False

            # Re-fetch content
            logger.info(f"Restoring session for {state['url']}")
            chunk_size = state.get('chunk_size', 500)
            self.load_url(state['url'], chunk_size=chunk_size)
            self.current_page = state['current_page']

            logger.info(f"✅ Session restored (page {self.current_page})")
            return True

        except Exception as e:
            logger.warning(f"Failed to load session: {e}")
            return False
