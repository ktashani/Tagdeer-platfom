-- ============================================================
-- HOTFIX: Fix Merchant Tier Upgrade Constraints
--
-- Root Cause: subscriptions_tier_check only allows ('Pro','Enterprise')
-- but admin can create dynamic tier names. Also missing UNIQUE on
-- profile_id needed for client-side upsert.
--
-- Also fixes transactions_requested_tier_check which only allowed
-- legacy tier names.
-- ============================================================

-- 1. Drop hardcoded tier constraint on subscriptions
--    Tier names are now admin-configurable via subscription_tiers table.
ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

-- 2. Drop hardcoded requested_tier constraint on transactions
ALTER TABLE public.transactions
    DROP CONSTRAINT IF EXISTS transactions_requested_tier_check;

-- 3. Add UNIQUE constraint on profile_id for subscriptions
--    Enables: supabase.from('subscriptions').upsert({...}, { onConflict: 'profile_id' })
--    First, clean up any duplicate rows (keep the most recent one per profile_id)
DELETE FROM public.subscriptions a
USING public.subscriptions b
WHERE a.profile_id = b.profile_id
  AND a.profile_id IS NOT NULL
  AND a.id < b.id;

-- Now add the UNIQUE constraint
ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_profile_id_unique;
ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_profile_id_unique UNIQUE (profile_id);
