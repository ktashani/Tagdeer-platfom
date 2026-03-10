#!/bin/bash
# ============================================================
# Migration Squash Script — TO BE RUN BY LEAD ARCHITECT ONLY
# This script is documentation, not automation.
# ============================================================

set -euo pipefail

echo "⚠️  This script squashes all migrations into a single baseline."
echo "    Run this ONLY on a clean staging environment."
echo "    Press Ctrl+C to abort, or Enter to continue."
read

# Step 1: Generate current schema snapshot
echo "📸 Dumping current schema..."
supabase db dump --local > supabase/migrations/00000000000000_baseline.sql

# Step 2: Archive old migrations
echo "📦 Archiving old migrations..."
mkdir -p supabase/migrations/_archive
for f in supabase/migrations/202*.sql; do
    [ "$f" = "supabase/migrations/00000000000000_baseline.sql" ] && continue
    mv "$f" supabase/migrations/_archive/
done

# Step 3: Verify
echo "🧪 Testing schema from baseline..."
supabase db reset

echo "✅ Squash complete. Verify the schema, then commit."
