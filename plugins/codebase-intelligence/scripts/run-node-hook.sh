#!/usr/bin/env bash
# Runs one of the plugin's Node hooks, resolving `node` on machines where the
# hook environment does not inherit a shell profile (nvm's PATH lives in one).
#
# Fail-open is the whole contract: no node, no script, a crash — every path
# exits 0 and prints nothing, so a hook can never wedge or fail a session.
set -uo pipefail

SCRIPT="${1:-}"
[ -n "$SCRIPT" ] && [ -f "$SCRIPT" ] || exit 0

resolve_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return
  fi
  # nvm keeps node off the default PATH; take its highest installed version.
  local candidate
  candidate="$(ls -1d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -1)"
  [ -n "$candidate" ] && [ -x "$candidate" ] && printf '%s' "$candidate"
}

NODE="$(resolve_node)"
[ -n "$NODE" ] || exit 0

"$NODE" "$SCRIPT" 2>/dev/null || exit 0
exit 0
