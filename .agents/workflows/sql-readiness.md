---
description: Pre-deployment SQL readiness check before merging features to production
---

# SQL Readiness Before Production Deploy

// turbo-all

## When to Use
Before merging any branch to `main` or deploying to production, verify that any required SQL migrations have been executed on the production database.

## Steps

1. **Check for pending SQL migrations** in the `supabase/migrations/` directory:
```bash
ls -la supabase/migrations/
```

2. **Compare staging vs production** — Verify that each migration file has been run on the production Supabase instance. Ask the user:
> ⚠️ **SQL Readiness Check**: The following migrations exist. Please confirm which ones have been applied to **production**:
> - List each `.sql` file with a short summary

3. **If any migration is NOT applied to production**, alert the user:
> 🛑 **BLOCKED**: Cannot deploy to production until the following SQL migrations are applied:
> - [list missing migrations]
>
> Please run them in the **Supabase SQL Editor** (production project) before proceeding.

4. **Never auto-run SQL** — SQL must be manually applied by the user via the Supabase SQL Editor. The agent must never execute SQL directly against production.

5. **After confirmation**, proceed with the merge/deploy.

## Key Rules
- **Staging**: SQL can be run at any time during development.
- **Production**: SQL must be run BEFORE deploying the code that depends on it.
- **Idempotent**: All migrations use `IF NOT EXISTS` / `IF EXISTS` so they are safe to re-run.
- **Order matters**: Run migrations in chronological order (by filename date prefix).

## Current Migration Files
| File | Purpose | Tables/Columns |
|---|---|---|
| `20260308_voting_integrity.sql` | Phase 2 voting rules | `log_votes` constraints, score trigger |
| `20260308_ribbons_promotions_addons.sql` | Phases C/D/E | `business_ribbons`, promotion cols, addon economy cols |
