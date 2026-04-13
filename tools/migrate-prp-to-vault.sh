#!/bin/bash
# migrate-prp-to-vault.sh
# Migrate PRP files from .claude/PRPs to Obsidian vault

set -euo pipefail

VAULT_BASE="$HOME/Documents/Obsidian-Vault/07-PRPs-Claude-Code-Toolkit"
DRY_RUN=true

# Parse arguments
if [[ "${1:-}" == "--execute" ]]; then
    DRY_RUN=false
fi

# Function to add frontmatter to a file
add_frontmatter() {
    local file="$1"
    local dest="$2"
    local file_type="$3"  # "plan" or "report"
    local filename=$(basename "$file" .md)
    local title="${filename%.plan}"
    title="${title%-report}"
    local created=$(stat -f "%Sm" -t "%Y-%m-%d" "$file" 2>/dev/null || date +%Y-%m-%d)

    # Determine status based on directory
    local status="active"
    if [[ "$file" == */completed/* ]]; then
        status="completed"
    fi

    # Extract plan name for reports (wikilink)
    local plan_link=""
    if [[ "$file_type" == "report" ]]; then
        plan_link="plan: \"[[${title}]]\""
    fi

    # Check if file already has frontmatter
    if head -1 "$file" | grep -q "^---$"; then
        echo "  ⚠️  File already has frontmatter, copying as-is: $(basename "$file")"
        if [[ "$DRY_RUN" == false ]]; then
            cp "$file" "$dest"
        fi
        return
    fi

    # Create frontmatter
    local frontmatter="---
title: $title
created: $created
source: .claude/PRPs (migrated)
project: claude-code-toolkit
tags:
  - prp
  - claude-code-toolkit
  - $file_type
status: $status"

    if [[ -n "$plan_link" ]]; then
        frontmatter="$frontmatter
$plan_link"
    fi

    frontmatter="$frontmatter
---

"

    # Combine frontmatter with original content
    if [[ "$DRY_RUN" == false ]]; then
        {
            echo "$frontmatter"
            cat "$file"
        } > "$dest"
        echo "  ✅ Migrated with frontmatter: $(basename "$file")"
    else
        echo "  [DRY-RUN] Would migrate with frontmatter: $(basename "$file")"
    fi
}

# Function to migrate from a source directory
migrate_prps() {
    local source_base="$1"
    local project_name="$2"

    if [[ ! -d "$source_base" ]]; then
        echo "⚠️  Skipping $project_name (not found: $source_base)"
        return
    fi

    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "Migrating: $project_name"
    echo "Source: $source_base"
    echo "═══════════════════════════════════════════════════"

    # Migrate active plans
    if [[ -d "$source_base/plans" ]]; then
        echo ""
        echo "📋 Active Plans:"
        for plan in "$source_base/plans"/*.md 2>/dev/null || true; do
            [[ -f "$plan" ]] || continue
            dest="$VAULT_BASE/plans/$(basename "$plan")"
            add_frontmatter "$plan" "$dest" "plan"
        done
    fi

    # Migrate completed plans
    if [[ -d "$source_base/plans/completed" ]]; then
        echo ""
        echo "✅ Completed Plans:"
        for plan in "$source_base/plans/completed"/*.md 2>/dev/null || true; do
            [[ -f "$plan" ]] || continue
            dest="$VAULT_BASE/plans/completed/$(basename "$plan")"
            add_frontmatter "$plan" "$dest" "plan"
        done
    fi

    # Migrate reports
    if [[ -d "$source_base/reports" ]]; then
        echo ""
        echo "📊 Reports:"
        for report in "$source_base/reports"/*.md 2>/dev/null || true; do
            [[ -f "$report" ]] || continue
            dest="$VAULT_BASE/reports/$(basename "$report")"
            add_frontmatter "$report" "$dest" "report"
        done
    fi
}

# Main execution
echo "═══════════════════════════════════════════════════"
echo "PRP Migration to Obsidian Vault"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Mode: $(if [[ "$DRY_RUN" == true ]]; then echo "DRY RUN (use --execute to apply)"; else echo "EXECUTE"; fi)"
echo "Vault: $VAULT_BASE"
echo ""

# Create vault directories if executing
if [[ "$DRY_RUN" == false ]]; then
    mkdir -p "$VAULT_BASE/plans/completed"
    mkdir -p "$VAULT_BASE/reports"
    echo "✅ Vault directories created"
fi

# Migrate from claude-code-toolkit
migrate_prps "/Users/artur/Documents/ai-tools/claude-code-toolkit/.claude/PRPs" "claude-code-toolkit"

# Migrate from memory-central (note: some files may already be in vault)
migrate_prps "/Users/artur/Documents/ai-tools/memory-central/.claude/PRPs" "memory-central"

echo ""
echo "═══════════════════════════════════════════════════"
echo "Migration Summary"
echo "═══════════════════════════════════════════════════"

if [[ "$DRY_RUN" == true ]]; then
    echo ""
    echo "✅ Dry run complete. Review above and run with --execute to apply."
else
    echo ""
    echo "✅ Migration complete!"
    echo ""
    echo "File counts:"
    echo "  Plans (active):   $(find "$VAULT_BASE/plans" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | xargs)"
    echo "  Plans (completed): $(find "$VAULT_BASE/plans/completed" -name "*.md" 2>/dev/null | wc -l | xargs)"
    echo "  Reports:          $(find "$VAULT_BASE/reports" -name "*.md" 2>/dev/null | wc -l | xargs)"
    echo ""
    echo "Next steps:"
    echo "  1. Review migrated files in $VAULT_BASE"
    echo "  2. Open Obsidian and verify frontmatter renders correctly"
    echo "  3. Create README index with wikilinks"
fi
