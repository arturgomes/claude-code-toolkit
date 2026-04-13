#!/usr/bin/env bash
#
# migrate-task-memory.sh — One-time migration from task-memory to session-memory
#
# Converts ~/.claude/memory/<TICKET>/<BRANCH>.md files to Obsidian vault format
# with frontmatter, moves to ~/Documents/Obsidian-Vault/02-Notes/Sessions/,
# and builds FTS5 index for all sessions.
#
# Usage:
#   ./migrate-task-memory.sh --dry-run    # Preview without changes
#   ./migrate-task-memory.sh --execute    # Run migration

set -euo pipefail

MEMORY_DIR="$HOME/.claude/memory"
VAULT_DIR="$HOME/Documents/Obsidian-Vault/02-Notes/Sessions"
INDEXER="$(dirname "$0")/session_indexer.py"
BACKUP_FILE="$HOME/.claude/memory-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

DRY_RUN=0

# Parse arguments
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=1
    echo "🔍 DRY RUN MODE — No changes will be made"
    echo
elif [[ "${1:-}" == "--execute" ]]; then
    echo "⚠️  MIGRATION MODE — Files will be modified and moved"
    echo
else
    echo "Usage: $0 {--dry-run|--execute}"
    echo
    echo "  --dry-run    Preview migration without making changes"
    echo "  --execute    Run migration (creates backup first)"
    exit 1
fi

# Check prerequisites
if [[ ! -d "$MEMORY_DIR" ]]; then
    echo "❌ Error: Memory directory not found: $MEMORY_DIR"
    exit 1
fi

if [[ ! -d "$VAULT_DIR" ]]; then
    echo "📁 Creating vault sessions directory: $VAULT_DIR"
    if [[ $DRY_RUN -eq 0 ]]; then
        mkdir -p "$VAULT_DIR"
    fi
fi

if [[ ! -f "$INDEXER" ]]; then
    echo "❌ Error: Indexer script not found: $INDEXER"
    exit 1
fi

# Backup existing memory (execute mode only)
if [[ $DRY_RUN -eq 0 ]]; then
    echo "📦 Creating backup: $BACKUP_FILE"
    tar -czf "$BACKUP_FILE" -C "$HOME/.claude" memory/
    echo "✅ Backup created: $BACKUP_FILE"
    echo
fi

# Find all session files
SESSION_FILES=$(find "$MEMORY_DIR" -name "*.md" -type f 2>/dev/null || true)

if [[ -z "$SESSION_FILES" ]]; then
    echo "ℹ️  No session files found to migrate"
    exit 0
fi

FILE_COUNT=$(echo "$SESSION_FILES" | wc -l | tr -d ' ')
echo "📊 Found $FILE_COUNT session files to migrate"
echo

# Process each file
MIGRATED=0
SKIPPED=0

while IFS= read -r FILE_PATH; do
    # Extract ticket and branch from path
    # Path format: ~/.claude/memory/TICKET/BRANCH.md
    RELATIVE_PATH="${FILE_PATH#$MEMORY_DIR/}"
    TICKET=$(dirname "$RELATIVE_PATH")
    BRANCH=$(basename "$RELATIVE_PATH" .md)

    # Build vault filename: TICKET-BRANCH.md
    VAULT_FILE="$VAULT_DIR/${TICKET}-${BRANCH}.md"

    echo "🔄 Processing: $TICKET / $BRANCH"

    # Read original content
    ORIGINAL_CONTENT=$(<"$FILE_PATH")

    # Check if file already has frontmatter
    if [[ "$ORIGINAL_CONTENT" =~ ^--- ]]; then
        echo "   ⏭️  Already has frontmatter, skipping"
        ((SKIPPED++))
        continue
    fi

    # Extract creation date from first line if present
    if [[ "$ORIGINAL_CONTENT" =~ Created:\ ([0-9-T:Z]+) ]]; then
        CREATED_DATE="${BASH_REMATCH[1]%%T*}"  # Extract YYYY-MM-DD
    else
        CREATED_DATE=$(date +%Y-%m-%d)
    fi

    # Build new content with frontmatter
    NEW_CONTENT="---
title: \"Session: $TICKET / $BRANCH\"
ticket: $TICKET
branch: $BRANCH
date: $CREATED_DATE
type: session-memory
phase: implementation
keywords: []
tags: [#session, #$TICKET]
---

$ORIGINAL_CONTENT"

    if [[ $DRY_RUN -eq 1 ]]; then
        echo "   [DRY RUN] Would create: $VAULT_FILE"
        ((MIGRATED++))
    else
        # Write to vault
        echo "$NEW_CONTENT" > "$VAULT_FILE"
        echo "   ✅ Migrated to: $VAULT_FILE"

        # Extract keywords and update frontmatter
        python3 "$INDEXER" --extract-keywords "$VAULT_FILE" 2>/dev/null || true

        # Index session
        python3 "$INDEXER" --index-session "$VAULT_FILE" 2>/dev/null || true

        ((MIGRATED++))
    fi

done <<< "$SESSION_FILES"

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Migration Summary:"
echo "   Files found:    $FILE_COUNT"
echo "   Migrated:       $MIGRATED"
echo "   Skipped:        $SKIPPED"

if [[ $DRY_RUN -eq 0 ]]; then
    echo "   Backup:         $BACKUP_FILE"
    echo
    echo "✅ Migration complete!"
    echo
    echo "Next steps:"
    echo "   1. Verify migrated files in: $VAULT_DIR"
    echo "   2. Test search: python3 $INDEXER --search \"keyword\""
    echo "   3. If all looks good, you can remove: $MEMORY_DIR"
    echo "      (Backup is preserved: $BACKUP_FILE)"
else
    echo
    echo "ℹ️  This was a DRY RUN. No changes were made."
    echo "   Run with --execute to perform migration."
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
