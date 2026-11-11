#!/usr/bin/env python3
"""Assemble an infographic image prompt: base template + audience level + layout + style + content."""
import argparse
import re
import sys
from datetime import datetime
from pathlib import Path

REFS = Path(__file__).resolve().parent.parent / "references"
LANGUAGES = {
    "pt-BR": (
        "Brazilian Portuguese (pt-BR)",
        "Render Portuguese accents exactly: ã õ ç á à â é ê í ó ô ú. A missing or wrong accent is an error.",
    ),
    "en": ("English", "Use standard English spelling."),
}
NAMED_ASPECTS = {"landscape": "16:9", "portrait": "9:16", "square": "1:1"}
RATIO = re.compile(r"^\d+(\.\d+)?:\d+(\.\d+)?$")


def names(folder):
    return sorted(p.stem for p in (REFS / folder).glob("*.md"))


# Selection hints for the agent; inlined, they would hand the image model other styles to mix in.
AGENT_ONLY = re.compile(r"^## (Best For|Recommended Pairings|Style Fit)\n.*?(?=^## |\Z)", re.M | re.S)


def ref(folder, name):
    return AGENT_ONLY.sub("", (REFS / folder / f"{name}.md").read_text(encoding="utf-8")).strip()


def resolve_aspect(value):
    aspect = NAMED_ASPECTS.get(value, value)
    if not RATIO.match(aspect):
        raise ValueError(f"aspect must be landscape, portrait, square or W:H (got {value!r})")
    return aspect


def build(layout, style, level, aspect, language, content):
    label, note = LANGUAGES[language]
    values = {
        "LAYOUT": layout,
        "STYLE": style,
        "ASPECT_RATIO": resolve_aspect(aspect),
        "LANGUAGE": label,
        "LANGUAGE_NOTE": note,
        "AUDIENCE_GUIDELINES": ref("levels", level),
        "LAYOUT_GUIDELINES": ref("layouts", layout),
        "STYLE_GUIDELINES": ref("styles", style),
        "CONTENT": content.strip(),
    }
    template = (REFS / "base-prompt.md").read_text(encoding="utf-8")
    # One pass, so placeholder-like text inside the content is never re-expanded.
    return re.sub(r"\{\{(\w+)\}\}", lambda m: values[m.group(1)], template)


def write_with_backup(out, text):
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        out.rename(out.with_name(f"{out.stem}-backup-{stamp}{out.suffix}"))
    out.write_text(text, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--layout", choices=names("layouts"), default="bento-grid")
    ap.add_argument("--style", choices=names("styles"), default="hand-drawn-edu")
    ap.add_argument("--level", choices=names("levels"), default="middle")
    ap.add_argument("--aspect", default="landscape", help="landscape, portrait, square or W:H such as 4:3")
    ap.add_argument("--language", choices=sorted(LANGUAGES), required=True)
    ap.add_argument("--content", required=True, type=Path, help="structured-content.md")
    ap.add_argument("--out", required=True, type=Path, help="e.g. prompts/infographic.md")
    a = ap.parse_args()
    try:
        text = build(a.layout, a.style, a.level, a.aspect, a.language, a.content.read_text(encoding="utf-8"))
    except (ValueError, OSError) as e:
        sys.exit(f"error: {e}")
    write_with_backup(a.out, text)
    print(a.out)


if __name__ == "__main__":
    main()
