# Supabase Migrations

## Current State
- **67 migrations** accumulated from initial development through Sprint 2.
- All migrations are idempotent where possible (using `IF NOT EXISTS`, `CREATE OR REPLACE`).

## Squash Policy
When migration count exceeds 80, the Lead Architect will run `scripts/squash-migrations.sh` to consolidate into a baseline.

## Rules for New Migrations
1. **Naming:** `YYYYMMDD_short_description.sql` (e.g., `20260311_gader_points_atomic.sql`)
2. **Idempotency:** Use `CREATE OR REPLACE` for functions, `IF NOT EXISTS` for tables/indexes.
3. **Testing:** Run `supabase db reset` locally before submitting.
4. **Never modify** an existing migration that has been deployed to staging/production.
