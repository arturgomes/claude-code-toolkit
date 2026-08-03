#!/usr/bin/env bash
# SessionStart hook — runs setup ONCE PER PLUGIN VERSION, on whatever machine the plugin
# is installed on. This is the "install on any computer when we update the skill" path.
#
# How it knows an update happened: ${CLAUDE_PLUGIN_ROOT} changes on every plugin version,
# but ${CLAUDE_PLUGIN_DATA} (~/.claude/plugins/data/<id>/) OUTLIVES updates. So the
# bundled version is compared against a stamp kept in the data dir — the documented
# pattern for detecting a dependency-changing update, applied to a version string instead
# of a package.json.
#
# Two hard requirements, because this runs on every session start:
#   1. SILENT when healthy. Hook stdout becomes model context; a chatty hook is a tax paid
#      on every session forever.
#   2. NEVER fails the session. Every path exits 0.
set -uo pipefail

ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DATA="${CLAUDE_PLUGIN_DATA:-}"

# No data dir (running from --plugin-dir, or an older harness) ⇒ nothing to stamp against.
# Do nothing rather than re-running setup on every single session.
[ -n "$DATA" ] || exit 0
mkdir -p "$DATA" 2>/dev/null || exit 0

BUNDLED="$ROOT/.claude-plugin/plugin.json"
STAMP="$DATA/installed-version"
[ -f "$BUNDLED" ] || exit 0

version="$(python3 -c "import json;print(json.load(open('$BUNDLED'))['version'])" 2>/dev/null || echo "")"
[ -n "$version" ] || exit 0

# Same version already set up on this machine → nothing to do, say nothing.
[ -f "$STAMP" ] && [ "$(cat "$STAMP" 2>/dev/null)" = "$version" ] && exit 0

# First install, or the plugin was updated. Run setup in check-only + quiet mode: it prints
# ONLY when something required is missing. Installing is never automatic — see setup.sh.
out="$(bash "$ROOT/scripts/setup.sh" --quiet 2>/dev/null || true)"
[ -n "$out" ] && printf '%s\n' "$out"

# Stamp last, so a crashed run retries next session instead of being silently skipped.
printf '%s' "$version" > "$STAMP" 2>/dev/null || true
exit 0
