-- ==========================================
-- Phase 1 Migration: Coupon & Campaign Engine v2
-- ==========================================

-- 1. DROP obsolete ghost tables (Safely)
DROP TABLE IF EXISTS public.platform_coupon_pools CASCADE;
DROP TABLE IF EXISTS public.platform_campaigns CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;

-- 2. EVOLVE merchant_coupons table
ALTER TABLE public.merchant_coupons
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS target_tier TEXT DEFAULT 'ALL'
    CHECK (target_tier IN ('ALL','BRONZE_ONLY','SILVER_ONLY','GOLD_ONLY','VIP_ONLY')),
  ADD COLUMN IF NOT EXISTS claimed_count INTEGER DEFAULT 0;

-- Rename distribution_rule values
UPDATE public.merchant_coupons SET distribution_rule = 'PUBLIC_POOL' WHERE distribution_rule = 'quota_pool';
UPDATE public.merchant_coupons SET distribution_rule = 'VIP_SCAN' WHERE distribution_rule = 'physical_scan';
UPDATE public.merchant_coupons SET distribution_rule = 'RESOLUTION_ONLY' WHERE distribution_rule = 'resolution_only';

-- Update constraint for distribution_rule
ALTER TABLE public.merchant_coupons DROP CONSTRAINT IF EXISTS merchant_coupons_distribution_rule_check;
ALTER TABLE public.merchant_coupons ADD CONSTRAINT merchant_coupons_distribution_rule_check
  CHECK (distribution_rule IN ('PUBLIC_POOL', 'VIP_SCAN', 'RESOLUTION_ONLY'));

-- 3. CREATE user_coupons (The newly designed Wallet system)
CREATE TABLE IF NOT EXISTS public.user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.merchant_coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  serial_code TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('POOL', 'VIP_SCAN', 'RESOLUTION')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LOCKED','REDEEMED','EXPIRED','VOID')),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  redemption_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_coupons_user ON public.user_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_campaign ON public.user_coupons(campaign_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_status ON public.user_coupons(status);
CREATE INDEX IF NOT EXISTS idx_user_coupons_expiry ON public.user_coupons(valid_until) WHERE status = 'ACTIVE';

-- RLS for user_coupons
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coupons"
  ON public.user_coupons FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Merchants can view coupons from their campaigns"
  ON public.user_coupons FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM public.merchant_coupons WHERE created_by = auth.uid()
    )
  );

-- 4. EVOLVE subscriptions
UPDATE public.subscriptions SET tier = 'Pro' WHERE tier = 'Tier 1';
UPDATE public.subscriptions SET tier = 'Enterprise' WHERE tier = 'Tier 2';

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_tier_check CHECK (tier IN ('Pro', 'Enterprise'));

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_months INTEGER DEFAULT 0;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false;

-- 5. ADD Log Meter + Wallet Eligibility to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_log_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_log_reset_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS total_coupons_earned INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_difficulty_level INTEGER DEFAULT 1;

-- 6. CREATE enforce_campaign_immutability() trigger
CREATE OR REPLACE FUNCTION enforce_campaign_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'active' AND (
    NEW.offer_type != OLD.offer_type OR
    NEW.discount_value != OLD.discount_value OR
    (NEW.item_name IS DISTINCT FROM OLD.item_name) OR
    NEW.initial_quantity < OLD.claimed_count
  ) THEN
    RAISE EXCEPTION 'Cannot modify offer details or reduce inventory below claimed count on active campaigns';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_campaign_immutability ON public.merchant_coupons;
CREATE TRIGGER trg_enforce_campaign_immutability
  BEFORE UPDATE ON public.merchant_coupons
  FOR EACH ROW
  EXECUTE FUNCTION enforce_campaign_immutability();

