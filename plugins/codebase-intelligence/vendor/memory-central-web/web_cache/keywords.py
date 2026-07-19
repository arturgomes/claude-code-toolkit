import re
from typing import List, Tuple

try:
    from rank_bm25 import BM25Okapi
    HAS_BM25 = True
except ImportError:
    HAS_BM25 = False


def extract_keywords(content: str, top_n: int = 10) -> List[str]:
    """Extract top N keywords using BM25 scoring."""

    if not HAS_BM25:
        # Fallback: simple frequency-based extraction
        return _extract_keywords_fallback(content, top_n)

    # Preprocessing
    content_lower = content.lower()
    content_clean = re.sub(r'[^\w\s]', '', content_lower)

    # Stopwords (minimal set)
    stopwords = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
        'this', 'that', 'these', 'those', 'it', 'its', 'as', 'will', 'would',
        'could', 'should', 'have', 'has', 'had', 'do', 'does', 'did'
    }

    # Tokenize
    tokens = [
        word for word in content_clean.split()
        if word not in stopwords and len(word) > 2
    ]

    if not tokens:
        return []

    # Build BM25 corpus (document is its own corpus for keyword extraction)
    # Use sliding window to create "documents" from chunks
    chunk_size = 50
    chunks = [
        tokens[i:i+chunk_size]
        for i in range(0, len(tokens), chunk_size)
    ]

    if not chunks:
        return []

    # BM25 index
    bm25 = BM25Okapi(chunks)

    # Score each unique token against the corpus
    unique_tokens = list(set(tokens))
    scores = []

    for token in unique_tokens:
        tokenized_query = [token]
        score = sum(bm25.get_scores(tokenized_query))
        scores.append((token, score))

    # Sort by score and return top N
    scores.sort(key=lambda x: x[1], reverse=True)
    return [token for token, _ in scores[:top_n]]


def _extract_keywords_fallback(content: str, top_n: int) -> List[str]:
    """Fallback keyword extraction without BM25 (simple frequency)."""
    content_lower = content.lower()
    content_clean = re.sub(r'[^\w\s]', '', content_lower)

    stopwords = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
        'this', 'that', 'these', 'those', 'it', 'its', 'as', 'will', 'would',
        'could', 'should', 'have', 'has', 'had', 'do', 'does', 'did'
    }

    tokens = [
        word for word in content_clean.split()
        if word not in stopwords and len(word) > 2
    ]

    # Count frequencies
    freq = {}
    for token in tokens:
        freq[token] = freq.get(token, 0) + 1

    # Sort by frequency
    sorted_tokens = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [token for token, _ in sorted_tokens[:top_n]]


def extract_wikilinks(content: str) -> List[str]:
    """Extract [[wikilinks]] from markdown content."""
    wikilink_pattern = r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]'
    wikilinks = re.findall(wikilink_pattern, content)

    # Clean and normalize
    cleaned = []
    for link in wikilinks:
        link = link.strip()
        # Convert to lowercase for keyword matching
        link_lower = link.lower().replace(' ', '-')
        cleaned.append(link_lower)

    return list(set(cleaned))  # Unique only


def generate_tags(keywords: List[str], wikilinks: List[str], max_tags: int = 5) -> List[str]:
    """Generate #tags from keywords and wikilinks."""

    # Combine keywords and wikilinks, prioritize wikilinks
    all_candidates = wikilinks + keywords

    # Filter: only alphanumeric + hyphens, no numbers-only
    valid_tags = []
    for candidate in all_candidates:
        # Clean for tag format
        tag = re.sub(r'[^\w-]', '', candidate.lower())

        # Skip if empty, too short, or numbers-only
        if tag and len(tag) > 2 and not tag.isdigit():
            valid_tags.append(tag)

    # Return unique, limited to max_tags
    unique_tags = []
    for tag in valid_tags:
        if tag not in unique_tags:
            unique_tags.append(tag)
        if len(unique_tags) >= max_tags:
            break

    return unique_tags


def extract_key_sections(markdown: str, max_lines: int = 100) -> str:
    """
    Extract most relevant sections from markdown to reduce token consumption.

    Prioritizes:
    - Headings (all levels)
    - Code blocks (complete blocks)
    - Paragraphs with high keyword density

    Returns condensed markdown with key sections, limited to max_lines.
    """
    if not markdown:
        return ""

    lines = markdown.split('\n')

    # If already short, return as-is
    if len(lines) <= max_lines:
        return markdown

    # Parse into sections with priority scores
    sections = []
    current_section = []
    current_type = 'paragraph'
    in_code_block = False

    for line in lines:
        # Code block markers
        if line.strip().startswith('```'):
            if in_code_block:
                # End of code block
                current_section.append(line)
                sections.append(('code', '\n'.join(current_section), 10))
                current_section = []
                in_code_block = False
                current_type = 'paragraph'
            else:
                # Start of code block
                if current_section:
                    sections.append((current_type, '\n'.join(current_section), 3))
                    current_section = []
                current_section.append(line)
                in_code_block = True
                current_type = 'code'
            continue

        # Inside code block
        if in_code_block:
            current_section.append(line)
            continue

        # Headings (highest priority)
        if line.startswith('#'):
            if current_section:
                sections.append((current_type, '\n'.join(current_section), 3))
                current_section = []
            sections.append(('heading', line, 15))
            current_type = 'paragraph'
            continue

        # Lists (medium priority)
        if line.strip().startswith(('-', '*', '+')) or re.match(r'^\s*\d+\.', line):
            if current_type != 'list':
                if current_section:
                    sections.append((current_type, '\n'.join(current_section), 3))
                    current_section = []
                current_type = 'list'
            current_section.append(line)
            continue

        # Empty lines
        if not line.strip():
            if current_section:
                # Determine priority based on content length and keywords
                priority = 5 if current_type == 'list' else 3
                sections.append((current_type, '\n'.join(current_section), priority))
                current_section = []
            current_type = 'paragraph'
            sections.append(('empty', '', 1))
            continue

        # Regular paragraphs
        if current_type == 'list' and not line.strip().startswith(('-', '*', '+')):
            # End of list
            if current_section:
                sections.append((current_type, '\n'.join(current_section), 5))
                current_section = []
            current_type = 'paragraph'

        current_section.append(line)

    # Flush remaining
    if current_section:
        priority = 10 if in_code_block else (5 if current_type == 'list' else 3)
        sections.append((current_type, '\n'.join(current_section), priority))

    # Sort by priority (highest first), then by original order for ties
    sections_with_idx = [(s, idx) for idx, s in enumerate(sections)]
    sections_with_idx.sort(key=lambda x: (-x[0][2], x[1]))

    # Collect lines until max_lines reached
    result_lines = []
    for (section_type, content, priority), _ in sections_with_idx:
        section_lines = content.split('\n') if content else ['']

        # Check if adding this section exceeds limit
        if len(result_lines) + len(section_lines) > max_lines:
            # Add what we can
            remaining = max_lines - len(result_lines)
            result_lines.extend(section_lines[:remaining])
            break

        result_lines.extend(section_lines)

        if len(result_lines) >= max_lines:
            break

    return '\n'.join(result_lines[:max_lines])
