#!/usr/bin/env python3
"""Extract plain text from an EPUB chapter HTML/XHTML file.

Usage:
    python3 epub-extract.py <chapter.xhtml>

Pre-extract the EPUB first:
    unzip -o book.epub -d /tmp/epub_extracted/
    find /tmp/epub_extracted -name "*.html" -o -name "*.xhtml" | sort
"""
from html.parser import HTMLParser
import sys


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.skip_tags = {"script", "style"}
        self.current_skip = False

    def handle_starttag(self, tag, attrs):
        if tag in self.skip_tags:
            self.current_skip = True

    def handle_endtag(self, tag):
        if tag in self.skip_tags:
            self.current_skip = False

    def handle_data(self, data):
        if not self.current_skip and data.strip():
            self.text.append(data.strip())


if __name__ == "__main__":
    parser = TextExtractor()
    with open(sys.argv[1]) as f:
        parser.feed(f.read())
    print("\n".join(parser.text))
