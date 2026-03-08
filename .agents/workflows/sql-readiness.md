---
description: Pre-deployment SQL readiness check before merging features to production
---

# SQL Readiness Before Production Deploy

// turbo-all

## Purpose
The agent MUST proactively lead SQL alignment before any merge from staging to production. This is not optional — the agent should never ask the user if SQL has been applied; instead, the agent should determine what's needed and provide exact instructions.

## Trigger
This workflow activates automatically when:
- The user says "deploy to production", "merge to main", "push to production", or similar
- A branch is about to be merged to `main` or `production`
- The user asks to release or go live

## Steps

1. **Scan all SQL migrations** in `supabase/migrations/`:
```bash
ls -la supabase/migrations/
```

2. **Cross-reference with current branch changes** — determine which migrations are required by the code being deployed. A migration is required if:
   - The code references new tables, columns, or constraints created by that migration
   - The migration was created during the same feature branch

3. **Generate a production SQL readiness report** — present the user with:

> ## 🔒 SQL Readiness Report — Production
>
> The following SQL migrations **MUST** be applied to the **production** Supabase project before deploying this code:
>
> | # | Migration | Required | Action |
> |---|---|---|---|
> | 1 | `migration_name.sql` | ✅ Required | Copy SQL below and run in **Supabase SQL Editor (Production)** |
> | 2 | `other_migration.sql` | ⏭️ Optional | Not needed until Phase X front-end is implemented |
>
> ### SQL to Run (copy & paste into Supabase SQL Editor):
> ```sql
> -- Paste the full contents of each required migration here
> ```

4. **Block the merge** until the user confirms the SQL has been run:
> ⛔ **Merge blocked.** Please confirm you have run the above SQL on production, then I will proceed with the merge.

5. **After user confirms**, proceed with the git merge/deploy.

## Key Rules
- **Agent leads, user executes** — the agent determines what's needed, the user runs SQL manually
- **Never auto-run SQL** against production
- **Always provide the full SQL** inline so the user can copy-paste without hunting for files
- **Mark optional migrations** — if code doesn't depend on a migration yet, mark it optional
- **Run in chronological order** by filename date prefix
- **Idempotent** — all migrations use `IF NOT EXISTS` / `IF EXISTS` so re-running is safe

## Current Migration Registry
| File | Phase | Required By |
|---|---|---|
| `20260308_voting_integrity.sql` | Phase 2 | Voting system (log_votes constraints, score trigger) |
| `20260308_ribbons_promotions_addons.sql` | Phases C/D/E | Ribbon front-end, promotion system, addon economy |
