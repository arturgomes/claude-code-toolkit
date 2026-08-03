#!/usr/bin/env bash
# One-command setup for codebase-intelligence on a new machine, and after an update.
#
#   ./scripts/setup.sh              # CHECK ONLY — report what is missing and the exact fix
#   ./scripts/setup.sh --install    # also perform the safe, idempotent installs
#   ./scripts/setup.sh --quiet      # print nothing when everything required is present
#
# Why check-only is the default: this plugin is installed from a marketplace onto other
# people's machines. A setup script that installs software the moment it is loaded is the
# same class of surprise this plugin refuses elsewhere (see worktree-lifecycle: "a skill
# that silently installs hooks into someone's settings is a worse problem than the one it
# solves"). --install is the opt-in, and it only ever touches things scoped to this tool.
#
# Idempotent: safe to re-run any number of times. Never uninstalls or downgrades anything.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DO_INSTALL=0; QUIET=0
for a in "$@"; do
  case "$a" in
    --install) DO_INSTALL=1 ;;
    --quiet)   QUIET=1 ;;
    -h|--help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

missing_required=0; installed=0; notes=()
say()  { [ "$QUIET" -eq 1 ] || printf '%s\n' "$1"; }
note() { notes+=("$1"); }

VERSION="$(python3 -c "import json;print(json.load(open('$ROOT/.claude-plugin/plugin.json'))['version'])" 2>/dev/null || echo "?")"
say "codebase-intelligence — setup (v$VERSION)"
say "$([ "$DO_INSTALL" -eq 1 ] && echo "mode: install" || echo "mode: check only (pass --install to act)")"
say ""

# ── required: nothing here can be auto-installed without a package manager decision ───
for tool in git python3; do
  command -v "$tool" >/dev/null 2>&1 || { note "REQUIRED $tool is missing — install it and re-run"; missing_required=1; }
done

# ── uv (KB engine) ────────────────────────────────────────────────────────────────────
if ! command -v uv >/dev/null 2>&1; then
  if [ "$DO_INSTALL" -eq 1 ] && command -v brew >/dev/null 2>&1; then
    say "installing uv (brew)…"; brew install uv >/dev/null 2>&1 && installed=$((installed+1)) \
      || note "uv install failed — try: pip install uv"
  else
    note "uv is missing (KB engine) — fix: brew install uv    (or: pip install uv)"
    missing_required=1
  fi
fi

# ── gh + the gh-stack extension (optional; stacked PRs and /prp-checkup) ──────────────
if command -v gh >/dev/null 2>&1; then
  gh auth status >/dev/null 2>&1 || note "gh is not authenticated — /prp-checkup cannot read PR merge state. fix: gh auth login"
  if ! gh stack --help >/dev/null 2>&1; then
    if [ "$DO_INSTALL" -eq 1 ]; then
      say "installing the gh-stack extension…"
      gh extension install github/gh-stack >/dev/null 2>&1 && installed=$((installed+1)) \
        || note "gh-stack install failed — /prp-orchestrate will ship one PR per run"
    else
      note "gh-stack extension absent — /prp-orchestrate --stack unavailable (one PR per run). fix: gh extension install github/gh-stack"
    fi
  fi
else
  note "gh is missing — no PR creation, no stacked PRs, no /prp-checkup. fix: brew install gh && gh auth login"
fi

# ── KB engine (bookrag) — delegate to the existing bootstrap, never reimplement ───────
BH=""
for d in "${CI_BOOKRAG_HOME:-}" "$HOME/.codebase-intelligence/skills-mono-repo" "$HOME/Documents/ai-tools/skills-mono-repo"; do
  [ -n "$d" ] && [ -f "$d/bookrag/pyproject.toml" ] && { BH="$d"; break; }
done
if [ -z "$BH" ]; then
  if [ "$DO_INSTALL" -eq 1 ] && [ -x "$SCRIPT_DIR/bootstrap-bookrag.sh" ]; then
    say "bootstrapping the bookrag KB engine…"
    "$SCRIPT_DIR/bootstrap-bookrag.sh" >/dev/null 2>&1 && installed=$((installed+1)) \
      || note "bookrag bootstrap failed — run /setup-kb for the interactive path"
  else
    note "bookrag KB engine not provisioned — fix: /setup-kb    (or: setup.sh --install)"
  fi
fi

# ── report ────────────────────────────────────────────────────────────────────────────
if [ "${#notes[@]}" -gt 0 ]; then
  if [ "$QUIET" -eq 1 ] && [ "$missing_required" -eq 0 ]; then
    :   # quiet mode stays silent unless something REQUIRED is missing
  else
    printf 'codebase-intelligence v%s — setup notes:\n' "$VERSION"
    for n in "${notes[@]}"; do printf '  · %s\n' "$n"; done
    printf '  run `/codebase-intelligence:doctor` for the full report.\n'
  fi
else
  say "everything required is present."
fi
[ "$installed" -gt 0 ] && say "installed: $installed component(s)."

# Never fail the caller: setup is advisory, and a missing optional tool must not break a
# session. The exit code reports state for scripts that want it.
exit 0
