#!/usr/bin/env bash
# Structural validation for the codebase-intelligence plugin.
# Repo-owned so every machine and every CI run applies the SAME checks — not whatever
# the author happened to type into a shell that day.
#
#   ./scripts/validate.sh            # validate this plugin
#   ./scripts/validate.sh --strict   # warnings also fail (used by CI)
#
# Exit 0 = pass, 1 = at least one FAIL (or a WARN under --strict).
# Read-only: never writes, installs, or fixes anything.
set -uo pipefail

STRICT=0
[ "${1:-}" = "--strict" ] && STRICT=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"

fails=0; warns=0
echo "codebase-intelligence — validate"
echo "================================"
echo "plugin: $ROOT"
echo

# ── C1  shell scripts parse ───────────────────────────────────────────────────
echo "C1 shell syntax"
for f in "$ROOT"/scripts/*.sh; do
  [ -e "$f" ] || continue
  if bash -n "$f" 2>/dev/null; then
    printf '  [OK]   %s\n' "${f#"$ROOT"/}"
  else
    printf '  [FAIL] %s\n' "${f#"$ROOT"/}"; bash -n "$f" 2>&1 | sed 's/^/         /'; fails=$((fails+1))
  fi
done

# ── C2-C6  structure, frontmatter, fences, versions, dangling refs ────────────
echo
python3 - "$ROOT" "$REPO_ROOT" <<'PY'
import json, os, re, sys

root, repo_root = sys.argv[1], sys.argv[2]
fails, warns = [], []

def fail(c, m): fails.append(f"[FAIL] {c}: {m}")
def warn(c, m): warns.append(f"[WARN] {c}: {m}")

def walk(sub, ext):
    base = os.path.join(root, sub)
    for dirpath, _, names in os.walk(base):
        for n in sorted(names):
            if n.endswith(ext):
                yield os.path.join(dirpath, n)

def rel(p): return os.path.relpath(p, root)

# ── C2  every JSON parses ─────────────────────────────────────────────────────
json_files = list(walk("", ".json")) + [
    os.path.join(repo_root, ".claude-plugin", "marketplace.json")]
for p in json_files:
    if not os.path.exists(p):
        continue
    try:
        json.load(open(p))
    except Exception as e:
        fail("C2", f"{rel(p)} is not valid JSON — {e}")
print(f"C2 json parse ...... {len([p for p in json_files if os.path.exists(p)])} files")

# ── C3  frontmatter on every command / skill / agent ──────────────────────────
FM = re.compile(r'^---\n(.*?)\n---\n', re.S)
def frontmatter(p):
    m = FM.match(open(p, encoding="utf-8").read())
    return m.group(1) if m else None

n_fm = 0
for p in sorted(walk("commands", ".md")):
    fm = frontmatter(p); n_fm += 1
    stem = os.path.splitext(os.path.basename(p))[0]
    if fm is None:
        fail("C3", f"{rel(p)} has no frontmatter")
        continue
    # name: is optional for commands — the filename is the command name. A name that
    # DISAGREES with the filename is the real bug: it silently registers under the file name.
    m = re.search(r'^name:\s*(\S+)', fm, re.M)
    if m and m.group(1) != stem:
        fail("C3", f"{rel(p)} declares name: {m.group(1)} but the command is /{stem}")
    if not re.search(r'^description:', fm, re.M):
        fail("C3", f"{rel(p)} has no description: (it is how the command is listed)")

for d in sorted(os.listdir(os.path.join(root, "skills"))):
    sp = os.path.join(root, "skills", d, "SKILL.md")
    if not os.path.isdir(os.path.join(root, "skills", d)):
        continue
    if not os.path.exists(sp):
        fail("C3", f"skills/{d}/ has no SKILL.md"); continue
    fm = frontmatter(sp); n_fm += 1
    if fm is None:
        fail("C3", f"skills/{d}/SKILL.md has no frontmatter"); continue
    m = re.search(r'^name:\s*(\S+)', fm, re.M)
    if not m:
        fail("C3", f"skills/{d}/SKILL.md frontmatter has no name:")
    elif m.group(1) != d:
        fail("C3", f"skills/{d}/SKILL.md declares name: {m.group(1)} — must equal its directory name")
    if not re.search(r'^description:', fm, re.M):
        fail("C3", f"skills/{d}/SKILL.md has no description: (it is how the skill gets discovered)")

# agents/: every .md here is registered AS AN AGENT. Docs that are not agents do not belong.
for p in sorted(walk("agents", ".md")):
    fm = frontmatter(p); n_fm += 1
    if fm is None:
        warn("C3", f"{rel(p)} has no frontmatter but sits in agents/ — it registers as a "
                   f"nameless agent; move it out of agents/ or give it frontmatter")
    elif not re.search(r'^name:', fm, re.M):
        warn("C3", f"{rel(p)} frontmatter has no name:")
print(f"C3 frontmatter ..... {n_fm} files")

# ── C4  balanced code fences ──────────────────────────────────────────────────
n_md = 0
for p in sorted(walk("", ".md")):
    n_md += 1
    n = len(re.findall(r'^```', open(p, encoding="utf-8").read(), re.M))
    if n % 2:
        fail("C4", f"{rel(p)} has {n} code-fence markers (unbalanced)")
print(f"C4 code fences ..... {n_md} files")

# ── C5  version consistency ───────────────────────────────────────────────────
pv = json.load(open(os.path.join(root, ".claude-plugin", "plugin.json")))["version"]
mp_path = os.path.join(repo_root, ".claude-plugin", "marketplace.json")
if os.path.exists(mp_path):
    mp = json.load(open(mp_path))
    if mp.get("metadata", {}).get("version") != pv:
        fail("C5", f"marketplace.json metadata.version={mp.get('metadata',{}).get('version')} "
                   f"!= plugin.json {pv}")
    for entry in mp.get("plugins", []):
        if entry.get("name") == os.path.basename(root) and entry.get("version") != pv:
            fail("C5", f"marketplace.json plugins[{entry.get('name')}].version="
                       f"{entry.get('version')} != plugin.json {pv}")
readme = open(os.path.join(root, "README.md"), encoding="utf-8").read()
m = re.search(r'^- \*\*v([0-9]+\.[0-9]+\.[0-9]+)\*\*', readme, re.M)
if not m:
    warn("C5", "README.md has no version-history entry to check")
elif m.group(1) != pv:
    fail("C5", f"README.md newest version-history entry is v{m.group(1)} != plugin.json {pv}")
print(f"C5 versions ........ plugin.json v{pv}")

# ── C6  no dangling skill / command references ────────────────────────────────
skills = {d for d in os.listdir(os.path.join(root, "skills"))
          if os.path.exists(os.path.join(root, "skills", d, "SKILL.md"))}
commands = {os.path.splitext(f)[0] for f in os.listdir(os.path.join(root, "commands"))
            if f.endswith(".md")}
known = skills | commands
plugin_name = os.path.basename(root)

SKILL_REF = re.compile(r'Skill\(\s*(?:' + re.escape(plugin_name) + r':)?([a-z0-9][a-z0-9-]*)\s*\)')
CMD_REF   = re.compile(r'/(?:' + re.escape(plugin_name) + r':)?(prp-[a-z0-9-]+)\b')

n_refs = 0
for p in sorted(list(walk("commands", ".md")) + list(walk("skills", ".md")) + list(walk("agents", ".md"))):
    text = open(p, encoding="utf-8").read()
    for ref in set(SKILL_REF.findall(text)):
        n_refs += 1
        if ref not in known:
            fail("C6", f"{rel(p)} references Skill({ref}) — no such skill or command")
    for ref in set(CMD_REF.findall(text)):
        n_refs += 1
        if ref not in known:
            fail("C6", f"{rel(p)} references /{ref} — no such command")
print(f"C6 references ...... {n_refs} resolved")

# ── C8  shared/ contracts: cited, resolvable, and not re-inlined ──────────────
# The point of shared/ is that a cross-cutting rule has ONE copy. Two things break that:
# a citation that does not resolve (the reader silently gets nothing), and a block that
# gets pasted back inline into three or more files (the drift starts again).
shared_dir = os.path.join(root, "shared")
n_cites = 0
if os.path.isdir(shared_dir):
    shared_files = {f for f in os.listdir(shared_dir) if f.endswith(".md")}
    CITE = re.compile(r'`((?:\.\./)+shared/[A-Za-z0-9._-]+\.md)`')
    cited = set()
    for p in sorted(list(walk("commands", ".md")) + list(walk("skills", ".md"))
                    + list(walk("agents", ".md")) + list(walk("presets", ".md"))
                    + list(walk("skills", ".json")) + list(walk("shared", ".md"))):
        if os.path.dirname(p) == shared_dir and os.path.basename(p) == "README.md":
            continue  # the index cites everything by name, not by path
        here = os.path.dirname(p)
        for m in set(CITE.findall(open(p, encoding="utf-8").read())):
            n_cites += 1
            target = os.path.normpath(os.path.join(here, m))
            if not os.path.exists(target):
                fail("C8", f"{rel(p)} cites `{m}` — resolves to {os.path.relpath(target, root)}, "
                           f"which does not exist")
            else:
                cited.add(os.path.basename(target))
    # README.md is the index; it is cited by prose, not by path
    for f in sorted(shared_files - cited - {"README.md"}):
        warn("C8", f"shared/{f} is cited by nothing — either wire it up or delete it")

    # a shared line that reappears verbatim in 3+ other files is the duplication coming back
    shared_lines = {}
    for f in sorted(shared_files):
        for line in open(os.path.join(shared_dir, f), encoding="utf-8"):
            s = re.sub(r'\s+', ' ', line).strip()
            if len(s) >= 60 and not s.startswith(("|", "#", "-", "`", ">")):
                shared_lines.setdefault(s, f)
    seen = {}
    for p in sorted(list(walk("commands", ".md")) + list(walk("skills", ".md"))
                    + list(walk("agents", ".md"))):
        for line in open(p, encoding="utf-8"):
            s = re.sub(r'\s+', ' ', line).strip()
            if s in shared_lines:
                seen.setdefault(s, []).append(rel(p))
    for s, users in sorted(seen.items()):
        if len(users) >= 3:
            fail("C8", f"shared/{shared_lines[s]} line re-inlined in {len(users)} files "
                       f"({', '.join(users[:3])}…) — cite it instead: \"{s[:60]}…\"")
print(f"C8 shared/ ......... {n_cites} citations")

print()
for line in fails + warns:
    print("  " + line)
print()
print(f"structural: {len(fails)} fail · {len(warns)} warn")
sys.exit(2 if fails else (3 if warns else 0))
PY
rc=$?
case "$rc" in
  0) : ;;
  2) fails=$((fails+1)) ;;
  3) warns=$((warns+1)) ;;
  *) echo "  [FAIL] structural checks crashed (exit $rc)"; fails=$((fails+1)) ;;
esac

# ── C7  the harness's own validator (authoritative for schema) ────────────────
echo
echo "C7 claude plugin validate"
if command -v claude >/dev/null 2>&1; then
  out="$(claude plugin validate "$ROOT" 2>&1)"; vrc=$?
  if [ "$vrc" -ne 0 ]; then
    printf '  [FAIL] validator exited %s\n' "$vrc"; sed 's/^/         /' <<<"$out" | tail -30
    fails=$((fails+1))
  else
    nwarn="$(grep -c '⚠' <<<"$out" || true)"
    if [ "${nwarn:-0}" -gt 0 ]; then
      printf '  [ -- ] passed with %s warning(s) — run: claude plugin validate %s\n' "$nwarn" "$ROOT"
      warns=$((warns+1))
    else
      printf '  [OK]   passed clean\n'
    fi
  fi
else
  printf '  [ -- ] claude CLI not on PATH — schema check skipped (optional)\n'
  warns=$((warns+1))
fi

echo
echo "--------------------------------"
printf 'validate: %d fail · %d warn\n' "$fails" "$warns"
if [ "$fails" -gt 0 ]; then echo "FAILED"; exit 1; fi
if [ "$STRICT" -eq 1 ] && [ "$warns" -gt 0 ]; then echo "FAILED (--strict: warnings are errors)"; exit 1; fi
echo "OK"
exit 0
