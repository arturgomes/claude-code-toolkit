#!/usr/bin/env bash
# Bootstrap a pinned, patched bookrag engine WITHOUT vendoring third-party code.
#
# Clones the public upstream (hvasoares/skills-mono-repo) at a PINNED commit — fetched
# from source, never redistributed by this plugin — then applies the repo owner's own
# deltas as local patches (obsidian-ingest pipeline + a Chroma batching fix). The result
# reproduces the working bookrag engine the KB skills need, insulated from upstream drift.
#
# Location is overridable via CI_BOOKRAG_HOME. Idempotent: safe to re-run.
set -euo pipefail

REPO_URL="${CI_BOOKRAG_REPO:-https://github.com/hvasoares/skills-mono-repo.git}"
PINNED_SHA="f202c92d6871f01fcda90c8f382b5bafc1f5e5a3"
DEST="${CI_BOOKRAG_HOME:-$HOME/.codebase-intelligence/skills-mono-repo}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCHES="$SCRIPT_DIR/patches"

log() { printf 'bootstrap-bookrag: %s\n' "$*" >&2; }

command -v git >/dev/null || { log "git not found"; exit 1; }
command -v uv  >/dev/null || { log "uv not found — install: brew install uv (or pip install uv)"; exit 1; }

if [ ! -d "$DEST/.git" ]; then
  log "cloning $REPO_URL -> $DEST"
  mkdir -p "$(dirname "$DEST")"
  git clone --quiet "$REPO_URL" "$DEST"
fi

cur="$(git -C "$DEST" rev-parse HEAD 2>/dev/null || echo none)"
if [ "$cur" != "$PINNED_SHA" ]; then
  log "checking out pinned $PINNED_SHA"
  git -C "$DEST" checkout --quiet "$PINNED_SHA" 2>/dev/null || {
    git -C "$DEST" fetch --quiet origin "$PINNED_SHA" 2>/dev/null || git -C "$DEST" fetch --quiet origin
    git -C "$DEST" checkout --quiet "$PINNED_SHA"
  }
fi

apply_patch() {
  local p="$1" name; name="$(basename "$p")"
  [ -f "$p" ] || { log "missing patch $name"; return 0; }
  if git -C "$DEST" apply --reverse --check "$p" >/dev/null 2>&1; then
    log "already applied: $name"
  elif git -C "$DEST" apply --check "$p" >/dev/null 2>&1; then
    git -C "$DEST" apply "$p" && log "applied: $name"
  else
    log "WARN: skipped $name (conflict or upstream changed)"
  fi
}
apply_patch "$PATCHES/0001-obsidian-ingest.patch"
apply_patch "$PATCHES/0002-chroma-batching.patch"

log "verifying bookrag CLI (first run resolves Python deps, may take a minute)…"
if ( cd "$DEST" && uv run bookrag --help >/dev/null 2>&1 ); then
  log "OK: bookrag ready at $DEST ($PINNED_SHA + local patches)"
else
  log "ERROR: 'uv run bookrag --help' failed in $DEST"; exit 1
fi
echo "$DEST"
