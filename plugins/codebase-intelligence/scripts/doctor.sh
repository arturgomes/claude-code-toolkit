#!/usr/bin/env bash
# Read-only health check for codebase-intelligence prerequisites.
# Prints ✓ (ok) / — (optional missing) / ✗ (required missing) and the exact fix command.
# Does NOT install, clone, or bootstrap anything.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pass=0; warn=0; fail=0
ok()  { printf '  [OK]   %s\n' "$1"; pass=$((pass+1)); }
opt() { printf '  [ -- ] %s (optional)\n         fix: %s\n' "$1" "$2"; warn=$((warn+1)); }
req() { printf '  [MISS] %s\n         fix: %s\n' "$1" "$2"; fail=$((fail+1)); }

echo "codebase-intelligence — doctor"
echo "=============================="
echo
echo "System tools"
command -v git     >/dev/null 2>&1 && ok "git"     || req "git not found"     "xcode-select --install"
command -v uv      >/dev/null 2>&1 && ok "uv"      || req "uv not found"      "brew install uv   (or: pip install uv)"
command -v python3 >/dev/null 2>&1 && ok "python3" || req "python3 not found" "brew install python"

echo
echo "MCP servers"
MCP="$(claude mcp list 2>/dev/null || true)"
if [ -z "$MCP" ]; then
  opt "could not run 'claude mcp list'" "run this inside Claude Code with the CLI on PATH"
else
  grep -qiE "ultimate-obsidian" <<<"$MCP" && ok "ultimate-obsidian (required — notes/memory/KB)" \
    || req "ultimate-obsidian MCP not configured" "claude mcp add ultimate-obsidian -- node <path>/ultimate-obsidian-mcp/dist/index.js"
  grep -qiE "(^|[: ])serena[: ]" <<<"$MCP" && ok "serena (codebase LSP search)" \
    || opt "serena MCP not configured" "claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant"
  grep -qiE "context7" <<<"$MCP" && ok "context7 (library docs)" \
    || opt "context7 MCP not configured" "claude mcp add --transport http context7 https://mcp.context7.com/mcp"
  grep -qiE "tlassian" <<<"$MCP" && ok "Atlassian/Jira (ticket context)" \
    || opt "Atlassian MCP not configured" "connect via claude.ai integrations, or: claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp"
fi

echo
echo "KB engine (bookrag)"
BH=""
for d in "${CI_BOOKRAG_HOME:-}" "$HOME/.codebase-intelligence/skills-mono-repo" "$HOME/Documents/ai-tools/skills-mono-repo"; do
  [ -n "$d" ] && [ -f "$d/bookrag/pyproject.toml" ] && { BH="$d"; break; }
done
if [ -z "$BH" ]; then
  req "bookrag engine not provisioned" "/setup-kb   (clones pinned upstream + applies patches)"
elif ( cd "$BH" && uv run bookrag --help >/dev/null 2>&1 ); then
  ok "bookrag ready ($BH)"
else
  req "bookrag present but CLI failed ($BH)" "cd $BH && uv sync"
fi

echo
echo "Vendored tools"
[ -f "$SCRIPT_DIR/../vendor/memory-central-web/fetch-web.py" ] \
  && ok "memory-central-web (web-search cache)" \
  || req "vendored web-cache missing" "reinstall the plugin (claude plugin update codebase-intelligence)"

echo
echo "Data locations"
[ -d "$HOME/Documents/Obsidian-Vault" ] \
  && ok "Obsidian vault (~/Documents/Obsidian-Vault)" \
  || opt "Obsidian vault not at default path" "create ~/Documents/Obsidian-Vault, or adjust the vault path in the KB skills"

echo
echo "------------------------------"
printf 'Summary: %d ok · %d optional missing · %d required missing\n' "$pass" "$warn" "$fail"
if [ "$fail" -eq 0 ]; then
  echo "All required prerequisites satisfied."
else
  echo "Resolve the [MISS] items above, then re-run /doctor."
fi
exit 0
