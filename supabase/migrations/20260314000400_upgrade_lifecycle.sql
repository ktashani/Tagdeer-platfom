-- ==========================================
-- Sprint 6: Upgrade Lifecycle Columns
-- ==========================================

-- Expand subscription status to include pending payment and other states
ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('Active', 'Expiring Soon', 'Expired', 'Suspended', 'Terminated', 'Pending Payment'));

-- Add upgrade tracking to transactions
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS upgrade_from_tier TEXT;

-- Expand requested_tier to accept shield addons and Free tier
ALTER TABLE public.transactions
    DROP CONSTRAINT IF EXISTS transactions_requested_tier_check;
ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_requested_tier_check
    CHECK (requested_tier IN ('Tier 1', 'Tier 2', 'Free', 'Trust Shield Addon', 'Fatora Shield Addon'));
