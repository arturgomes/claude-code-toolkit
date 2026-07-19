#!/usr/bin/env bash
# Print the resolved bookrag engine root (the dir passed to `uv run --directory`).
# Resolution order: CI_BOOKRAG_HOME env -> managed clone -> legacy personal path.
# If none exist, bootstraps the managed clone (pinned + patched) and prints it.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MANAGED="${CI_BOOKRAG_HOME:-$HOME/.codebase-intelligence/skills-mono-repo}"
for d in "$MANAGED" "$HOME/Documents/ai-tools/skills-mono-repo"; do
  if [ -f "$d/bookrag/pyproject.toml" ]; then echo "$d"; exit 0; fi
done

# Nothing present — bootstrap the managed clone.
bash "$SCRIPT_DIR/bootstrap-bookrag.sh" >/dev/null
echo "$MANAGED"
