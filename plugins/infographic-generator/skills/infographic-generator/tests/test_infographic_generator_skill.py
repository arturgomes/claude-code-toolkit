import re
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build_prompt  # noqa: E402

SKILL = (ROOT / "SKILL.md").read_text(encoding="utf-8")
CJK = re.compile("[" + "".join(f"{chr(a)}-{chr(b)}" for a, b in ((0x3000, 0x9FFF), (0xAC00, 0xD7AF), (0xFF00, 0xFFEF))) + "]")


def table_names(heading):
    section = SKILL.split(f"### {heading}\n", 1)[1].split("\n###", 1)[0]
    return set(re.findall(r"^\| `([a-z0-9-]+)` \|", section, re.M))


def stems(folder):
    return {p.stem for p in (ROOT / "references" / folder).glob("*.md")}


def test_description_fits_index_width():
    desc = re.search(r'^description: "(.*)"$', SKILL, re.M).group(1)
    assert len(desc) <= 60 and desc.endswith(".")


@pytest.mark.parametrize("heading,folder", [("Layouts", "layouts"), ("Styles", "styles"), ("Levels", "levels")])
def test_skill_tables_match_reference_files(heading, folder):
    assert table_names(heading) == stems(folder)


def test_pairings_and_style_fit_resolve():
    known = stems("layouts") | stems("styles")
    for p in (ROOT / "references").rglob("*.md"):
        text = p.read_text(encoding="utf-8")
        for line in re.findall(r"^- `([a-z0-9-]+)`:", text, re.M):
            assert line in known, f"{p.name}: unknown pairing {line}"
    for p in (ROOT / "references" / "levels").glob("*.md"):
        fit = p.read_text(encoding="utf-8").split("## Style Fit", 1)[1]
        for name in re.findall(r"`([a-z0-9-]+)`", fit):
            assert name in stems("styles"), f"{p.name}: unknown style {name}"


def test_no_cjk_anywhere():
    bad = [str(p.relative_to(ROOT)) for p in ROOT.rglob("*")
           if p.is_file() and p.suffix in {".md", ".py"} and CJK.search(p.read_text(encoding="utf-8"))]
    assert not bad


def test_build_prompt_inlines_everything():
    out = build_prompt.build("circular-flow", "hand-drawn-edu", "early", "portrait", "pt-BR", "Ciclo da água: \"Evaporação\"")
    assert "{{" not in out
    assert "9:16" in out and "português do Brasil (pt-BR)" in out and "ã õ ç" in out
    assert "# circular-flow" in out and "# hand-drawn-edu" in out and "Idades 6-10" in out
    assert "\"Evaporação\"" in out


def test_content_with_placeholder_text_is_not_expanded():
    out = build_prompt.build("bento-grid", "craft-handmade", "high", "4:3", "en", "literal {{STYLE}} stays")
    assert "literal {{STYLE}} stays" in out


def test_rejects_other_languages_and_bad_aspect(tmp_path):
    content = tmp_path / "c.md"
    content.write_text("x", encoding="utf-8")
    base = [sys.executable, str(ROOT / "scripts" / "build_prompt.py"), "--content", str(content), "--out", str(tmp_path / "o.md")]
    assert subprocess.run(base + ["--language", "ja"], capture_output=True).returncode != 0
    assert subprocess.run(base + ["--language", "en", "--aspect", "wide"], capture_output=True).returncode != 0


def test_existing_output_is_backed_up(tmp_path):
    out = tmp_path / "prompts" / "infographic.md"
    build_prompt.write_with_backup(out, "one")
    build_prompt.write_with_backup(out, "two")
    backups = list(out.parent.glob("infographic-backup-*.md"))
    assert out.read_text() == "two" and [b.read_text() for b in backups] == ["one"]


def test_agent_only_hints_are_not_inlined():
    out = build_prompt.build("bento-grid", "chalkboard", "middle", "landscape", "en", "x")
    for hint in ("Recommended Pairings", "Best For", "Style Fit"):
        assert hint not in out
    assert "## Estrutura" in out and "## Tipografia" in out


def test_template_draws_only_quoted_text():
    assert "entre aspas duplas" in (ROOT / "references" / "base-prompt.md").read_text(encoding="utf-8")
