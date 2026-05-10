-- ==========================================
-- Phase 2 Backend Logic: Additional RPCs
-- ==========================================

-- 1. Helper function used by the edge function to decrement claims
CREATE OR REPLACE FUNCTION decrement_campaign_claimed_count(p_campaign_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.merchant_coupons
    SET claimed_count = GREATEST(claimed_count - 1, 0)
    WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Enforce Subscription Limits on Campaign Creation (Phase 2.6)
CREATE OR REPLACE FUNCTION enforce_subscription_campaign_limits(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_merchant_id UUID;
    v_active_campaigns INTEGER;
    v_sub_tier TEXT;
BEGIN
    -- Get the merchant who claimed the business
    SELECT claimed_by INTO v_merchant_id FROM public.businesses WHERE id = p_business_id;
    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Business not claimed');
    END IF;

    -- Get merchant's subscription tier
    SELECT tier INTO v_sub_tier FROM public.subscriptions WHERE profile_id = v_merchant_id AND status IN ('Active', 'Expiring Soon', 'Grace Period');
    v_sub_tier := COALESCE(v_sub_tier, 'Free'); -- Default to Free if no active sub

    -- Count their active campaigns
    SELECT COUNT(*) INTO v_active_campaigns
    FROM public.merchant_coupons
    WHERE business_id = p_business_id AND status = 'active';

    -- Apply Tier Logic 
    -- Free: 0 active loyalty campaigns allowed
    -- Pro (Tier 1): 1 active campaign
    -- Enterprise (Tier 2): Unlimited
    
    IF v_sub_tier = 'Free' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Free tier merchants cannot create loyalty campaigns. Please upgrade to Pro.');
    END IF;

    IF v_sub_tier = 'Pro' AND v_active_campaigns >= 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pro tier merchants are limited to 1 active loyalty campaign per business. Please pause your current campaign or upgrade to Enterprise.');
    END IF;

    -- Enterprise or valid Pro allowed
    RETURN jsonb_build_object('success', true);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Scan Points RPC with Anti-Fraud (Phase 2.7)
CREATE OR REPLACE FUNCTION award_scan_points(p_user_id UUID, p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_interactions_today INTEGER;
    v_same_business_today INTEGER;
    v_sub_tier TEXT;
    v_merchant_id UUID;
    v_pts_to_award INTEGER;
    v_must_give_coupon BOOLEAN := false;
BEGIN
    -- Get the merchant who claimed the business
    SELECT claimed_by INTO v_merchant_id FROM public.businesses WHERE id = p_business_id;

    -- 1. Anti-Fraud Rule A: 24h per-business limit
    SELECT COUNT(*) INTO v_same_business_today
    FROM public.business_interactions
    WHERE profile_id = p_user_id 
      AND business_id = p_business_id 
      AND created_at > (NOW() - INTERVAL '24 hours');

    IF v_same_business_today > 0 THEN
         RETURN jsonb_build_object('success', false, 'error', 'You have already scanned this business today.');
    END IF;

    -- 2. Anti-Fraud Rule B: 1/day cap across all businesses
    SELECT COUNT(*) INTO v_interactions_today
    FROM public.business_interactions
    WHERE profile_id = p_user_id 
      AND created_at > (NOW() - INTERVAL '24 hours');
      
    IF v_interactions_today >= 1 THEN
         RETURN jsonb_build_object('success', false, 'error', 'You have reached your daily maximum of 1 scan.');
    END IF;

    -- 3. Determine points based on business tier
    SELECT tier INTO v_sub_tier FROM public.subscriptions WHERE profile_id = v_merchant_id AND status IN ('Active', 'Expiring Soon', 'Grace Period');
    v_sub_tier := COALESCE(v_sub_tier, 'Free');
    
    IF v_sub_tier = 'Enterprise' THEN
        v_pts_to_award := 30;
        v_must_give_coupon := true;
    ELSIF v_sub_tier = 'Pro' THEN
        v_pts_to_award := 15;
    ELSE
        v_pts_to_award := 5; -- Free tier
    END IF;

    -- 4. Insert scan record
    INSERT INTO public.business_interactions (business_id, profile_id, interaction_type)
    VALUES (p_business_id, p_user_id, 'scan');

    -- 5. Give points to user
    UPDATE public.profiles
    SET gader_points = COALESCE(gader_points, 0) + v_pts_to_award
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'points_awarded', v_pts_to_award, 
        'business_tier', v_sub_tier,
        'must_receive_coupon', v_must_give_coupon
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PHASE 2 RPCs COMBINED
-- ==========================================
-- ==========================================
-- Phase 2 Backend Logic: RPCs and Distribution
-- ==========================================

-- 1. Helper function to check if user needs to be reset
-- Assuming weekly_log_reset_at is tracked

-- 2. Distribute Coupon RPC
CREATE OR REPLACE FUNCTION distribute_coupon_on_quota(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_record RECORD;
    v_threshold INTEGER;
    v_selected_campaign_id UUID;
    v_serial TEXT;
    v_valid_until TIMESTAMPTZ;
BEGIN
    -- 1. Get user data
    SELECT * INTO v_user_record FROM public.profiles WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- 2. Eligibility checks
    IF v_user_record.gader_points < 50 OR v_user_record.status != 'Active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not eligible');
    END IF;

    -- 3. Calculate Threshold (Base 3 + difficulty * 1)
    v_threshold := 3 + COALESCE(v_user_record.coupon_difficulty_level, 1);

    -- 4. Check if quota met
    IF v_user_record.weekly_log_count < v_threshold THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quota not met', 'current', v_user_record.weekly_log_count, 'required', v_threshold);
    END IF;

    -- 5. Find a campaign
    -- This logic looks for:
    -- active status, PUBLIC_POOL, claimed < initial, user hasn't logged the business in 30 days
    -- For MVP simplicity in SQL, we just grab a random valid one
    SELECT mc.id INTO v_selected_campaign_id
    FROM public.merchant_coupons mc
    JOIN public.businesses b ON b.id = mc.business_id
    WHERE mc.status = 'active'
      AND mc.distribution_rule = 'PUBLIC_POOL'
      AND mc.claimed_count < mc.initial_quantity
      AND NOT EXISTS (
          SELECT 1 FROM public.logs l 
          WHERE l.business_id = mc.business_id 
            AND l.profile_id = p_user_id 
            AND l.created_at > NOW() - INTERVAL '30 days'
      )
    ORDER BY random()
    LIMIT 1;

    -- Fallback if no undiscovered campaign exists
    IF v_selected_campaign_id IS NULL THEN
        SELECT mc.id INTO v_selected_campaign_id
        FROM public.merchant_coupons mc
        WHERE mc.status = 'active'
          AND mc.distribution_rule = 'PUBLIC_POOL'
          AND mc.claimed_count < mc.initial_quantity
        ORDER BY random()
        LIMIT 1;
    END IF;

    IF v_selected_campaign_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No pools available');
    END IF;

    -- 6. Generate Serial (Basic random in SQL for safety, though frontend lib exists too)
    -- Format: TAG-POOL-XXXXXX
    v_serial := 'TAG-POL-' || upper(substring(md5(random()::text) from 1 for 6));

    -- 7. Calculate valid_until (e.g. 7 days from now)
    v_valid_until := NOW() + INTERVAL '7 days';

    -- 8. Atomic Insert & Update
    INSERT INTO public.user_coupons (
        campaign_id, user_id, serial_code, source, valid_until
    ) VALUES (
        v_selected_campaign_id, p_user_id, v_serial, 'POOL', v_valid_until
    );

    UPDATE public.merchant_coupons
    SET claimed_count = claimed_count + 1
    WHERE id = v_selected_campaign_id;

    UPDATE public.profiles
    SET weekly_log_count = 0,
        total_coupons_earned = COALESCE(total_coupons_earned, 0) + 1,
        coupon_difficulty_level = COALESCE(coupon_difficulty_level, 1) + 1
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true, 'serial', v_serial, 'campaign_id', v_selected_campaign_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- Phase 2 Backend Logic: Redeem Coupon RPC
-- ==========================================

CREATE OR REPLACE FUNCTION redeem_coupon(p_serial_code TEXT, p_merchant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_coupon_record RECORD;
    v_campaign_record RECORD;
    v_user_record RECORD;
    v_hot_coupon BOOLEAN;
    v_pts_awarded INTEGER := 0;
BEGIN
    -- 1. Get coupon by serial
    SELECT * INTO v_coupon_record 
    FROM public.user_coupons 
    WHERE serial_code = p_serial_code AND status = 'ACTIVE';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive coupon');
    END IF;

    -- 2. Check Expiry
    IF v_coupon_record.valid_until < NOW() THEN
        UPDATE public.user_coupons SET status = 'EXPIRED' WHERE id = v_coupon_record.id;
        RETURN jsonb_build_object('success', false, 'error', 'Coupon has expired');
    END IF;

    -- 3. Check Campaign matches Merchant
    SELECT * INTO v_campaign_record 
    FROM public.merchant_coupons 
    WHERE id = v_coupon_record.campaign_id;
    
    -- In Tagdeer, the merchant scanning must own the campaign
    -- Support Team feature later by checking business access
    IF v_campaign_record.created_by != p_merchant_id THEN
        -- TODO: Implement team check here if team members are separate from created_by
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized scanner: Merchant does not own this campaign');
    END IF;

    -- 4. Check Self-Redemption Anti-Fraud
    IF v_coupon_record.user_id = p_merchant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Fraud Prevention: Merchants cannot redeem their own coupons');
    END IF;

    -- 5. Hot Coupon Logic (Redeemed within 48h = 1.5x points)
    v_hot_coupon := (NOW() - v_coupon_record.generated_at) <= INTERVAL '48 hours';
    IF v_hot_coupon THEN
        v_pts_awarded := 15; -- Example bonus points
    ELSE
        v_pts_awarded := 10; -- Standard points
    END IF;

    -- 6. Update User Wallet
    UPDATE public.user_coupons
    SET status = 'REDEEMED',
        redeemed_at = NOW(),
        redemption_metadata = jsonb_build_object('scanned_by', p_merchant_id, 'hot_coupon', v_hot_coupon, 'points_awarded', v_pts_awarded)
    WHERE id = v_coupon_record.id;

    -- 7. Add Points to User (Profile Update)
    UPDATE public.profiles
    SET gader_points = COALESCE(gader_points, 0) + v_pts_awarded
    WHERE id = v_coupon_record.user_id;

    RETURN jsonb_build_object('success', true, 'points_awarded', v_pts_awarded, 'hot_coupon', v_hot_coupon);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- Phase 2 Backend Logic: Additional RPCs
-- ==========================================

-- 1. Helper function used by the edge function to decrement claims
CREATE OR REPLACE FUNCTION decrement_campaign_claimed_count(p_campaign_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.merchant_coupons
    SET claimed_count = GREATEST(claimed_count - 1, 0)
    WHERE id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Enforce Subscription Limits on Campaign Creation (Phase 2.6)
CREATE OR REPLACE FUNCTION enforce_subscription_campaign_limits(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_merchant_id UUID;
    v_active_campaigns INTEGER;
    v_sub_tier TEXT;
BEGIN
    -- Get the merchant who claimed the business
    SELECT claimed_by INTO v_merchant_id FROM public.businesses WHERE id = p_business_id;
    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Business not claimed');
    END IF;

    -- Get merchant's subscription tier
    SELECT tier INTO v_sub_tier FROM public.subscriptions WHERE profile_id = v_merchant_id AND status IN ('Active', 'Expiring Soon', 'Grace Period');
    v_sub_tier := COALESCE(v_sub_tier, 'Free'); -- Default to Free if no active sub

    -- Count their active campaigns
    SELECT COUNT(*) INTO v_active_campaigns
    FROM public.merchant_coupons
    WHERE business_id = p_business_id AND status = 'active';

    -- Apply Tier Logic 
    -- Free: 0 active loyalty campaigns allowed
    -- Pro (Tier 1): 1 active campaign
    -- Enterprise (Tier 2): Unlimited
    
    IF v_sub_tier = 'Free' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Free tier merchants cannot create loyalty campaigns. Please upgrade to Pro.');
    END IF;

    IF v_sub_tier = 'Pro' AND v_active_campaigns >= 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pro tier merchants are limited to 1 active loyalty campaign per business. Please pause your current campaign or upgrade to Enterprise.');
    END IF;

    -- Enterprise or valid Pro allowed
    RETURN jsonb_build_object('success', true);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Scan Points RPC with Anti-Fraud (Phase 2.7)
CREATE OR REPLACE FUNCTION award_scan_points(p_user_id UUID, p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_interactions_today INTEGER;
    v_same_business_today INTEGER;
    v_sub_tier TEXT;
    v_merchant_id UUID;
    v_pts_to_award INTEGER;
    v_must_give_coupon BOOLEAN := false;
BEGIN
    -- Get the merchant who claimed the business
    SELECT claimed_by INTO v_merchant_id FROM public.businesses WHERE id = p_business_id;

    -- 1. Anti-Fraud Rule A: 24h per-business limit
    SELECT COUNT(*) INTO v_same_business_today
    FROM public.business_interactions
    WHERE profile_id = p_user_id 
      AND business_id = p_business_id 
      AND created_at > (NOW() - INTERVAL '24 hours');

    IF v_same_business_today > 0 THEN
         RETURN jsonb_build_object('success', false, 'error', 'You have already scanned this business today.');
    END IF;

    -- 2. Anti-Fraud Rule B: 1/day cap across all businesses
    SELECT COUNT(*) INTO v_interactions_today
    FROM public.business_interactions
    WHERE profile_id = p_user_id 
      AND created_at > (NOW() - INTERVAL '24 hours');
      
    IF v_interactions_today >= 1 THEN
         RETURN jsonb_build_object('success', false, 'error', 'You have reached your daily maximum of 1 scan.');
    END IF;

    -- 3. Determine points based on business tier
    SELECT tier INTO v_sub_tier FROM public.subscriptions WHERE profile_id = v_merchant_id AND status IN ('Active', 'Expiring Soon', 'Grace Period');
    v_sub_tier := COALESCE(v_sub_tier, 'Free');
    
    IF v_sub_tier = 'Enterprise' THEN
        v_pts_to_award := 30;
        v_must_give_coupon := true;
    ELSIF v_sub_tier = 'Pro' THEN
        v_pts_to_award := 15;
    ELSE
        v_pts_to_award := 5; -- Free tier
    END IF;

    -- 4. Insert scan record
    INSERT INTO public.business_interactions (business_id, profile_id, interaction_type)
    VALUES (p_business_id, p_user_id, 'scan');

    -- 5. Give points to user
    UPDATE public.profiles
    SET gader_points = COALESCE(gader_points, 0) + v_pts_to_award
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'points_awarded', v_pts_to_award, 
        'business_tier', v_sub_tier,
        'must_receive_coupon', v_must_give_coupon
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add status column to businesses table for Admin Management
-- Created: 2026-03-05

-- Allow statuses: published, restricted, hidden
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published' CHECK (status IN ('published', 'restricted', 'hidden'));

-- Backfill existing businesses just in case
UPDATE businesses SET status = 'published' WHERE status IS NULL;
-- Migration to add status column to profiles table
-- Created: 2026-03-07

-- 1. Add status column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Restricted', 'Banned'));

-- 2. Update existing profiles to have 'Active' status if they are null
UPDATE public.profiles SET status = 'Active' WHERE status IS NULL;
-- ============================================================
-- Business Contact Details Columns
-- Required by: Discover contact icons, merchant contact editing,
--              admin business detail view
-- ============================================================
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp TEXT,
    ADD COLUMN IF NOT EXISTS instagram TEXT,
    ADD COLUMN IF NOT EXISTS facebook TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

-- Verify:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'businesses' AND column_name IN
-- ('description','phone','whatsapp','instagram','facebook','website','google_maps_url');
-- ============================================================
-- Tagdeer Platform — Phases C/D/E SQL Migration
-- Run in Supabase SQL Editor (staging first, then production)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Phase C: Business Ribbons (Discount Tags / Announcements)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS business_ribbons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    ribbon_type TEXT NOT NULL DEFAULT 'discount',   -- 'discount' | admin adds more later
    label TEXT NOT NULL,                             -- e.g. "50% OFF", "New Menu"
    label_ar TEXT,                                    -- Arabic label
    description TEXT,                                -- hover/click detail: "Online orders only"
    description_ar TEXT,
    color TEXT DEFAULT 'red',                        -- red, green, blue, amber, purple
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,                          -- NULL = no expiry
    is_active BOOLEAN DEFAULT true,
    source TEXT DEFAULT 'merchant',                  -- 'merchant' | 'admin' | 'campaign'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ribbons_business ON business_ribbons(business_id);
CREATE INDEX IF NOT EXISTS idx_ribbons_active ON business_ribbons(is_active, expires_at);

-- RLS: Public can read active ribbons, merchants can manage their own
ALTER TABLE business_ribbons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active ribbons" ON business_ribbons;
CREATE POLICY "Public can view active ribbons"
    ON business_ribbons FOR SELECT
    USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

DROP POLICY IF EXISTS "Merchants can manage own ribbons" ON business_ribbons;
CREATE POLICY "Merchants can manage own ribbons"
    ON business_ribbons FOR ALL
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE claimed_by = auth.uid()
        )
    );


-- ──────────────────────────────────────────────────────────────
-- Phase D: Promotion System (Infrastructure Columns)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS promotion_multiplier INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promoted_until TIMESTAMPTZ;

-- promotion_multiplier: 0 = not promoted, 10/20/30 = show x times more


-- ──────────────────────────────────────────────────────────────
-- Phase E: Addon Economy (Feature Allocation Enhancements)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE feature_allocations
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'tier',       -- 'tier' | 'addon' | 'admin'
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,           -- NULL = follows subscription
    ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ;

-- source logic:
--   'tier'  → auto-granted by subscription tier, deactivated on downgrade
--   'addon' → purchased separately, survives tier downgrade until expires_at
--   'admin' → manually granted by admin


-- ──────────────────────────────────────────────────────────────
-- Campaign Combinability (for free trial campaigns)
-- ──────────────────────────────────────────────────────────────

-- If merchant_campaigns table exists, add combinable flag:
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_campaigns') THEN
        EXECUTE 'ALTER TABLE merchant_campaigns ADD COLUMN IF NOT EXISTS combinable BOOLEAN DEFAULT true';
    END IF;
END $$;

-- Done. Verify with: SELECT * FROM business_ribbons LIMIT 1;
-- ============================================================
-- Phase 2D: log_votes duplicate prevention constraints
-- Phase 2E: Score recalculation trigger on log insert
-- ============================================================
-- Run this in Supabase SQL Editor BEFORE deploying Phase 2 code.
-- These are safe to run multiple times (IF NOT EXISTS clauses).
-- ============================================================

-- ─── 2D: Unique constraints on log_votes ───────────────────
-- Prevents same user from voting twice on the same log entry.
-- NULLS NOT DISTINCT treats NULL profile_id/fingerprint as equal
-- (Postgres 15+). If on Postgres 14, omit NULLS NOT DISTINCT.

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'log_votes_unique_user'
    ) THEN
        ALTER TABLE log_votes
            ADD CONSTRAINT log_votes_unique_user
            UNIQUE NULLS NOT DISTINCT (log_id, profile_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'log_votes_unique_anon'
    ) THEN
        ALTER TABLE log_votes
            ADD CONSTRAINT log_votes_unique_anon
            UNIQUE NULLS NOT DISTINCT (log_id, fingerprint);
    END IF;
END $$;


-- ─── 2E: Score recalculation trigger ───────────────────────
-- When a new log is inserted, recalculate the business's
-- recommends/complains counts. This fires the real-time
-- subscription on the businesses table automatically.

CREATE OR REPLACE FUNCTION recalculate_business_scores()
RETURNS TRIGGER AS $$
DECLARE
    v_recommends INT;
    v_complains INT;
    v_total INT;
    v_display_score NUMERIC;
BEGIN
    -- Count weighted votes
    SELECT
        COALESCE(SUM(CASE WHEN interaction_type = 'recommend' THEN COALESCE(weight, 1) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN interaction_type = 'complain'  THEN COALESCE(weight, 1) ELSE 0 END), 0)
    INTO v_recommends, v_complains
    FROM logs
    WHERE business_id = COALESCE(NEW.business_id, OLD.business_id);

    v_total := v_recommends + v_complains;

    -- Display score: percentage of positive weighted votes (0-100)
    IF v_total > 0 THEN
        v_display_score := ROUND((v_recommends::NUMERIC / v_total) * 100, 1);
    ELSE
        v_display_score := NULL;
    END IF;

    -- Update the business row (this fires real-time subscription)
    UPDATE businesses SET
        recommends = (SELECT COUNT(*) FROM logs WHERE business_id = COALESCE(NEW.business_id, OLD.business_id) AND interaction_type = 'recommend'),
        complains = (SELECT COUNT(*) FROM logs WHERE business_id = COALESCE(NEW.business_id, OLD.business_id) AND interaction_type = 'complain'),
        shadow_score = v_recommends - v_complains,
        display_score = v_display_score
    WHERE id = COALESCE(NEW.business_id, OLD.business_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_recalculate_scores ON logs;

CREATE TRIGGER trg_recalculate_scores
    AFTER INSERT OR DELETE ON logs
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_business_scores();


-- ─── Verify ────────────────────────────────────────────────
-- Run these to confirm everything was created:
SELECT conname FROM pg_constraint WHERE conname LIKE 'log_votes%';
SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'logs';
-- ============================================================
-- Anonymous Vote Tracking
-- Enforces vote limits for unauthenticated users using
-- IP address + device fingerprint hashing.
-- ============================================================

CREATE TABLE IF NOT EXISTS anonymous_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint_hash TEXT NOT NULL,
    ip_address INET,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('recommend', 'complain')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fingerprint lookups (primary limit enforcement)
CREATE INDEX IF NOT EXISTS idx_anon_votes_fingerprint ON anonymous_votes(fingerprint_hash);

-- Index for IP lookups (secondary limit enforcement)
CREATE INDEX IF NOT EXISTS idx_anon_votes_ip ON anonymous_votes(ip_address);

-- Enable RLS (deny all by default — only service role should access this)
ALTER TABLE anonymous_votes ENABLE ROW LEVEL SECURITY;

-- RPC: Check if an anonymous user has exceeded the vote limit.
-- Returns TRUE if the vote is allowed, FALSE if rate-limited.
CREATE OR REPLACE FUNCTION check_anonymous_vote_limit(
    p_fingerprint TEXT,
    p_ip TEXT,
    p_max_votes INTEGER DEFAULT 3,
    p_window_days INTEGER DEFAULT 7
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM anonymous_votes
    WHERE (fingerprint_hash = p_fingerprint OR ip_address = p_ip::INET)
      AND created_at > NOW() - (p_window_days || ' days')::INTERVAL;

    RETURN v_count < p_max_votes;
END;
$$;
-- ============================================================
-- Batch Coupon Expiry Processing
-- Replaces the N+1 loop in the coupon-expiry-cron edge function
-- with a single SQL transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION expire_coupons_batch()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expired_count INTEGER;
    v_returned_count INTEGER;
BEGIN
    -- Step 1: Batch-update all expired user_coupons to EXPIRED status
    WITH expired AS (
        UPDATE user_coupons
        SET status = 'EXPIRED'
        WHERE status = 'ACTIVE'
          AND valid_until IS NOT NULL
          AND valid_until < NOW()
        RETURNING id, campaign_id, source
    )
    SELECT COUNT(*) INTO v_expired_count FROM expired;

    -- Step 2: Decrement claimed_count for all affected campaigns in one pass.
    -- Groups by campaign_id to batch the decrements.
    WITH recently_expired AS (
        SELECT campaign_id, COUNT(*) AS cnt
        FROM user_coupons
        WHERE status = 'EXPIRED'
          AND valid_until IS NOT NULL
          AND valid_until < NOW() + INTERVAL '1 minute'
          AND valid_until >= NOW() - INTERVAL '1 minute'
        GROUP BY campaign_id
    )
    UPDATE merchant_coupons mc
    SET claimed_count = GREATEST(0, mc.claimed_count - re.cnt)
    FROM recently_expired re
    WHERE mc.id = re.campaign_id;

    GET DIAGNOSTICS v_returned_count = ROW_COUNT;

    RETURN json_build_object(
        'expired_count', v_expired_count,
        'campaigns_adjusted', v_returned_count
    );
END;
$$;
-- ============================================================
-- Coupon Serial Code Uniqueness Constraint
-- Prevents duplicate serial codes in the merchant_coupons table.
-- Combined with crypto-secure generation, makes collisions
-- virtually impossible, and catches them at the DB level if they occur.
-- ============================================================

-- Add unique constraint (IF NOT EXISTS is not supported for constraints,
-- so we use a DO block to check first)
DO $$
BEGIN
    -- Only add constraint if the column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'merchant_coupons'
        AND column_name = 'serial_code'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_serial_code'
    ) THEN
        ALTER TABLE merchant_coupons
        ADD CONSTRAINT unique_serial_code UNIQUE (serial_code);
    END IF;
END;
$$;
-- ============================================================
-- Atomic Gader Points Operations
-- Prevents race conditions when multiple concurrent votes
-- try to award points to the same user simultaneously.
-- ============================================================

-- RPC: Atomically increment (or decrement) a user's gader_points.
-- Returns the new gader_points value after the update.
CREATE OR REPLACE FUNCTION increment_gader_points(
    p_profile_id UUID,
    p_amount INTEGER DEFAULT 10
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_points INTEGER;
BEGIN
    UPDATE profiles
    SET gader_points = GREATEST(COALESCE(gader_points, 0) + p_amount, 0)
    WHERE id = p_profile_id
    RETURNING gader_points INTO v_new_points;

    IF NOT FOUND THEN
        -- Profile doesn't exist — return 0 silently.
        RETURN 0;
    END IF;

    RETURN v_new_points;
END;
$$;

-- RPC: Atomically increment a business stat column (recommends or complains).
-- Used by the business-stats API route to prevent read-modify-write races.
CREATE OR REPLACE FUNCTION increment_business_stat(
    p_business_id UUID,
    p_column TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_column = 'recommends' THEN
        UPDATE businesses SET recommends = COALESCE(recommends, 0) + 1
        WHERE id = p_business_id;
    ELSIF p_column = 'complains' THEN
        UPDATE businesses SET complains = COALESCE(complains, 0) + 1
        WHERE id = p_business_id;
    ELSE
        RAISE EXCEPTION 'Invalid column: %. Expected recommends or complains.', p_column;
    END IF;
END;
$$;
-- ============================================================
-- OTP Rate Limiting
-- Prevents brute-force OTP verification and WhatsApp cost attacks.
-- ============================================================

-- Table to track OTP request rates per phone number
CREATE TABLE IF NOT EXISTS otp_rate_limits (
    phone TEXT NOT NULL,
    action TEXT NOT NULL,             -- 'send' or 'verify'
    attempt_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (phone, action)
);

-- Enable RLS (deny all by default — only service role should access this)
ALTER TABLE otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- RPC to check and increment rate limit
-- Returns TRUE if the request is allowed, FALSE if rate-limited.
CREATE OR REPLACE FUNCTION check_otp_rate_limit(
    p_phone TEXT,
    p_action TEXT,
    p_max_attempts INTEGER,
    p_window_minutes INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record otp_rate_limits%ROWTYPE;
BEGIN
    -- Delete expired windows for this phone+action
    DELETE FROM otp_rate_limits
    WHERE phone = p_phone
      AND action = p_action
      AND window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL;

    -- Check current window
    SELECT * INTO v_record
    FROM otp_rate_limits
    WHERE phone = p_phone AND action = p_action;

    IF v_record IS NULL THEN
        -- First attempt in this window — insert and allow
        INSERT INTO otp_rate_limits (phone, action, attempt_count, window_start)
        VALUES (p_phone, p_action, 1, NOW());
        RETURN TRUE;
    END IF;

    IF v_record.attempt_count >= p_max_attempts THEN
        -- Rate limit exceeded
        RETURN FALSE;
    END IF;

    -- Increment counter and allow
    UPDATE otp_rate_limits
    SET attempt_count = attempt_count + 1
    WHERE phone = p_phone AND action = p_action;

    RETURN TRUE;
END;
$$;
-- ========================================================
-- Migration: Financial Engine — Phase 0: Schema Cleanup
-- Description: Resolves legacy tier naming, adds multi-gateway
--   payment columns, expands subscription state machine,
--   creates immutable payment audit log, and seeds
--   payment gateway configuration.
-- ========================================================


-- ═══════════════════════════════════════════════════════════
-- 1. SUBSCRIPTION STATUS EXPANSION
-- ═══════════════════════════════════════════════════════════

-- Drop the old CHECK constraint on subscriptions.status
DO $$
DECLARE
    const_name text;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';

    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.subscriptions DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- Add the expanded state machine
ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_status_check
CHECK (status IN (
    'Pending',        -- Payment submitted, awaiting admin review
    'Active',         -- Confirmed and running
    'Expiring Soon',  -- Within 7 days of expiry (cron-set)
    'Expired',        -- Past expires_at date
    'Grace Period',   -- Post-expiry window before feature revocation
    'Suspended',      -- Admin-initiated hold (fraud/dispute)
    'Terminated'      -- Permanently ended
));

-- Add grace_period_days column for per-tier configurability
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 3;


-- ═══════════════════════════════════════════════════════════
-- 2. TRANSACTIONS TABLE EXPANSION
-- ═══════════════════════════════════════════════════════════

-- Add multi-currency and multi-gateway fields
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'LYD';

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'manual_bank';

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS gateway_reference TEXT;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,4);

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Expand transaction status to include 'rejected' (may already exist)
DO $$
DECLARE
    const_name text;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';

    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.transactions DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_status_check
CHECK (status IN ('pending', 'completed', 'rejected'));


-- ═══════════════════════════════════════════════════════════
-- 3. IMMUTABLE PAYMENT AUDIT LOG
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,          -- 'transaction', 'subscription'
    entity_id UUID NOT NULL,            -- FK to source record
    action TEXT NOT NULL,               -- 'created', 'approved', 'rejected', 'expired', 'suspended', 'terminated', 'reinstated'
    old_status TEXT,
    new_status TEXT,
    performed_by UUID REFERENCES public.profiles(id),
    reason TEXT,                        -- Admin note / rejection reason
    metadata JSONB DEFAULT '{}'::jsonb, -- Gateway details, amounts, currency
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.payment_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.payment_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.payment_audit_log(created_at);

-- Enable RLS
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

-- IMMUTABLE: INSERT only for admins, SELECT for admins. NO UPDATE. NO DELETE.
CREATE POLICY "Admins can insert audit entries"
    ON public.payment_audit_log FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
    );

-- Service role can also insert (for cron jobs and RPCs)
CREATE POLICY "Service role can insert audit entries"
    ON public.payment_audit_log FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can read audit log"
    ON public.payment_audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin', 'assistant_admin')
        )
    );

-- Grant permissions
GRANT SELECT, INSERT ON public.payment_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.payment_audit_log TO service_role;


-- ═══════════════════════════════════════════════════════════
-- 4. SEED PAYMENT GATEWAYS CONFIG
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.platform_config (key, value) VALUES
('payment_gateways', '[
    {
        "id": "manual_bank",
        "name": "Bank Transfer",
        "name_ar": "تحويل بنكي",
        "type": "manual",
        "currency": "LYD",
        "isActive": true,
        "config": {
            "bank_name": "Bank of Commerce & Development",
            "account_number": "",
            "instructions": "Transfer to the above account and upload your receipt.",
            "instructions_ar": "حوّل المبلغ إلى الحساب أعلاه وارفع صورة الإيصال."
        }
    },
    {
        "id": "crypto_usdt",
        "name": "Crypto (USDT-TRC20)",
        "name_ar": "عملة رقمية (USDT)",
        "type": "crypto",
        "currency": "USDT",
        "isActive": false,
        "config": {
            "wallet_address": "",
            "network": "TRC-20",
            "exchange_rate_lyd_per_usdt": 6.2
        }
    },
    {
        "id": "tlync_lyd",
        "name": "Tlync (Online Payment)",
        "name_ar": "تلينك (دفع إلكتروني)",
        "type": "api",
        "currency": "LYD",
        "isActive": false,
        "config": {
            "api_base_url": "",
            "merchant_id": "",
            "webhook_secret": ""
        }
    }
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ═══════════════════════════════════════════════════════════
-- 5. ADD FREEBIE MODE TO TIER PRICING
-- ═══════════════════════════════════════════════════════════

-- Update each tier in the existing tier_pricing JSON to include isFreebie and originalPrice
UPDATE public.platform_config
SET value = (
    SELECT jsonb_agg(
        tier || jsonb_build_object(
            'isFreebie', COALESCE(tier->>'isFreebie', 'false')::boolean,
            'originalPrice', CASE WHEN tier ? 'originalPrice' THEN tier->'originalPrice' ELSE 'null'::jsonb END,
            'gracePeriodDays', COALESCE((tier->>'gracePeriodDays')::int, 3)
        )
    )
    FROM jsonb_array_elements(value) AS tier
)
WHERE key = 'tier_pricing';


-- ═══════════════════════════════════════════════════════════
-- 6. UPDATED admin_confirm_payment RPC
--    - Uses new tier names from platform_config
--    - Writes immutable audit log
--    - Sets confirmed_by / confirmed_at
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION admin_confirm_payment(p_txn_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_tier TEXT;
    v_duration TEXT;
    v_owner_id UUID;
    v_days INTEGER;
    v_addon_type TEXT;
    v_admin_id UUID;
    v_amount NUMERIC;
    v_currency TEXT;
    v_gateway TEXT;
BEGIN
    v_admin_id := auth.uid();

    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Get transaction details
    SELECT business_id, requested_tier, duration, owner_id, amount, currency, payment_gateway
    INTO v_business_id, v_tier, v_duration, v_owner_id, v_amount, v_currency, v_gateway
    FROM public.transactions
    WHERE id = p_txn_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending transaction not found';
    END IF;

    -- Map duration to days
    IF v_duration = '30 Days' OR v_duration = '1 Month' THEN v_days := 30;
    ELSIF v_duration = '90 Days' OR v_duration = '3 Months' THEN v_days := 90;
    ELSIF v_duration = '365 Days' OR v_duration = '1 Year' THEN v_days := 365;
    ELSE v_days := 30;
    END IF;

    -- Mark transaction as completed with audit fields
    UPDATE public.transactions
    SET status = 'completed',
        confirmed_by = v_admin_id,
        confirmed_at = NOW()
    WHERE id = p_txn_id;

    -- Write immutable audit log
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, metadata)
    VALUES (
        'transaction', p_txn_id, 'approved', 'pending', 'completed', v_admin_id,
        jsonb_build_object('amount', v_amount, 'currency', v_currency, 'gateway', v_gateway, 'tier', v_tier)
    );

    -- Check if it is an Addon Purchase
    IF v_tier LIKE '%Addon%' THEN
        v_addon_type := lower(split_part(v_tier, ' ', 1));

        INSERT INTO public.merchant_addons (profile_id, addon_type, quantity, status, expires_at)
        VALUES (v_owner_id, v_addon_type, 1, 'active', now() + (v_days || ' days')::interval);

        INSERT INTO public.feature_allocations (profile_id, business_id, feature_type, status)
        VALUES (v_owner_id, v_business_id, v_addon_type, 'active')
        ON CONFLICT (profile_id, business_id, feature_type)
        DO UPDATE SET status = 'active';

    ELSE
        -- Tier Upgrade — normalize legacy tier names
        IF v_tier = 'Tier 1' THEN v_tier := 'Pro'; END IF;
        IF v_tier = 'Tier 2' THEN v_tier := 'Enterprise'; END IF;

        -- Upsert Subscription
        INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at)
        VALUES (v_business_id, v_owner_id, v_tier, 'Active', now() + (v_days || ' days')::interval)
        ON CONFLICT (business_id)
        DO UPDATE SET
            tier = EXCLUDED.tier,
            status = 'Active',
            expires_at = EXCLUDED.expires_at,
            profile_id = EXCLUDED.profile_id;

        -- Write subscription audit log
        INSERT INTO public.payment_audit_log (entity_type, entity_id, action, new_status, performed_by, metadata)
        VALUES (
            'subscription', v_business_id, 'activated', 'Active', v_admin_id,
            jsonb_build_object('tier', v_tier, 'days', v_days, 'source_txn', p_txn_id)
        );
    END IF;

END;
$$;


-- ═══════════════════════════════════════════════════════════
-- 7. NEW: admin_reject_payment RPC
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION admin_reject_payment(p_txn_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id UUID;
    v_amount NUMERIC;
    v_currency TEXT;
    v_gateway TEXT;
    v_tier TEXT;
BEGIN
    v_admin_id := auth.uid();

    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Verify transaction exists and is pending
    SELECT amount, currency, payment_gateway, requested_tier
    INTO v_amount, v_currency, v_gateway, v_tier
    FROM public.transactions
    WHERE id = p_txn_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending transaction not found';
    END IF;

    -- Mark as rejected
    UPDATE public.transactions
    SET status = 'rejected',
        rejection_reason = p_reason,
        confirmed_by = v_admin_id,
        confirmed_at = NOW()
    WHERE id = p_txn_id;

    -- Write immutable audit log
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, reason, metadata)
    VALUES (
        'transaction', p_txn_id, 'rejected', 'pending', 'rejected', v_admin_id, p_reason,
        jsonb_build_object('amount', v_amount, 'currency', v_currency, 'gateway', v_gateway, 'tier', v_tier)
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════
-- 8. FORCE SCHEMA CACHE RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
-- ==========================================
-- Sprint 6: Unified Claim Enforcement Triggers
-- ==========================================

-- Trigger 1: Block Double-Claims
-- Prevents INSERT into business_claims if the target business_id
-- already has a pending or approved claim from ANY user.

CREATE OR REPLACE FUNCTION enforce_no_double_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.business_claims
        WHERE business_id = NEW.business_id
          AND status IN ('pending', 'approved')
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
        RAISE EXCEPTION 'CLAIM_CONFLICT: Business already has an active claim'
            USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_no_double_claim ON public.business_claims;
CREATE TRIGGER trg_no_double_claim
    BEFORE INSERT ON public.business_claims
    FOR EACH ROW
    EXECUTE FUNCTION enforce_no_double_claim();


-- Trigger 2: Block Over-Quota Claims
-- Prevents INSERT if the requesting user's (active + pending) claim count
-- exceeds their tier limit from subscriptions.quotas.max_locations.

CREATE OR REPLACE FUNCTION enforce_claim_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_locations INTEGER;
    v_current_count INTEGER;
BEGIN
    -- Get the user's tier quota (default Free = 1)
    SELECT COALESCE((s.quotas->>'max_locations')::int, 1)
    INTO v_max_locations
    FROM public.subscriptions s
    WHERE s.profile_id = NEW.user_id
      AND s.status IN ('Active', 'Expiring Soon', 'Grace Period')
    ORDER BY s.expires_at DESC
    LIMIT 1;

    -- If no subscription found, default to Free tier (1 location)
    IF v_max_locations IS NULL THEN
        v_max_locations := 1;
    END IF;

    -- Count active + pending claims for this user
    SELECT COUNT(*)
    INTO v_current_count
    FROM public.business_claims
    WHERE user_id = NEW.user_id
      AND status IN ('pending', 'approved');

    IF v_current_count >= v_max_locations THEN
        RAISE EXCEPTION 'QUOTA_EXCEEDED: You have reached your tier limit of % locations', v_max_locations
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_claim_quota ON public.business_claims;
CREATE TRIGGER trg_enforce_claim_quota
    BEFORE INSERT ON public.business_claims
    FOR EACH ROW
    EXECUTE FUNCTION enforce_claim_quota();
-- Migration: Storefront Overhaul v3
-- Extends catalog_items with SKU, ordering, reaction counts
-- Creates catalog_reactions table for fingerprint-based like/dislike

-- 1. Extend catalog_items
ALTER TABLE public.catalog_items
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0;

-- 2. Catalog reaction tracking (1 reaction per device per product)
CREATE TABLE IF NOT EXISTS public.catalog_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
    fingerprint TEXT NOT NULL,
    reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(item_id, fingerprint)
);

-- 3. RLS
ALTER TABLE public.catalog_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert reactions"
    ON public.catalog_reactions FOR INSERT
    TO PUBLIC
    WITH CHECK (true);

CREATE POLICY "Allow public read reactions"
    ON public.catalog_reactions FOR SELECT
    TO PUBLIC
    USING (true);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_catalog_reactions_item ON public.catalog_reactions(item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_display_order ON public.catalog_items(display_order);

-- 5. Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload_schema';
-- Migration: Subscription Lifecycle State Machine (Automated Transitions)
-- Replaces the original check_and_expire_subscriptions function

CREATE OR REPLACE FUNCTION check_and_expire_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_row RECORD;
    v_rows INTEGER;
BEGIN
    -- 1. Grace Period → Free (grace expired, revoke to Free tier)
    FOR v_row IN
        SELECT id, profile_id FROM public.subscriptions
        WHERE status = 'Grace Period'
          AND expires_at + (COALESCE((quotas->>'gracePeriodDays')::int, 3) || ' days')::interval < NOW()
    LOOP
        UPDATE public.subscriptions
        SET status = 'Expired', tier = 'Free', quotas = '{}'::jsonb
        WHERE id = v_row.id;

        -- Write audit log
        INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, reason)
        VALUES ('subscription', v_row.id, 'expired', 'Grace Period', 'Expired', NULL, 'Grace period ended — auto-reverted to Free');

        v_count := v_count + 1;
    END LOOP;

    -- 2. Expired → Grace Period (just expired, enter grace window)
    FOR v_row IN
        SELECT id, profile_id FROM public.subscriptions
        WHERE status = 'Expired'
          AND tier != 'Free'
          AND expires_at >= NOW() - INTERVAL '1 day'
    LOOP
        UPDATE public.subscriptions
        SET status = 'Grace Period'
        WHERE id = v_row.id;

        INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, reason)
        VALUES ('subscription', v_row.id, 'expired', 'Expired', 'Grace Period', NULL, 'Entered grace period — merchant has 3 days to renew');

        v_count := v_count + 1;
    END LOOP;

    -- 3. Active → Expired (past expiry date)
    UPDATE public.subscriptions
    SET status = 'Expired'
    WHERE status = 'Active'
      AND expires_at < NOW();
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_count := v_count + v_rows;

    -- 4. Active → Expiring Soon (within 7 days)
    UPDATE public.subscriptions
    SET status = 'Expiring Soon'
    WHERE status = 'Active'
      AND expires_at < NOW() + INTERVAL '7 days'
      AND expires_at >= NOW();

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-schedule the cron job (idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
        PERFORM cron.unschedule('expire-subscriptions');
        PERFORM cron.schedule(
            'expire-subscriptions',
            '0 */6 * * *',  -- Run every 6 hours instead of daily for tighter lifecycle
            'SELECT check_and_expire_subscriptions()'
        );
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'pg_cron not available';
END;
$$;
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
-- Migration: Update Transactions and Admin RPC to support Addons
-- Description: Drops check constraint on requested_tier and updates admin_confirm_payment

-- 1. Drop the check constraint on transactions.requested_tier
DO $$ 
DECLARE
    const_name text;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%requested_tier%';
      
    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.transactions DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- 2. Update the Admin Conform Payment RPC
CREATE OR REPLACE FUNCTION admin_confirm_payment(p_txn_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_tier TEXT;
    v_duration TEXT;
    v_owner_id UUID;
    v_days INTEGER;
    v_addon_type TEXT;
BEGIN
    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Get transaction details
    SELECT business_id, requested_tier, duration, owner_id 
    INTO v_business_id, v_tier, v_duration, v_owner_id
    FROM public.transactions 
    WHERE id = p_txn_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending transaction not found';
    END IF;

    -- Map duration to days
    IF v_duration = '30 Days' OR v_duration = '1 Month' THEN v_days := 30;
    ELSIF v_duration = '90 Days' THEN v_days := 90;
    ELSIF v_duration = '365 Days' OR v_duration = '1 Year' THEN v_days := 365;
    ELSE v_days := 30;
    END IF;

    -- Mark transaction as completed
    UPDATE public.transactions SET status = 'completed' WHERE id = p_txn_id;

    -- Check if it is an Addon Purchase
    IF v_tier LIKE '%Addon%' THEN
        -- Extract addon type (e.g., 'Shield Addon' -> 'shield')
        v_addon_type := lower(split_part(v_tier, ' ', 1));
        
        -- Insert or Update merchant_addons
        -- Assuming we simply increase the quantity if active, or insert new
        INSERT INTO public.merchant_addons (profile_id, addon_type, quantity, status, expires_at)
        VALUES (v_owner_id, v_addon_type, 1, 'active', now() + (v_days || ' days')::interval);
        
        -- Need to allocate the feature essentially allowing usage
        INSERT INTO public.feature_allocations (profile_id, business_id, feature_type, status)
        VALUES (v_owner_id, v_business_id, v_addon_type, 'active')
        ON CONFLICT (profile_id, business_id, feature_type) 
        DO UPDATE SET status = 'active';

    ELSE
        -- It is a Tier Upgrade
        -- Upsert Subscription
        INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at)
        VALUES (v_business_id, v_owner_id, v_tier, 'Active', now() + (v_days || ' days')::interval)
        ON CONFLICT (profile_id)
        DO UPDATE SET 
            tier = EXCLUDED.tier,
            status = 'Active',
            expires_at = EXCLUDED.expires_at,
            business_id = EXCLUDED.business_id;

        -- Update business shield_level if tying Tier to Shield
        UPDATE public.businesses 
        SET shield_level = CASE WHEN v_tier = 'Enterprise' THEN 2 ELSE 1 END
        WHERE id = v_business_id;
    END IF;

END;
$$;
-- Migration: Financial Audit — Admin Subscription Actions & ERP Sync Queue
-- Sprint 5: feat/financial-audit

-- ============================================================
-- PART 1: Admin Subscription Management RPCs
-- ============================================================

-- RPC: Suspend a subscription (admin action during fraud investigation)
CREATE OR REPLACE FUNCTION admin_suspend_subscription(p_subscription_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_old_status TEXT;
    v_admin_id UUID;
BEGIN
    v_admin_id := auth.uid();

    -- Get current status
    SELECT status INTO v_old_status
    FROM public.subscriptions
    WHERE id = p_subscription_id;

    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Subscription not found';
    END IF;

    IF v_old_status NOT IN ('Active', 'Expiring Soon') THEN
        RAISE EXCEPTION 'Can only suspend Active or Expiring Soon subscriptions. Current: %', v_old_status;
    END IF;

    -- Update status
    UPDATE public.subscriptions
    SET status = 'Suspended'
    WHERE id = p_subscription_id;

    -- Audit log
    INSERT INTO public.payment_audit_log
        (entity_type, entity_id, action, old_status, new_status, performed_by, reason)
    VALUES
        ('subscription', p_subscription_id, 'suspended', v_old_status, 'Suspended', v_admin_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Reinstate a suspended subscription
CREATE OR REPLACE FUNCTION admin_reinstate_subscription(p_subscription_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_old_status TEXT;
    v_admin_id UUID;
BEGIN
    v_admin_id := auth.uid();

    SELECT status INTO v_old_status
    FROM public.subscriptions
    WHERE id = p_subscription_id;

    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Subscription not found';
    END IF;

    IF v_old_status != 'Suspended' THEN
        RAISE EXCEPTION 'Can only reinstate Suspended subscriptions. Current: %', v_old_status;
    END IF;

    UPDATE public.subscriptions
    SET status = 'Active'
    WHERE id = p_subscription_id;

    INSERT INTO public.payment_audit_log
        (entity_type, entity_id, action, old_status, new_status, performed_by, reason)
    VALUES
        ('subscription', p_subscription_id, 'activated', 'Suspended', 'Active', v_admin_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Terminate a subscription (permanent, non-reversible)
CREATE OR REPLACE FUNCTION admin_terminate_subscription(p_subscription_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_old_status TEXT;
    v_admin_id UUID;
BEGIN
    v_admin_id := auth.uid();

    SELECT status INTO v_old_status
    FROM public.subscriptions
    WHERE id = p_subscription_id;

    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Subscription not found';
    END IF;

    IF v_old_status = 'Terminated' THEN
        RAISE EXCEPTION 'Subscription is already terminated';
    END IF;

    UPDATE public.subscriptions
    SET status = 'Terminated'
    WHERE id = p_subscription_id;

    INSERT INTO public.payment_audit_log
        (entity_type, entity_id, action, old_status, new_status, performed_by, reason)
    VALUES
        ('subscription', p_subscription_id, 'terminated', v_old_status, 'Terminated', v_admin_id, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 2: ERP Sync Queue (Passive Event Capture)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.erp_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
    sync_attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

-- Index for dequeuing
CREATE INDEX IF NOT EXISTS idx_erp_sync_queue_status ON public.erp_sync_queue(status) WHERE status = 'pending';

-- Enable RLS (admin-only read, trigger-only write)
ALTER TABLE public.erp_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sync queue"
    ON public.erp_sync_queue FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Trigger: Capture transaction status changes
CREATE OR REPLACE FUNCTION erp_capture_transaction_event()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.erp_sync_queue (event_type, payload)
        VALUES (
            CASE
                WHEN NEW.status = 'completed' THEN 'payment_confirmed'
                WHEN NEW.status = 'rejected' THEN 'payment_rejected'
                ELSE 'transaction_updated'
            END,
            jsonb_build_object(
                'transaction_id', NEW.id,
                'business_id', NEW.business_id,
                'owner_id', NEW.owner_id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'amount', NEW.amount,
                'currency', NEW.currency,
                'payment_gateway', NEW.payment_gateway,
                'requested_tier', NEW.requested_tier,
                'changed_at', NOW()
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_erp_transaction ON public.transactions;
CREATE TRIGGER trg_erp_transaction
    AFTER UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION erp_capture_transaction_event();

-- Trigger: Capture subscription status changes
CREATE OR REPLACE FUNCTION erp_capture_subscription_event()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.erp_sync_queue (event_type, payload)
        VALUES (
            CASE
                WHEN NEW.status = 'Active' THEN 'subscription_activated'
                WHEN NEW.status = 'Expired' THEN 'subscription_expired'
                WHEN NEW.status = 'Suspended' THEN 'subscription_suspended'
                WHEN NEW.status = 'Terminated' THEN 'subscription_terminated'
                ELSE 'subscription_changed'
            END,
            jsonb_build_object(
                'subscription_id', NEW.id,
                'profile_id', NEW.profile_id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'old_tier', OLD.tier,
                'new_tier', NEW.tier,
                'expires_at', NEW.expires_at,
                'changed_at', NOW()
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_erp_subscription ON public.subscriptions;
CREATE TRIGGER trg_erp_subscription
    AFTER UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION erp_capture_subscription_event();
-- =========================================================================
-- Migration: 20260315_subscription_tiers_table.sql
-- Purpose: Create a proper relational table for subscription tiers,
--          migrate data from platform_config JSON, and enforce uniqueness.
-- Branch: feat/dynamic-pricing-sync
-- =========================================================================

-- 1. Create the subscription_tiers table
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    name_ar     TEXT,
    description TEXT,
    description_ar TEXT,
    price       INTEGER NOT NULL DEFAULT 0,
    duration    TEXT NOT NULL DEFAULT 'monthly',
    features    JSONB NOT NULL DEFAULT '[]'::jsonb,
    features_ar JSONB NOT NULL DEFAULT '[]'::jsonb,
    allocations JSONB NOT NULL DEFAULT '{"max_locations":1,"max_shields":0,"max_campaigns":0,"max_storefronts":0,"gader_points":5}'::jsonb,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    is_popular  BOOLEAN NOT NULL DEFAULT false,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Migrate existing data from platform_config JSON blob
-- Uses DISTINCT ON to automatically deduplicate by id (fixes the 'free' duplication)
INSERT INTO public.subscription_tiers (
    id, name, name_ar, description, description_ar,
    price, duration, features, features_ar, allocations,
    is_active, is_popular, sort_order
)
SELECT
    elem->>'id',
    elem->>'name',
    elem->>'name_ar',
    elem->>'description',
    elem->>'description_ar',
    COALESCE((elem->>'price')::integer, 0),
    COALESCE(elem->>'duration', 'monthly'),
    COALESCE(elem->'features', '[]'::jsonb),
    COALESCE(elem->'features_ar', '[]'::jsonb),
    COALESCE(elem->'allocations', '{"max_locations":1,"max_shields":0,"max_campaigns":0,"max_storefronts":0,"gader_points":5}'::jsonb),
    COALESCE((elem->>'isActive')::boolean, true),
    COALESCE((elem->>'isPopular')::boolean, false),
    rn
FROM (
    SELECT DISTINCT ON (elem->>'id') elem, ROW_NUMBER() OVER () as rn
    FROM platform_config,
    jsonb_array_elements(value) AS elem
    WHERE key = 'tier_pricing'
    ORDER BY elem->>'id' ASC
) deduped
ON CONFLICT (id) DO NOTHING;

-- 3. RLS Policies
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can read tiers (needed for pricing page, onboarding, merchant settings)
DROP POLICY IF EXISTS "Public read access to tiers" ON public.subscription_tiers;
CREATE POLICY "Public read access to tiers"
    ON public.subscription_tiers FOR SELECT
    USING (true);

-- Only admins can modify tiers
DROP POLICY IF EXISTS "Admins can manage tiers" ON public.subscription_tiers;
CREATE POLICY "Admins can manage tiers"
    ON public.subscription_tiers FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'admin')
        )
    );

-- 4. Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_tier_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tier_updated_at ON public.subscription_tiers;
CREATE TRIGGER trg_tier_updated_at
    BEFORE UPDATE ON public.subscription_tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_tier_timestamp();
-- ============================================================
-- Phase 1a: Server-Side Vote Weight Calculation
-- Moves the entire vote submission pipeline into a single
-- atomic SECURITY DEFINER function to prevent client-side
-- weight manipulation.
--
-- Also:
--  - Adds is_flagged column to logs (Phase 1b prep)
--  - Hardens RLS on profiles (Phase 1c)
--  - Enforces cooldown + anonymous limits server-side
-- ============================================================

-- ─── 1. Add is_flagged column for content moderation ──────
ALTER TABLE logs ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;

-- ─── 2. The submit_vote RPC ───────────────────────────────
CREATE OR REPLACE FUNCTION submit_vote(
    p_business_id UUID,
    p_interaction_type TEXT,
    p_reason_text TEXT DEFAULT NULL,
    p_profile_id UUID DEFAULT NULL,
    p_fingerprint TEXT DEFAULT NULL,
    p_is_flagged BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier_multiplier NUMERIC;
    v_diminishing NUMERIC;
    v_weight NUMERIC;
    v_past_count INT;
    v_gader_points INT;
    v_vip_tier TEXT;
    v_points_from_tier NUMERIC;
    v_inserted_id BIGINT;          -- FIXED: logs.id is BIGINT, not UUID
    v_inserted_at TIMESTAMPTZ;
    v_earned_points INT;
    v_new_points INT;
    v_cooldown_count INT;
    v_anon_count INT;
    v_role TEXT;
BEGIN
    -- ── Validate inputs ──────────────────────────────────
    IF p_interaction_type NOT IN ('recommend', 'complain') THEN
        RETURN jsonb_build_object('error', 'Invalid interaction_type');
    END IF;

    IF p_business_id IS NULL THEN
        RETURN jsonb_build_object('error', 'business_id is required');
    END IF;

    -- ── Block merchant accounts ──────────────────────────
    IF p_profile_id IS NOT NULL THEN
        SELECT role INTO v_role FROM profiles WHERE id = p_profile_id;
        IF v_role = 'merchant' THEN
            RETURN jsonb_build_object('error', 'Merchant accounts cannot vote');
        END IF;
    END IF;

    -- ── Anonymous global limit: 7 per week (configurable) ─
    IF p_profile_id IS NULL AND p_fingerprint IS NOT NULL THEN
        SELECT COUNT(*) INTO v_anon_count
        FROM logs
        WHERE fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '7 days';

        IF v_anon_count >= 7 THEN
            RETURN jsonb_build_object('error', 'anonymous_weekly_limit', 'limit', 7);
        END IF;
    END IF;

    -- ── 24-Hour same-business cooldown ────────────────────
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_cooldown_count
        FROM logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at >= NOW() - INTERVAL '24 hours';
    ELSE
        SELECT COUNT(*) INTO v_cooldown_count
        FROM logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '24 hours';
    END IF;

    IF v_cooldown_count > 0 THEN
        RETURN jsonb_build_object('error', 'cooldown_active');
    END IF;

    -- ── Tier multiplier ──────────────────────────────────
    IF p_profile_id IS NULL THEN
        v_tier_multiplier := 0.2;  -- Anonymous
    ELSE
        SELECT gader_points, vip_tier
        INTO v_gader_points, v_vip_tier
        FROM profiles WHERE id = p_profile_id;

        -- From VIP tier string
        v_tier_multiplier := 1.0;  -- Bronze default
        IF LOWER(COALESCE(v_vip_tier, '')) LIKE '%vip%'
           OR LOWER(COALESCE(v_vip_tier, '')) LIKE '%diamond%' THEN
            v_tier_multiplier := 2.5;
        ELSIF LOWER(COALESCE(v_vip_tier, '')) LIKE '%gold%' THEN
            v_tier_multiplier := 2.0;
        ELSIF LOWER(COALESCE(v_vip_tier, '')) LIKE '%silver%' THEN
            v_tier_multiplier := 1.5;
        END IF;

        -- From Gader points (take the higher)
        v_points_from_tier := 1.0;
        IF COALESCE(v_gader_points, 0) >= 20000 THEN
            v_points_from_tier := 2.5;
        ELSIF COALESCE(v_gader_points, 0) >= 5000 THEN
            v_points_from_tier := 2.0;
        ELSIF COALESCE(v_gader_points, 0) >= 1000 THEN
            v_points_from_tier := 1.5;
        END IF;

        v_tier_multiplier := GREATEST(v_tier_multiplier, v_points_from_tier);
    END IF;

    -- ── Diminishing returns (30-day same-business count) ──
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_past_count
        FROM logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at >= NOW() - INTERVAL '30 days';
    ELSE
        SELECT COUNT(*) INTO v_past_count
        FROM logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '30 days';
    END IF;

    IF v_past_count <= 0 THEN
        v_diminishing := 1.0;
    ELSIF v_past_count = 1 THEN
        v_diminishing := 0.5;
    ELSE
        v_diminishing := 0.25;
    END IF;

    -- ── Calculate final weight ───────────────────────────
    v_weight := ROUND(v_tier_multiplier * v_diminishing * 100) / 100;

    -- ── Insert log ───────────────────────────────────────
    INSERT INTO logs (
        business_id, interaction_type, reason_text,
        profile_id, fingerprint, weight, is_flagged
    )
    VALUES (
        p_business_id, p_interaction_type,
        CASE WHEN p_reason_text IS NOT NULL AND TRIM(p_reason_text) <> ''
             THEN TRIM(p_reason_text) ELSE NULL END,
        p_profile_id, p_fingerprint, v_weight, p_is_flagged
    )
    RETURNING id, created_at INTO v_inserted_id, v_inserted_at;

    -- ── Award Gader points (verified users only) ─────────
    v_earned_points := GREATEST(5, LEAST(25, ROUND(v_weight * 10)));
    v_new_points := NULL;

    IF p_profile_id IS NOT NULL THEN
        UPDATE profiles
        SET gader_points = GREATEST(COALESCE(gader_points, 0) + v_earned_points, 0)
        WHERE id = p_profile_id
        RETURNING gader_points INTO v_new_points;
    END IF;

    -- ── Return result ────────────────────────────────────
    RETURN jsonb_build_object(
        'success', true,
        'log_id', v_inserted_id,
        'created_at', v_inserted_at,
        'interaction_type', p_interaction_type,
        'reason_text', p_reason_text,
        'profile_id', p_profile_id,
        'fingerprint', p_fingerprint,
        'weight', v_weight,
        'is_flagged', p_is_flagged,
        'earned_points', v_earned_points,
        'new_gader_total', v_new_points,
        'past_vote_count', v_past_count
    );
END;
$$;

-- ─── 3. Grant execute to anon + authenticated ─────────────
GRANT EXECUTE ON FUNCTION submit_vote TO anon, authenticated;

-- ─── 4. (Phase 1c) Harden profiles RLS ───────────────────
-- Replace the permissive update policy with one that blocks
-- direct writes to gader_points and coupon_difficulty_level.
-- These fields can only be modified by SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "auth_update_own_profile" ON profiles;
CREATE POLICY "auth_update_own_profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        -- Block direct gader_points manipulation
        AND (gader_points IS NOT DISTINCT FROM (SELECT gader_points FROM profiles WHERE id = auth.uid()))
        -- Block direct coupon_difficulty_level manipulation
        AND (coupon_difficulty_level IS NOT DISTINCT FROM (SELECT coupon_difficulty_level FROM profiles WHERE id = auth.uid()))
    );

-- ─── 5. Revoke direct INSERT on logs for extra safety ─────
-- The submit_vote RPC (SECURITY DEFINER) can still insert.
-- Note: We keep anon SELECT for reading logs on public pages.
-- If this breaks existing anon log inserts, we rely on the RPC.
DO $$ BEGIN
    -- Only revoke if INSERT was granted (safe to run multiple times)
    REVOKE INSERT ON logs FROM anon;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not revoke INSERT from anon on logs: %', SQLERRM;
END $$;
-- ============================================================
-- Phase 2c: Unified Gader Index — is_flagged exclusion
-- Updates the recalculate_business_scores trigger to exclude
-- flagged logs from score calculation, ensuring the display_score
-- (used by Discover) and the storefront view always match.
-- ============================================================

CREATE OR REPLACE FUNCTION recalculate_business_scores()
RETURNS TRIGGER AS $$
DECLARE
    v_recommends INT;
    v_complains INT;
    v_total INT;
    v_display_score NUMERIC;
    v_target_business_id UUID;
BEGIN
    v_target_business_id := COALESCE(NEW.business_id, OLD.business_id);

    -- Count weighted votes — EXCLUDING flagged logs
    SELECT
        COALESCE(SUM(CASE WHEN interaction_type = 'recommend' THEN COALESCE(weight, 1) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN interaction_type = 'complain'  THEN COALESCE(weight, 1) ELSE 0 END), 0)
    INTO v_recommends, v_complains
    FROM logs
    WHERE business_id = v_target_business_id
      AND (is_flagged IS NULL OR is_flagged = false);

    v_total := v_recommends + v_complains;

    -- Display score: percentage of positive weighted votes (0-100)
    IF v_total > 0 THEN
        v_display_score := ROUND((v_recommends::NUMERIC / v_total) * 100, 1);
    ELSE
        v_display_score := NULL;
    END IF;

    -- Update the business row (fires real-time subscription)
    UPDATE businesses SET
        recommends = (SELECT COUNT(*) FROM logs WHERE business_id = v_target_business_id AND interaction_type = 'recommend' AND (is_flagged IS NULL OR is_flagged = false)),
        complains = (SELECT COUNT(*) FROM logs WHERE business_id = v_target_business_id AND interaction_type = 'complain' AND (is_flagged IS NULL OR is_flagged = false)),
        shadow_score = v_recommends - v_complains,
        display_score = v_display_score
    WHERE id = v_target_business_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger fires on INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS trg_recalculate_scores ON logs;
CREATE TRIGGER trg_recalculate_scores
    AFTER INSERT OR UPDATE OR DELETE ON logs
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_business_scores();
-- ============================================================
-- Phase 4: Coupon Engine Wiring (4a-4d, 4f)
-- 
-- 1. Add coupons_earned_this_week to profiles
-- 2. Create coupon_audit_log table
-- 3. Create PL/pgSQL generate_coupon_serial function
-- 4. Replace submit_vote RPC to include coupon logic
-- ============================================================

-- 1. Cap tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coupons_earned_this_week INT DEFAULT 0;

-- 2. Audit Table
CREATE TABLE IF NOT EXISTS coupon_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES merchant_coupons(id),
  profile_id UUID REFERENCES profiles(id),
  business_id UUID REFERENCES businesses(id),
  serial_code TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'vote_reward', 'admin_manual', 'merchant_import'
  difficulty_level INT,
  weight_at_creation NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PL/pgSQL serial code generator
CREATE OR REPLACE FUNCTION generate_coupon_serial(p_business_name TEXT, p_length INT DEFAULT 6)
RETURNS TEXT AS $$
DECLARE
    v_clean_name TEXT;
    v_prefix TEXT;
    v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_random_part TEXT := '';
    i INT;
BEGIN
    v_clean_name := UPPER(REGEXP_REPLACE(COALESCE(p_business_name, 'MER'), '[^a-zA-Z0-9]', '', 'g'));
    IF LENGTH(v_clean_name) = 0 THEN
        v_clean_name := 'MER';
    END IF;

    v_prefix := SUBSTRING(v_clean_name FROM 1 FOR 3);
    WHILE LENGTH(v_prefix) < 3 LOOP
        v_prefix := v_prefix || 'X';
    END LOOP;

    FOR i IN 1..p_length LOOP
        v_random_part := v_random_part || SUBSTRING(v_chars FROM (floor(random() * LENGTH(v_chars)) + 1)::INT FOR 1);
    END LOOP;

    RETURN 'TAG-' || v_prefix || '-' || v_random_part;
END;
$$ LANGUAGE plpgsql VOLATILE;


-- 4. Replace submit_vote
CREATE OR REPLACE FUNCTION submit_vote(
    p_business_id UUID,
    p_interaction_type TEXT,
    p_reason_text TEXT DEFAULT NULL,
    p_profile_id UUID DEFAULT NULL,
    p_fingerprint TEXT DEFAULT NULL,
    p_is_flagged BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier_multiplier NUMERIC;
    v_diminishing NUMERIC;
    v_weight NUMERIC;
    v_past_count INT;
    v_gader_points INT;
    v_vip_tier TEXT;
    v_points_from_tier NUMERIC;
    v_inserted_id BIGINT;          -- FIXED: logs.id is BIGINT, not UUID
    v_inserted_at TIMESTAMPTZ;
    v_earned_points INT;
    v_new_points INT;
    v_cooldown_count INT;
    v_anon_count INT;
    v_role TEXT;
    v_coupon_awarded JSONB := NULL;
BEGIN
    -- ── Validate inputs ──────────────────────────────────
    IF p_interaction_type NOT IN ('recommend', 'complain') THEN
        RETURN jsonb_build_object('error', 'Invalid interaction_type');
    END IF;

    IF p_business_id IS NULL THEN
        RETURN jsonb_build_object('error', 'business_id is required');
    END IF;

    -- ── Block merchant accounts ──────────────────────────
    IF p_profile_id IS NOT NULL THEN
        SELECT role INTO v_role FROM profiles WHERE id = p_profile_id;
        IF v_role = 'merchant' THEN
            RETURN jsonb_build_object('error', 'Merchant accounts cannot vote');
        END IF;
    END IF;

    -- ── Anonymous global limit: 7 per week (configurable) ─
    IF p_profile_id IS NULL AND p_fingerprint IS NOT NULL THEN
        SELECT COUNT(*) INTO v_anon_count
        FROM logs
        WHERE fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '7 days';

        IF v_anon_count >= 7 THEN
            RETURN jsonb_build_object('error', 'anonymous_weekly_limit', 'limit', 7);
        END IF;
    END IF;

    -- ── 24-Hour same-business cooldown ────────────────────
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_cooldown_count
        FROM logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at >= NOW() - INTERVAL '24 hours';
    ELSE
        SELECT COUNT(*) INTO v_cooldown_count
        FROM logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '24 hours';
    END IF;

    IF v_cooldown_count > 0 THEN
        RETURN jsonb_build_object('error', 'cooldown_active');
    END IF;

    -- ── Tier multiplier ──────────────────────────────────
    IF p_profile_id IS NULL THEN
        v_tier_multiplier := 0.2;  -- Anonymous
    ELSE
        SELECT gader_points, vip_tier
        INTO v_gader_points, v_vip_tier
        FROM profiles WHERE id = p_profile_id;

        -- From VIP tier string
        v_tier_multiplier := 1.0;  -- Bronze default
        IF LOWER(COALESCE(v_vip_tier, '')) LIKE '%vip%'
           OR LOWER(COALESCE(v_vip_tier, '')) LIKE '%diamond%' THEN
            v_tier_multiplier := 2.5;
        ELSIF LOWER(COALESCE(v_vip_tier, '')) LIKE '%gold%' THEN
            v_tier_multiplier := 2.0;
        ELSIF LOWER(COALESCE(v_vip_tier, '')) LIKE '%silver%' THEN
            v_tier_multiplier := 1.5;
        END IF;

        -- From Gader points (take the higher)
        v_points_from_tier := 1.0;
        IF COALESCE(v_gader_points, 0) >= 20000 THEN
            v_points_from_tier := 2.5;
        ELSIF COALESCE(v_gader_points, 0) >= 5000 THEN
            v_points_from_tier := 2.0;
        ELSIF COALESCE(v_gader_points, 0) >= 1000 THEN
            v_points_from_tier := 1.5;
        END IF;

        v_tier_multiplier := GREATEST(v_tier_multiplier, v_points_from_tier);
    END IF;

    -- ── Diminishing returns (30-day same-business count) ──
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_past_count
        FROM logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at >= NOW() - INTERVAL '30 days';
    ELSE
        SELECT COUNT(*) INTO v_past_count
        FROM logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '30 days';
    END IF;

    IF v_past_count <= 0 THEN
        v_diminishing := 1.0;
    ELSIF v_past_count = 1 THEN
        v_diminishing := 0.5;
    ELSE
        v_diminishing := 0.25;
    END IF;

    -- ── Calculate final weight ───────────────────────────
    v_weight := ROUND(v_tier_multiplier * v_diminishing * 100) / 100;

    -- ── Insert log ───────────────────────────────────────
    INSERT INTO logs (
        business_id, interaction_type, reason_text,
        profile_id, fingerprint, weight, is_flagged
    )
    VALUES (
        p_business_id, p_interaction_type,
        CASE WHEN p_reason_text IS NOT NULL AND TRIM(p_reason_text) <> ''
             THEN TRIM(p_reason_text) ELSE NULL END,
        p_profile_id, p_fingerprint, v_weight, p_is_flagged
    )
    RETURNING id, created_at INTO v_inserted_id, v_inserted_at;

    -- ── Award Gader points (verified users only) ─────────
    v_earned_points := GREATEST(5, LEAST(25, ROUND(v_weight * 10)));
    v_new_points := NULL;

    IF p_profile_id IS NOT NULL THEN
        UPDATE profiles
        SET gader_points = GREATEST(COALESCE(gader_points, 0) + v_earned_points, 0)
        WHERE id = p_profile_id
        RETURNING gader_points INTO v_new_points;

        -- ── Phase 4: Coupon Engine Logic ───────────────────
        IF v_new_points >= 50 THEN
            DECLARE
                v_weekly_logs INT;
                v_difficulty INT;
                v_coupons_this_week INT;
                v_threshold INT;
                v_selected_campaign_id UUID;
                v_business_name TEXT;
                v_discount_val NUMERIC;
                v_offer_type TEXT;
                v_serial TEXT;
            BEGIN
                SELECT weekly_log_count, coupon_difficulty_level, coupons_earned_this_week
                INTO v_weekly_logs, v_difficulty, v_coupons_this_week
                FROM profiles WHERE id = p_profile_id;

                -- Cap at 2 per week (Phase 4b)
                IF COALESCE(v_coupons_this_week, 0) < 2 THEN
                    v_threshold := 3 + COALESCE(v_difficulty, 1);

                    IF COALESCE(v_weekly_logs, 0) + 1 >= v_threshold THEN
                        -- Phase 4c & 4d: Find campaign with tier logic and prefer unvoted
                        SELECT mc.id, b.name, mc.discount_value, mc.offer_type
                        INTO v_selected_campaign_id, v_business_name, v_discount_val, v_offer_type
                        FROM merchant_coupons mc
                        JOIN businesses b ON b.id = mc.business_id
                        WHERE mc.status = 'active'
                          AND mc.remaining_quantity > 0
                          AND mc.distribution_rule = 'PUBLIC_POOL'
                          AND (
                              mc.target_tier = 'ALL' OR
                              (mc.target_tier = 'VIP_ONLY' AND v_new_points >= 20000) OR
                              (mc.target_tier = 'GOLD_ONLY' AND v_new_points >= 5000) OR
                              (mc.target_tier = 'SILVER_ONLY' AND v_new_points >= 1000) OR
                              (mc.target_tier = 'BRONZE_ONLY' AND v_new_points < 1000)
                          )
                        ORDER BY 
                          -- 1. Unvoted
                          (EXISTS (SELECT 1 FROM logs l WHERE l.business_id = mc.business_id AND l.profile_id = p_profile_id)) ASC,
                          -- 2. Voted but unused (no redeems for this business's coupons)
                          (EXISTS (SELECT 1 FROM user_coupons uc JOIN merchant_coupons mc2 ON uc.campaign_id = mc2.id WHERE mc2.business_id = mc.business_id AND uc.user_id = p_profile_id AND uc.status = 'REDEEMED')) ASC,
                          -- 3. Random fallback
                          RANDOM()
                        LIMIT 1;

                        IF v_selected_campaign_id IS NOT NULL THEN
                            -- Generate serial
                            v_serial := generate_coupon_serial(v_business_name);
                            
                            -- Insert user_coupon
                            INSERT INTO user_coupons (campaign_id, user_id, serial_code, source, status, valid_until)
                            VALUES (v_selected_campaign_id, p_profile_id, v_serial, 'POOL', 'ACTIVE', NOW() + INTERVAL '30 days');

                            -- Decrement inventory and increment claimed_count
                            UPDATE merchant_coupons 
                            SET remaining_quantity = remaining_quantity - 1,
                                claimed_count = COALESCE(claimed_count, 0) + 1
                            WHERE id = v_selected_campaign_id;

                            -- 4f: Audit log
                            INSERT INTO coupon_audit_log (coupon_id, profile_id, business_id, serial_code, trigger_type, difficulty_level, weight_at_creation)
                            VALUES (v_selected_campaign_id, p_profile_id, p_business_id, v_serial, 'vote_reward', v_difficulty, v_weight);

                            -- Reset logs, increment difficulty and coupons_this_week
                            UPDATE profiles SET
                                weekly_log_count = 0,
                                coupon_difficulty_level = COALESCE(coupon_difficulty_level, 1) + 1,
                                coupons_earned_this_week = COALESCE(coupons_earned_this_week, 0) + 1
                            WHERE id = p_profile_id;
                            
                            v_coupon_awarded := jsonb_build_object(
                                'campaign_id', v_selected_campaign_id, 
                                'serial', v_serial, 
                                'business', v_business_name,
                                'discount_value', v_discount_val,
                                'offer_type', v_offer_type
                            );
                        ELSE
                            -- No campaigns available. Just progress progress bar.
                            UPDATE profiles SET weekly_log_count = COALESCE(weekly_log_count, 0) + 1 WHERE id = p_profile_id;
                        END IF;
                    ELSE
                        -- Progress toward next coupon
                        UPDATE profiles SET weekly_log_count = COALESCE(weekly_log_count, 0) + 1 WHERE id = p_profile_id;
                    END IF;
                ELSE
                    -- Hit weekly cap. Progress bar still increments (or maybe not? We just update it)
                    UPDATE profiles SET weekly_log_count = COALESCE(weekly_log_count, 0) + 1 WHERE id = p_profile_id;
                END IF;
            END;
        END IF;

    END IF;

    -- ── Return result ────────────────────────────────────
    RETURN jsonb_build_object(
        'success', true,
        'log_id', v_inserted_id,
        'created_at', v_inserted_at,
        'interaction_type', p_interaction_type,
        'reason_text', p_reason_text,
        'profile_id', p_profile_id,
        'fingerprint', p_fingerprint,
        'weight', v_weight,
        'is_flagged', p_is_flagged,
        'earned_points', v_earned_points,
        'new_gader_total', v_new_points,
        'past_vote_count', v_past_count,
        'coupon_awarded', v_coupon_awarded
    );
END;
$$;
-- ==========================================
-- Phase 5: Admin & Merchant Coupon Extensions
-- ==========================================

-- 5a. Admin Voucher Code Import Table
CREATE TABLE IF NOT EXISTS public.voucher_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL, -- 'libyana', 'almadar', 'custom'
  denomination NUMERIC,
  status TEXT DEFAULT 'available', -- 'available', 'assigned', 'redeemed', 'expired'
  assigned_to UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  imported_by UUID REFERENCES public.profiles(id),
  batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for voucher_codes
ALTER TABLE public.voucher_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage voucher_codes"
  ON public.voucher_codes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their assigned vouchers"
  ON public.voucher_codes FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());


-- 5b. Merchant Bulk Coupon Upload Support
ALTER TABLE public.merchant_coupons 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'tagdeer_generated',
  ADD COLUMN IF NOT EXISTS imported_codes JSONB DEFAULT '[]'::jsonb;

-- Optional: If we want to prevent the RPC from assigning these if they run out, 
-- we would update the RPC, but the plan only asked for the upload UI in 5b.
-- ============================================================
-- Production Readiness: Weekly Counter Reset + Configurable Limits
--
-- 1. pg_cron job to reset weekly_log_count, coupons_earned_this_week
-- 2. Configurable anon_weekly_vote_limit in platform_config
-- 3. Update submit_vote RPC to read limit from config
-- ============================================================

-- ─── 1. Insert default anon_weekly_vote_limit config ──────────
INSERT INTO platform_config (key, value)
VALUES ('anon_weekly_vote_limit', '7')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. Weekly counter reset function ─────────────────────────
-- Resets weekly_log_count and coupons_earned_this_week every Monday 00:00 UTC.
-- This can be invoked via pg_cron, Supabase Edge Function cron, or manual call.
CREATE OR REPLACE FUNCTION reset_weekly_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE profiles
    SET weekly_log_count = 0,
        coupons_earned_this_week = 0
    WHERE weekly_log_count > 0
       OR coupons_earned_this_week > 0;

    RAISE NOTICE 'Weekly counters reset at %', NOW();
END;
$$;

-- ─── 3. Schedule via pg_cron (if extension available) ─────────
-- Supabase projects have pg_cron enabled by default.
-- This schedules the reset for every Monday at 00:00 UTC.
DO $$
BEGIN
    -- Check if pg_cron extension is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Unschedule if previously existed (idempotent)
        PERFORM cron.unschedule('weekly_counter_reset');
        -- Schedule: every Monday at 00:00 UTC
        PERFORM cron.schedule(
            'weekly_counter_reset',
            '0 0 * * 1',
            'SELECT reset_weekly_counters()'
        );
        RAISE NOTICE 'pg_cron job scheduled: weekly_counter_reset (every Monday 00:00 UTC)';
    ELSE
        RAISE NOTICE 'pg_cron not available. Use Supabase Edge Function cron or external scheduler to call reset_weekly_counters() weekly.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron scheduling failed: %. Set up external cron.', SQLERRM;
END $$;

-- ─── 4. Update submit_vote to read configurable anon limit ────
CREATE OR REPLACE FUNCTION submit_vote(
    p_business_id UUID,
    p_interaction_type TEXT,
    p_reason_text TEXT DEFAULT NULL,
    p_profile_id UUID DEFAULT NULL,
    p_fingerprint TEXT DEFAULT NULL,
    p_is_flagged BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier_multiplier NUMERIC;
    v_diminishing NUMERIC;
    v_weight NUMERIC;
    v_past_count INT;
    v_gader_points INT;
    v_vip_tier TEXT;
    v_points_from_tier NUMERIC;
    v_inserted_id BIGINT;          -- FIXED: logs.id is BIGINT, not UUID
    v_inserted_at TIMESTAMPTZ;
    v_earned_points INT;
    v_new_points INT;
    v_cooldown_count INT;
    v_anon_count INT;
    v_anon_limit INT;
    v_role TEXT;
    v_coupon_awarded JSONB := NULL;
BEGIN
    -- ── Validate inputs ──────────────────────────────────
    IF p_interaction_type NOT IN ('recommend', 'complain') THEN
        RETURN jsonb_build_object('error', 'Invalid interaction_type');
    END IF;

    IF p_business_id IS NULL THEN
        RETURN jsonb_build_object('error', 'business_id is required');
    END IF;

    -- ── Block merchant accounts ──────────────────────────
    IF p_profile_id IS NOT NULL THEN
        SELECT role INTO v_role FROM profiles WHERE id = p_profile_id;
        IF v_role = 'merchant' THEN
            RETURN jsonb_build_object('error', 'Merchant accounts cannot vote');
        END IF;
    END IF;

    -- ── Anonymous global limit: configurable per week ─────
    IF p_profile_id IS NULL AND p_fingerprint IS NOT NULL THEN
        -- Read configurable limit from platform_config (default 7)
        SELECT COALESCE(value::INT, 7) INTO v_anon_limit
        FROM platform_config WHERE key = 'anon_weekly_vote_limit';
        IF v_anon_limit IS NULL THEN v_anon_limit := 7; END IF;

        SELECT COUNT(*) INTO v_anon_count
        FROM logs
        WHERE fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '7 days';

        IF v_anon_count >= v_anon_limit THEN
            RETURN jsonb_build_object('error', 'anonymous_weekly_limit', 'limit', v_anon_limit);
        END IF;
    END IF;

    -- ── 24-Hour same-business cooldown ────────────────────
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_cooldown_count
        FROM logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at >= NOW() - INTERVAL '24 hours';
    ELSE
        SELECT COUNT(*) INTO v_cooldown_count
        FROM logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '24 hours';
    END IF;

    IF v_cooldown_count > 0 THEN
        RETURN jsonb_build_object('error', 'cooldown_active');
    END IF;

    -- ── Tier multiplier ──────────────────────────────────
    IF p_profile_id IS NULL THEN
        v_tier_multiplier := 0.2;  -- Anonymous
    ELSE
        SELECT gader_points, vip_tier
        INTO v_gader_points, v_vip_tier
        FROM profiles WHERE id = p_profile_id;

        -- From VIP tier string
        v_tier_multiplier := 1.0;  -- Bronze default
        IF LOWER(COALESCE(v_vip_tier, '')) LIKE '%vip%'
           OR LOWER(COALESCE(v_vip_tier, '')) LIKE '%diamond%' THEN
            v_tier_multiplier := 2.5;
        ELSIF LOWER(COALESCE(v_vip_tier, '')) LIKE '%gold%' THEN
            v_tier_multiplier := 2.0;
        ELSIF LOWER(COALESCE(v_vip_tier, '')) LIKE '%silver%' THEN
            v_tier_multiplier := 1.5;
        END IF;

        -- From Gader points (take the higher)
        v_points_from_tier := 1.0;
        IF COALESCE(v_gader_points, 0) >= 20000 THEN
            v_points_from_tier := 2.5;
        ELSIF COALESCE(v_gader_points, 0) >= 5000 THEN
            v_points_from_tier := 2.0;
        ELSIF COALESCE(v_gader_points, 0) >= 1000 THEN
            v_points_from_tier := 1.5;
        END IF;

        v_tier_multiplier := GREATEST(v_tier_multiplier, v_points_from_tier);
    END IF;

    -- ── Diminishing returns (30-day same-business count) ──
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_past_count
        FROM logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at >= NOW() - INTERVAL '30 days';
    ELSE
        SELECT COUNT(*) INTO v_past_count
        FROM logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '30 days';
    END IF;

    IF v_past_count <= 0 THEN
        v_diminishing := 1.0;
    ELSIF v_past_count = 1 THEN
        v_diminishing := 0.5;
    ELSE
        v_diminishing := 0.25;
    END IF;

    -- ── Calculate final weight ───────────────────────────
    v_weight := ROUND(v_tier_multiplier * v_diminishing * 100) / 100;

    -- ── Insert log ───────────────────────────────────────
    INSERT INTO logs (
        business_id, interaction_type, reason_text,
        profile_id, fingerprint, weight, is_flagged
    )
    VALUES (
        p_business_id, p_interaction_type,
        CASE WHEN p_reason_text IS NOT NULL AND TRIM(p_reason_text) <> ''
             THEN TRIM(p_reason_text) ELSE NULL END,
        p_profile_id, p_fingerprint, v_weight, p_is_flagged
    )
    RETURNING id, created_at INTO v_inserted_id, v_inserted_at;

    -- ── Award Gader points (verified users only) ─────────
    v_earned_points := GREATEST(5, LEAST(25, ROUND(v_weight * 10)));
    v_new_points := NULL;

    IF p_profile_id IS NOT NULL THEN
        UPDATE profiles
        SET gader_points = GREATEST(COALESCE(gader_points, 0) + v_earned_points, 0)
        WHERE id = p_profile_id
        RETURNING gader_points INTO v_new_points;

        -- ── Phase 4: Coupon Engine Logic ───────────────────
        IF v_new_points >= 50 THEN
            DECLARE
                v_weekly_logs INT;
                v_difficulty INT;
                v_coupons_this_week INT;
                v_threshold INT;
                v_selected_campaign_id UUID;
                v_business_name TEXT;
                v_discount_val NUMERIC;
                v_offer_type TEXT;
                v_serial TEXT;
            BEGIN
                SELECT weekly_log_count, coupon_difficulty_level, coupons_earned_this_week
                INTO v_weekly_logs, v_difficulty, v_coupons_this_week
                FROM profiles WHERE id = p_profile_id;

                -- Cap at 2 per week (Phase 4b)
                IF COALESCE(v_coupons_this_week, 0) < 2 THEN
                    v_threshold := 3 + COALESCE(v_difficulty, 1);

                    IF COALESCE(v_weekly_logs, 0) + 1 >= v_threshold THEN
                        -- Phase 4c & 4d: Find campaign with tier logic and prefer unvoted
                        SELECT mc.id, b.name, mc.discount_value, mc.offer_type
                        INTO v_selected_campaign_id, v_business_name, v_discount_val, v_offer_type
                        FROM merchant_coupons mc
                        JOIN businesses b ON b.id = mc.business_id
                        WHERE mc.status = 'active'
                          AND mc.remaining_quantity > 0
                          AND mc.distribution_rule = 'PUBLIC_POOL'
                          AND (
                              mc.target_tier = 'ALL' OR
                              (mc.target_tier = 'VIP_ONLY' AND v_new_points >= 20000) OR
                              (mc.target_tier = 'GOLD_ONLY' AND v_new_points >= 5000) OR
                              (mc.target_tier = 'SILVER_ONLY' AND v_new_points >= 1000) OR
                              (mc.target_tier = 'BRONZE_ONLY' AND v_new_points < 1000)
                          )
                        ORDER BY 
                          (EXISTS (SELECT 1 FROM logs l WHERE l.business_id = mc.business_id AND l.profile_id = p_profile_id)) ASC,
                          (EXISTS (SELECT 1 FROM user_coupons uc JOIN merchant_coupons mc2 ON uc.campaign_id = mc2.id WHERE mc2.business_id = mc.business_id AND uc.user_id = p_profile_id AND uc.status = 'REDEEMED')) ASC,
                          RANDOM()
                        LIMIT 1;

                        IF v_selected_campaign_id IS NOT NULL THEN
                            v_serial := generate_coupon_serial(v_business_name);
                            
                            INSERT INTO user_coupons (campaign_id, user_id, serial_code, source, status, valid_until)
                            VALUES (v_selected_campaign_id, p_profile_id, v_serial, 'POOL', 'ACTIVE', NOW() + INTERVAL '30 days');

                            UPDATE merchant_coupons 
                            SET remaining_quantity = remaining_quantity - 1,
                                claimed_count = COALESCE(claimed_count, 0) + 1
                            WHERE id = v_selected_campaign_id;

                            INSERT INTO coupon_audit_log (coupon_id, profile_id, business_id, serial_code, trigger_type, difficulty_level, weight_at_creation)
                            VALUES (v_selected_campaign_id, p_profile_id, p_business_id, v_serial, 'vote_reward', v_difficulty, v_weight);

                            UPDATE profiles SET
                                weekly_log_count = 0,
                                coupon_difficulty_level = COALESCE(coupon_difficulty_level, 1) + 1,
                                coupons_earned_this_week = COALESCE(coupons_earned_this_week, 0) + 1
                            WHERE id = p_profile_id;
                            
                            v_coupon_awarded := jsonb_build_object(
                                'campaign_id', v_selected_campaign_id, 
                                'serial', v_serial, 
                                'business', v_business_name,
                                'discount_value', v_discount_val,
                                'offer_type', v_offer_type
                            );
                        ELSE
                            UPDATE profiles SET weekly_log_count = COALESCE(weekly_log_count, 0) + 1 WHERE id = p_profile_id;
                        END IF;
                    ELSE
                        UPDATE profiles SET weekly_log_count = COALESCE(weekly_log_count, 0) + 1 WHERE id = p_profile_id;
                    END IF;
                ELSE
                    UPDATE profiles SET weekly_log_count = COALESCE(weekly_log_count, 0) + 1 WHERE id = p_profile_id;
                END IF;
            END;
        END IF;

    END IF;

    -- ── Return result ────────────────────────────────────
    RETURN jsonb_build_object(
        'success', true,
        'log_id', v_inserted_id,
        'created_at', v_inserted_at,
        'interaction_type', p_interaction_type,
        'reason_text', p_reason_text,
        'profile_id', p_profile_id,
        'fingerprint', p_fingerprint,
        'weight', v_weight,
        'is_flagged', p_is_flagged,
        'earned_points', v_earned_points,
        'new_gader_total', v_new_points,
        'past_vote_count', v_past_count,
        'coupon_awarded', v_coupon_awarded
    );
END;
$$;
-- ============================================================
-- HOTFIX: Fix submit_vote v_inserted_id type UUID → BIGINT
--
-- Root Cause: logs.id is BIGINT (auto-increment identity),
-- but submit_vote declared v_inserted_id as UUID.
-- PostgreSQL cannot cast integer 32/35/36 to UUID.
--
-- Fix: Change v_inserted_id to BIGINT. All other logic unchanged.
-- ============================================================

CREATE OR REPLACE FUNCTION submit_vote(
    p_business_id UUID,
    p_interaction_type TEXT,
    p_reason_text TEXT DEFAULT NULL,
    p_profile_id UUID DEFAULT NULL,
    p_fingerprint TEXT DEFAULT NULL,
    p_is_flagged BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier_multiplier NUMERIC;
    v_diminishing NUMERIC;
    v_weight NUMERIC;
    v_past_count INT;
    v_gader_points INT;
    v_vip_tier TEXT;
    v_points_from_tier NUMERIC;
    v_inserted_id BIGINT;          -- ✅ FIXED: was UUID, logs.id is BIGINT
    v_inserted_at TIMESTAMPTZ;
    v_earned_points INT;
    v_new_points INT;
    v_cooldown_count INT;
    v_anon_count INT;
    v_anon_limit INT;
    v_role TEXT;
    v_coupon_awarded JSONB := NULL;
BEGIN
    -- ── Validate inputs ──────────────────────────────────
    IF p_interaction_type NOT IN ('recommend', 'complain') THEN
        RETURN jsonb_build_object('error', 'Invalid interaction_type');
    END IF;

    IF p_business_id IS NULL THEN
        RETURN jsonb_build_object('error', 'business_id is required');
    END IF;

    -- ── Block merchant accounts ──────────────────────────
    IF p_profile_id IS NOT NULL THEN
        SELECT role INTO v_role FROM profiles WHERE id = p_profile_id;
        IF v_role = 'merchant' THEN
            RETURN jsonb_build_object('error', 'Merchant accounts cannot vote');
        END IF;
    END IF;

    -- ── Anonymous global limit: configurable per week ─────
    IF p_profile_id IS NULL AND p_fingerprint IS NOT NULL THEN
        -- Read configurable limit from platform_config (default 7)
        SELECT COALESCE(value::INT, 7) INTO v_anon_limit
        FROM platform_config WHERE key = 'anon_weekly_vote_limit';
        IF v_anon_limit IS NULL THEN v_anon_limit := 7; END IF;

        SELECT COUNT(*) INTO v_anon_count
        FROM logs
        WHERE fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '7 days';

        IF v_anon_count >= v_anon_limit THEN
            RETURN jsonb_build_object('error', 'anonymous_weekly_limit', 'limit', v_anon_limit);
        END IF;
    END IF;

    -- ── 24-Hour same-business cooldown ────────────────────
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_cooldown_count
        FROM logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at >= NOW() - INTERVAL '24 hours';
    ELSE
        SELECT COUNT(*) INTO v_cooldown_count
        FROM logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '24 hours';
    END IF;

    IF v_cooldown_count > 0 THEN
        RETURN jsonb_build_object('error', 'cooldown_active');
    END IF;

    -- ── Tier multiplier ──────────────────────────────────
    IF p_profile_id IS NULL THEN
        v_tier_multiplier := 0.2;  -- Anonymous
    ELSE
        SELECT gader_points, vip_tier
        INTO v_gader_points, v_vip_tier
        FROM profiles WHERE id = p_profile_id;

        -- From VIP tier string
        v_tier_multiplier := 1.0;  -- Bronze default
        IF LOWER(COALESCE(v_vip_tier, '')) LIKE '%vip%'
           OR LOWER(COALESCE(v_vip_tier, '')) LIKE '%diamond%' THEN
            v_tier_multiplier := 2.5;
        ELSIF LOWER(COALESCE(v_vip_tier, '')) LIKE '%gold%' THEN
            v_tier_multiplier := 2.0;
        ELSIF LOWER(COALESCE(v_vip_tier, '')) LIKE '%silver%' THEN
            v_tier_multiplier := 1.5;
        END IF;

        -- From Gader points (take the higher)
        v_points_from_tier := 1.0;
        IF COALESCE(v_gader_points, 0) >= 20000 THEN
            v_points_from_tier := 2.5;
        ELSIF COALESCE(v_gader_points, 0) >= 5000 THEN
            v_points_from_tier := 2.0;
        ELSIF COALESCE(v_gader_points, 0) >= 1000 THEN
            v_points_from_tier := 1.5;
        END IF;

        v_tier_multiplier := GREATEST(v_tier_multiplier, v_points_from_tier);
    END IF;

    -- ── Diminishing returns (30-day same-business count) ──
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_past_count
        FROM logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at >= NOW() - INTERVAL '30 days';
    ELSE
        SELECT COUNT(*) INTO v_past_count
        FROM logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '30 days';
    END IF;

    IF v_past_count <= 0 THEN
        v_diminishing := 1.0;
    ELSIF v_past_count = 1 THEN
        v_diminishing := 0.5;
    ELSE
        v_diminishing := 0.25;
    END IF;

    -- ── Calculate final weight ───────────────────────────
    v_weight := ROUND(v_tier_multiplier * v_diminishing * 100) / 100;

    -- ── Insert log ───────────────────────────────────────
    INSERT INTO logs (
        business_id, interaction_type, reason_text,
        profile_id, fingerprint, weight, is_flagged
    )
    VALUES (
        p_business_id, p_interaction_type,
        CASE WHEN p_reason_text IS NOT NULL AND TRIM(p_reason_text) <> ''
             THEN TRIM(p_reason_text) ELSE NULL END,
        p_profile_id, p_fingerprint, v_weight, p_is_flagged
    )
    RETURNING id, created_at INTO v_inserted_id, v_inserted_at;

    -- ── Award Gader points (verified users only) ─────────
    v_earned_points := GREATEST(5, LEAST(25, ROUND(v_weight * 10)));
    v_new_points := NULL;

    IF p_profile_id IS NOT NULL THEN
        UPDATE profiles
        SET gader_points = GREATEST(COALESCE(gader_points, 0) + v_earned_points, 0)
        WHERE id = p_profile_id
        RETURNING gader_points INTO v_new_points;

        -- ── Phase 4: Coupon Engine Logic ───────────────────
        IF v_new_points >= 50 THEN
            DECLARE
                v_weekly_logs INT;
                v_difficulty INT;
                v_coupons_this_week INT;
                v_threshold INT;
                v_selected_campaign_id UUID;
                v_business_name TEXT;
                v_discount_val NUMERIC;
                v_offer_type TEXT;
                v_serial TEXT;
            BEGIN
                SELECT weekly_log_count, coupon_difficulty_level, coupons_earned_this_week
                INTO v_weekly_logs, v_difficulty, v_coupons_this_week
                FROM profiles WHERE id = p_profile_id;

                -- Cap at 2 per week (Phase 4b)
                IF COALESCE(v_coupons_this_week, 0) < 2 THEN
                    v_threshold := 3 + COALESCE(v_difficulty, 1);

                    IF COALESCE(v_weekly_logs, 0) + 1 >= v_threshold THEN
                        -- Phase 4c & 4d: Find campaign with tier logic and prefer unvoted
                        SELECT mc.id, b.name, mc.discount_value, mc.offer_type
                        INTO v_selected_campaign_id, v_business_name, v_discount_val, v_offer_type
                        FROM merchant_coupons mc
                        JOIN businesses b ON b.id = mc.business_id
                        WHERE mc.status = 'active'
                          AND mc.remaining_quantity > 0
                          AND mc.distribution_rule = 'PUBLIC_POOL'
                          AND (
                              mc.target_tier = 'ALL' OR
                              (mc.target_tier = 'VIP_ONLY' AND v_new_points >= 20000) OR
                              (mc.target_tier = 'GOLD_ONLY' AND v_new_points >= 5000) OR
                              (mc.target_tier = 'SILVER_ONLY' AND v_new_points >= 1000) OR
                              (mc.target_tier = 'BRONZE_ONLY' AND v_new_points < 1000)
                          )
                        ORDER BY 
                          (EXISTS (SELECT 1 FROM logs l WHERE l.business_id = mc.business_id AND l.profile_id = p_profile_id)) ASC,
                          (EXISTS (SELECT 1 FROM user_coupons uc JOIN merchant_coupons mc2 ON uc.campaign_id = mc2.id WHERE mc2.business_id = mc.business_id AND uc.user_id = p_profile_id AND uc.status = 'REDEEMED')) ASC,
                          RANDOM()
                        LIMIT 1;

                        IF v_selected_campaign_id IS NOT NULL THEN
                            v_serial := generate_coupon_serial(v_business_name);
                            
                            INSERT INTO user_coupons (campaign_id, user_id, serial_code, source, status, valid_until)
                            VALUES (v_selected_campaign_id, p_profile_id, v_serial, 'POOL', 'ACTIVE', NOW() + INTERVAL '30 days');

                            UPDATE merchant_coupons 
                            SET remaining_quantity = remaining_quantity - 1,
                                claimed_count = COALESCE(claimed_count, 0) + 1
                            WHERE id = v_selected_campaign_id;

                            INSERT INTO coupon_audit_log (coupon_id, profile_id, business_id, serial_code, trigger_type, difficulty_level, weight_at_creation)
                            VALUES (v_selected_campaign_id, p_profile_id, p_business_id, v_serial, 'vote_reward', v_difficulty, v_weight);

                            UPDATE profiles SET
                                weekly_log_count = 0,
                                coupon_difficulty_level = COALESCE(coupon_difficulty_level, 1) + 1,
                                coupons_earned_this_week = COALESCE(coupons_earned_this_week, 0) + 1
                            WHERE id = p_profile_id;
                            
                            v_coupon_awarded := jsonb_build_object(
                                'campaign_id', v_selected_campaign_id, 
                                'serial', v_serial, 
                                'business', v_business_name,
                                'discount_value', v_discount_val,
                                'offer_type', v_offer_type
                            );
                        ELSE
                            UPDATE profiles SET weekly_log_count = COALESCE(weekly_log_count, 0) + 1 WHERE id = p_profile_id;
                        END IF;
                    ELSE
                        UPDATE profiles SET weekly_log_count = COALESCE(weekly_log_count, 0) + 1 WHERE id = p_profile_id;
                    END IF;
                ELSE
                    UPDATE profiles SET weekly_log_count = COALESCE(weekly_log_count, 0) + 1 WHERE id = p_profile_id;
                END IF;
            END;
        END IF;

    END IF;

    -- ── Return result ────────────────────────────────────
    RETURN jsonb_build_object(
        'success', true,
        'log_id', v_inserted_id,
        'created_at', v_inserted_at,
        'interaction_type', p_interaction_type,
        'reason_text', p_reason_text,
        'profile_id', p_profile_id,
        'fingerprint', p_fingerprint,
        'weight', v_weight,
        'is_flagged', p_is_flagged,
        'earned_points', v_earned_points,
        'new_gader_total', v_new_points,
        'past_vote_count', v_past_count,
        'coupon_awarded', v_coupon_awarded
    );
END;
$$;
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
-- ============================================================
-- HOTFIX: Fix Subscription Status Case Mismatch in RPCs
--
-- Root Cause: RPCs query status = 'active' (lowercase)
-- but all inserts/admin actions use 'Active' (capitalized).
-- This makes Pro/Enterprise merchants invisible to tier checks.
--
-- Also fixes admin_confirm_payment conflict target:
-- was ON CONFLICT (business_id), now ON CONFLICT (profile_id)
-- to match the UNIQUE constraint added in migration 000500.
-- ============================================================

-- 1. Fix enforce_subscription_campaign_limits
--    Changes: status = 'active' → status = 'Active'
CREATE OR REPLACE FUNCTION enforce_subscription_campaign_limits(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_merchant_id UUID;
    v_active_campaigns INTEGER;
    v_sub_tier TEXT;
BEGIN
    -- Get the merchant who claimed the business
    SELECT claimed_by INTO v_merchant_id FROM public.businesses WHERE id = p_business_id;
    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Business not claimed');
    END IF;

    -- Get merchant's subscription tier (FIXED: status case)
    SELECT tier INTO v_sub_tier
    FROM public.subscriptions
    WHERE profile_id = v_merchant_id
      AND status IN ('Active', 'Expiring Soon', 'Grace Period');
    v_sub_tier := COALESCE(v_sub_tier, 'Free');

    -- Count their active campaigns
    SELECT COUNT(*) INTO v_active_campaigns
    FROM public.merchant_coupons
    WHERE business_id = p_business_id AND status = 'active';

    -- Apply Tier Logic
    -- Free: 0 active loyalty campaigns allowed
    -- Pro: 1 active campaign
    -- Enterprise: Unlimited

    IF v_sub_tier = 'Free' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Free tier merchants cannot create loyalty campaigns. Please upgrade to Pro.');
    END IF;

    IF v_sub_tier = 'Pro' AND v_active_campaigns >= 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pro tier merchants are limited to 1 active loyalty campaign per business. Please pause your current campaign or upgrade to Enterprise.');
    END IF;

    -- Enterprise or valid Pro allowed
    RETURN jsonb_build_object('success', true);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Fix award_scan_points
--    Changes: status = 'active' → status = 'Active'
CREATE OR REPLACE FUNCTION award_scan_points(p_user_id UUID, p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_interactions_today INTEGER;
    v_same_business_today INTEGER;
    v_sub_tier TEXT;
    v_merchant_id UUID;
    v_pts_to_award INTEGER;
    v_must_give_coupon BOOLEAN := false;
BEGIN
    -- Get the merchant who claimed the business
    SELECT claimed_by INTO v_merchant_id FROM public.businesses WHERE id = p_business_id;

    -- 1. Anti-Fraud Rule A: 24h per-business limit
    SELECT COUNT(*) INTO v_same_business_today
    FROM public.business_interactions
    WHERE profile_id = p_user_id
      AND business_id = p_business_id
      AND created_at > (NOW() - INTERVAL '24 hours');

    IF v_same_business_today > 0 THEN
         RETURN jsonb_build_object('success', false, 'error', 'You have already scanned this business today.');
    END IF;

    -- 2. Anti-Fraud Rule B: 1/day cap across all businesses
    SELECT COUNT(*) INTO v_interactions_today
    FROM public.business_interactions
    WHERE profile_id = p_user_id
      AND created_at > (NOW() - INTERVAL '24 hours');

    IF v_interactions_today >= 1 THEN
         RETURN jsonb_build_object('success', false, 'error', 'You have reached your daily maximum of 1 scan.');
    END IF;

    -- 3. Determine points based on business tier (FIXED: status case)
    SELECT tier INTO v_sub_tier
    FROM public.subscriptions
    WHERE profile_id = v_merchant_id
      AND status IN ('Active', 'Expiring Soon', 'Grace Period');
    v_sub_tier := COALESCE(v_sub_tier, 'Free');

    IF v_sub_tier = 'Enterprise' THEN
        v_pts_to_award := 30;
        v_must_give_coupon := true;
    ELSIF v_sub_tier = 'Pro' THEN
        v_pts_to_award := 15;
    ELSE
        v_pts_to_award := 5; -- Free tier
    END IF;

    -- 4. Insert scan record
    INSERT INTO public.business_interactions (business_id, profile_id, interaction_type)
    VALUES (p_business_id, p_user_id, 'scan');

    -- 5. Give points to user
    UPDATE public.profiles
    SET gader_points = COALESCE(gader_points, 0) + v_pts_to_award
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'points_awarded', v_pts_to_award,
        'business_tier', v_sub_tier,
        'must_receive_coupon', v_must_give_coupon
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Fix admin_confirm_payment
--    Changes: ON CONFLICT (business_id) → ON CONFLICT (profile_id)
--    This aligns with the UNIQUE(profile_id) added in migration 000500.
CREATE OR REPLACE FUNCTION admin_confirm_payment(p_txn_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_tier TEXT;
    v_duration TEXT;
    v_owner_id UUID;
    v_days INTEGER;
    v_addon_type TEXT;
BEGIN
    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Get transaction details
    SELECT business_id, requested_tier, duration, owner_id
    INTO v_business_id, v_tier, v_duration, v_owner_id
    FROM public.transactions
    WHERE id = p_txn_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending transaction not found';
    END IF;

    -- Map duration to days
    IF v_duration = '30 Days' OR v_duration = '1 Month' THEN v_days := 30;
    ELSIF v_duration = '90 Days' THEN v_days := 90;
    ELSIF v_duration = '365 Days' OR v_duration = '1 Year' THEN v_days := 365;
    ELSE v_days := 30;
    END IF;

    -- Mark transaction as completed
    UPDATE public.transactions SET status = 'completed' WHERE id = p_txn_id;

    -- Check if it is an Addon Purchase
    IF v_tier LIKE '%Addon%' THEN
        -- Extract addon type (e.g., 'Shield Addon' -> 'shield')
        v_addon_type := lower(split_part(v_tier, ' ', 1));

        INSERT INTO public.merchant_addons (profile_id, addon_type, quantity, status, expires_at)
        VALUES (v_owner_id, v_addon_type, 1, 'active', now() + (v_days || ' days')::interval);

        INSERT INTO public.feature_allocations (profile_id, business_id, feature_type, status)
        VALUES (v_owner_id, v_business_id, v_addon_type, 'active')
        ON CONFLICT (profile_id, business_id, feature_type)
        DO UPDATE SET status = 'active';

    ELSE
        -- Tier Upgrade: upsert subscription keyed on profile_id (FIXED)
        INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at)
        VALUES (v_business_id, v_owner_id, v_tier, 'Active', now() + (v_days || ' days')::interval)
        ON CONFLICT (profile_id)
        DO UPDATE SET
            tier = EXCLUDED.tier,
            status = 'Active',
            expires_at = EXCLUDED.expires_at,
            business_id = EXCLUDED.business_id;

        -- Update business shield_level if tying Tier to Shield
        UPDATE public.businesses
        SET shield_level = CASE WHEN v_tier = 'Enterprise' THEN 2 ELSE 1 END
        WHERE id = v_business_id;
    END IF;

    -- Log to audit trail
    INSERT INTO public.payment_audit_log (transaction_id, action, performed_by, details)
    VALUES (p_txn_id, 'confirmed', auth.uid(),
            jsonb_build_object('tier', v_tier, 'duration_days', v_days, 'owner_id', v_owner_id));

END;
$$;
-- ============================================================
-- Migration: Fix Subscription RLS & Admin Confirm Target
-- Addresses GAP 1 and GAP 3 of Tier Upgrade Workflow Specs
-- ============================================================

-- ------------------------------------------------------------
-- GAP 1: Subscription RLS Policy (Critical)
-- The system uses profile-centric subscriptions (profile_id).
-- ------------------------------------------------------------

-- 1. Drop the old business-centric SELECT policy
DROP POLICY IF EXISTS "Merchants can view their subscriptions" ON public.subscriptions;

-- 2. Create a profile-centric SELECT policy
CREATE POLICY "Merchants can view their subscriptions"
    ON public.subscriptions FOR SELECT
    USING (profile_id = auth.uid());

-- 3. Add UPDATE policy so merchants can update their own subscription
--    (needed for client-side expiry fallback)
DROP POLICY IF EXISTS "Merchants can update their subscriptions" ON public.subscriptions;
CREATE POLICY "Merchants can update their subscriptions"
    ON public.subscriptions FOR UPDATE
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- 4. Add INSERT policy so the freebie tier upsert works
DROP POLICY IF EXISTS "Merchants can insert their subscriptions" ON public.subscriptions;
CREATE POLICY "Merchants can insert their subscriptions"
    ON public.subscriptions FOR INSERT
    WITH CHECK (profile_id = auth.uid());

-- 5. Ensure admin full access also includes super_admin
DROP POLICY IF EXISTS "Admins have full access to subscriptions" ON public.subscriptions;
CREATE POLICY "Admins have full access to subscriptions"
    ON public.subscriptions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );


-- ------------------------------------------------------------
-- GAP 3: admin_confirm_payment RPC Conflict Target (Critical)
-- Uses ON CONFLICT (profile_id) instead of (business_id)
-- ------------------------------------------------------------

-- Drop the old UNIQUE(business_id) constraint on subscriptions if it exists.
-- The system is now profile-centric: UNIQUE(profile_id) is the canonical key.
ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_business_id_key;

-- Re-create admin_confirm_payment with correct conflict target
CREATE OR REPLACE FUNCTION admin_confirm_payment(p_txn_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_tier TEXT;
    v_duration TEXT;
    v_owner_id UUID;
    v_days INTEGER;
    v_addon_type TEXT;
    v_admin_id UUID;
    v_amount NUMERIC;
    v_currency TEXT;
    v_gateway TEXT;
BEGIN
    v_admin_id := auth.uid();

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT business_id, requested_tier, duration, owner_id, amount, currency, payment_gateway
    INTO v_business_id, v_tier, v_duration, v_owner_id, v_amount, v_currency, v_gateway
    FROM public.transactions
    WHERE id = p_txn_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending transaction not found';
    END IF;

    IF v_duration = '30 Days' OR v_duration = '1 Month' THEN v_days := 30;
    ELSIF v_duration = '90 Days' OR v_duration = '3 Months' THEN v_days := 90;
    ELSIF v_duration = '365 Days' OR v_duration = '1 Year' THEN v_days := 365;
    ELSE v_days := 30;
    END IF;

    UPDATE public.transactions
    SET status = 'completed',
        confirmed_by = v_admin_id,
        confirmed_at = NOW()
    WHERE id = p_txn_id;

    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, metadata)
    VALUES (
        'transaction', p_txn_id, 'approved', 'pending', 'completed', v_admin_id,
        jsonb_build_object('amount', v_amount, 'currency', v_currency, 'gateway', v_gateway, 'tier', v_tier)
    );

    IF v_tier LIKE '%Addon%' THEN
        v_addon_type := lower(split_part(v_tier, ' ', 1));

        INSERT INTO public.merchant_addons (profile_id, addon_type, quantity, status, expires_at)
        VALUES (v_owner_id, v_addon_type, 1, 'active', now() + (v_days || ' days')::interval);

        INSERT INTO public.feature_allocations (profile_id, business_id, feature_type, status)
        VALUES (v_owner_id, v_business_id, v_addon_type, 'active')
        ON CONFLICT (profile_id, business_id, feature_type)
        DO UPDATE SET status = 'active';
    ELSE
        -- FIXED: ON CONFLICT (profile_id) instead of (business_id)
        INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at)
        VALUES (v_business_id, v_owner_id, v_tier, 'Active', now() + (v_days || ' days')::interval)
        ON CONFLICT (profile_id)
        DO UPDATE SET
            tier = EXCLUDED.tier,
            status = 'Active',
            expires_at = EXCLUDED.expires_at,
            business_id = EXCLUDED.business_id;

        INSERT INTO public.payment_audit_log (entity_type, entity_id, action, new_status, performed_by, metadata)
        VALUES (
            'subscription', v_business_id, 'activated', 'Active', v_admin_id,
            jsonb_build_object('tier', v_tier, 'days', v_days, 'source_txn', p_txn_id)
        );
    END IF;
END;
$$;
-- ============================================================
-- Hotfix: Transactions RLS — include super_admin
-- Root cause: admin user has role 'super_admin' but the
-- transactions RLS policy only checks role = 'admin'.
-- This silently hides ALL pending upgrade requests from the
-- Admin Financials Transfer Queue.
-- ============================================================

-- 1. Drop and recreate the admin policy on transactions
DROP POLICY IF EXISTS "Admins have full access to transactions" ON public.transactions;
CREATE POLICY "Admins have full access to transactions"
    ON public.transactions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- 2. Also fix the requested_tier CHECK constraint.
--    The original constraint only allows ('Tier 1', 'Tier 2')
--    but merchants now submit dynamic tier names like 'Pro', 'Enterprise', etc.
--    Drop old constraint and add a permissive one.
DO $$
DECLARE
    const_name text;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%requested_tier%';

    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.transactions DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- No constraint needed — tier names are now dynamic from subscription_tiers table.

-- 3. Audit: Also fix payment_audit_log admin policy if it only checks 'admin'
DROP POLICY IF EXISTS "Admins can read audit log" ON public.payment_audit_log;
CREATE POLICY "Admins can read audit log"
    ON public.payment_audit_log FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

DROP POLICY IF EXISTS "Admins can insert audit log" ON public.payment_audit_log;
CREATE POLICY "Admins can insert audit log"
    ON public.payment_audit_log FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );
-- ============================================================
-- Migration: Merchant Billing — Quota Sync + RLS + Gateway Hook
-- Addresses GAPs 1, 3, 5, 6 of Merchant Billing Implementation Plan
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- GAP 1 + 3: admin_confirm_payment WITH quota sync from subscription_tiers
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_confirm_payment(p_txn_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_tier TEXT;
    v_duration TEXT;
    v_owner_id UUID;
    v_days INTEGER;
    v_addon_type TEXT;
    v_admin_id UUID;
    v_amount NUMERIC;
    v_currency TEXT;
    v_gateway TEXT;
    v_quotas JSONB;
BEGIN
    v_admin_id := auth.uid();

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT business_id, requested_tier, duration, owner_id, amount, currency, payment_gateway
    INTO v_business_id, v_tier, v_duration, v_owner_id, v_amount, v_currency, v_gateway
    FROM public.transactions
    WHERE id = p_txn_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending transaction not found';
    END IF;

    IF v_duration = '30 Days' OR v_duration = '1 Month' THEN v_days := 30;
    ELSIF v_duration = '90 Days' OR v_duration = '3 Months' THEN v_days := 90;
    ELSIF v_duration = '365 Days' OR v_duration = '1 Year' THEN v_days := 365;
    ELSE v_days := 30;
    END IF;

    -- ── NEW: Lookup tier allocations from subscription_tiers ──
    SELECT allocations INTO v_quotas
    FROM public.subscription_tiers
    WHERE name = v_tier
    LIMIT 1;

    -- Defensive fallback: if tier not found, use empty quotas
    IF v_quotas IS NULL THEN
        v_quotas := '{}'::jsonb;
    END IF;

    -- Mark transaction as completed
    UPDATE public.transactions
    SET status = 'completed',
        confirmed_by = v_admin_id,
        confirmed_at = NOW()
    WHERE id = p_txn_id;

    -- Audit log for transaction approval
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, metadata)
    VALUES (
        'transaction', p_txn_id, 'approved', 'pending', 'completed', v_admin_id,
        jsonb_build_object('amount', v_amount, 'currency', v_currency, 'gateway', v_gateway, 'tier', v_tier)
    );

    IF v_tier LIKE '%Addon%' THEN
        v_addon_type := lower(split_part(v_tier, ' ', 1));

        INSERT INTO public.merchant_addons (profile_id, addon_type, quantity, status, expires_at)
        VALUES (v_owner_id, v_addon_type, 1, 'active', now() + (v_days || ' days')::interval);

        INSERT INTO public.feature_allocations (profile_id, business_id, feature_type, status)
        VALUES (v_owner_id, v_business_id, v_addon_type, 'active')
        ON CONFLICT (profile_id, business_id, feature_type)
        DO UPDATE SET status = 'active';
    ELSE
        -- ── FIXED: Upsert subscription WITH quotas ──
        INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at, quotas)
        VALUES (v_business_id, v_owner_id, v_tier, 'Active', now() + (v_days || ' days')::interval, v_quotas)
        ON CONFLICT (profile_id)
        DO UPDATE SET
            tier = EXCLUDED.tier,
            status = 'Active',
            expires_at = EXCLUDED.expires_at,
            business_id = EXCLUDED.business_id,
            quotas = EXCLUDED.quotas;

        -- ── NEW: Seed base feature_allocations for the tier ──
        -- These are inactive by default; merchant activates via Settings toggles
        INSERT INTO public.feature_allocations (profile_id, business_id, feature_type, status)
        VALUES
            (v_owner_id, v_business_id, 'shield', 'inactive'),
            (v_owner_id, v_business_id, 'storefront', 'inactive')
        ON CONFLICT (profile_id, business_id, feature_type) DO NOTHING;

        -- Subscription activation audit log
        INSERT INTO public.payment_audit_log (entity_type, entity_id, action, new_status, performed_by, metadata)
        VALUES (
            'subscription', v_business_id, 'activated', 'Active', v_admin_id,
            jsonb_build_object('tier', v_tier, 'days', v_days, 'source_txn', p_txn_id, 'quotas', v_quotas)
        );
    END IF;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- GAP 6: payment_audit_log — Merchant-facing SELECT policy
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Merchants can view their payment audit" ON public.payment_audit_log;
CREATE POLICY "Merchants can view their payment audit"
    ON public.payment_audit_log FOR SELECT
    USING (
        entity_type = 'transaction'
        AND entity_id IN (
            SELECT id FROM public.transactions WHERE owner_id = auth.uid()
        )
    );


-- ────────────────────────────────────────────────────────────
-- GAP 5: Payment gateway config seed in platform_config
-- ────────────────────────────────────────────────────────────

INSERT INTO public.platform_config (key, value)
VALUES (
    'payment_gateway_config',
    '{"enabled": false, "default_gateway": null, "gateways": {}}'::jsonb
)
ON CONFLICT (key) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- Ensure subscriptions.quotas column exists
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS quotas JSONB DEFAULT '{}'::jsonb;


-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: V2 RBAC Foundation
-- Task: W1-1 from Cross-Functional Accountability Matrix
-- Branch: feature/v2-subdomain-portals
--
-- Database State (verified via live Supabase query 2026-03-25):
--   ✅ All 25 tables exist (profiles, businesses, campaigns, etc.)
--   ✅ user_role ENUM exists with: user, merchant, admin, super_admin
--   ❌ assistant_admin and support_agent NOT in ENUM yet
--   ❌ is_platform_admin() does NOT exist
--   ❌ is_merchant() does NOT exist
--   Distinct roles in use: user, merchant, super_admin
--
-- Security Model:
--   Helper functions are SECURITY DEFINER + STABLE:
--   - Execute as function OWNER (bypasses RLS for role lookup)
--   - STABLE = result cached within a single SQL statement
--   - search_path = '' prevents schema injection (CWE-1321)
--
-- ⚠️  DOES NOT TOUCH profiles or logs RLS policies.
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. EXPAND THE ROLE ENUM
--    Add assistant_admin and support_agent.
--    super_admin already exists — guarded by IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'super_admin' AND enumtypid = 'public.user_role'::regtype) THEN
        ALTER TYPE public.user_role ADD VALUE 'super_admin';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'assistant_admin' AND enumtypid = 'public.user_role'::regtype) THEN
        ALTER TYPE public.user_role ADD VALUE 'assistant_admin';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'support_agent' AND enumtypid = 'public.user_role'::regtype) THEN
        ALTER TYPE public.user_role ADD VALUE 'support_agent';
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- 2. HELPER FUNCTION: is_platform_admin()
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('super_admin', 'admin', 'assistant_admin', 'support_agent')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon;

COMMENT ON FUNCTION public.is_platform_admin() IS
    'Central admin gate. Returns TRUE for super_admin, admin, assistant_admin, support_agent.';


-- ═══════════════════════════════════════════════════════════
-- 3. HELPER FUNCTION: is_merchant()
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_merchant()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'merchant'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_merchant() TO authenticated, anon;

COMMENT ON FUNCTION public.is_merchant() IS
    'Merchant portal gate. Returns TRUE if authenticated user has the merchant role.';


-- ═══════════════════════════════════════════════════════════
-- 4. HELPER FUNCTION: is_own_profile(profile_id)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_own_profile(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() = p_profile_id;
$$;

GRANT EXECUTE ON FUNCTION public.is_own_profile(UUID) TO authenticated, anon;


-- ═══════════════════════════════════════════════════════════
-- 5. RE-DRAFT RLS: business_claims
--    Tables confirmed to exist on live Supabase.
-- ═══════════════════════════════════════════════════════════

-- Drop ALL old policies (from both 20260222_schema.sql and 20260227_v2_portals_schema.sql)
DROP POLICY IF EXISTS "Users can view their own claims" ON public.business_claims;
DROP POLICY IF EXISTS "Admins can view all claims" ON public.business_claims;
DROP POLICY IF EXISTS "Allow users to read their own claims" ON public.business_claims;
DROP POLICY IF EXISTS "Allow users to insert their own claims" ON public.business_claims;

-- Merchants: view their own claims
CREATE POLICY "claim_select_own"
    ON public.business_claims FOR SELECT
    USING (auth.uid() = user_id);

-- Merchants: submit new claims
CREATE POLICY "claim_insert_own"
    ON public.business_claims FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins: view all claims (approval queue)
CREATE POLICY "claim_select_admin"
    ON public.business_claims FOR SELECT
    USING (public.is_platform_admin());

-- Admins: approve/reject claims
CREATE POLICY "claim_update_admin"
    ON public.business_claims FOR UPDATE
    USING (public.is_platform_admin());

-- Admins: delete claims (cleanup)
CREATE POLICY "claim_delete_admin"
    ON public.business_claims FOR DELETE
    USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════
-- 6. RE-DRAFT RLS: campaigns
--    Guarded: campaigns table may not exist on all environments.
--    Using EXECUTE inside DO block to avoid 42P01 on missing tables.
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'campaigns'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins have full access to campaigns" ON public.campaigns';
        EXECUTE 'DROP POLICY IF EXISTS "Merchants and users can view active campaigns" ON public.campaigns';

        EXECUTE '
            CREATE POLICY "campaign_all_admin"
                ON public.campaigns FOR ALL
                USING (public.is_platform_admin())
        ';

        EXECUTE '
            CREATE POLICY "campaign_select_active"
                ON public.campaigns FOR SELECT
                USING (status = ''active'')
        ';

        RAISE NOTICE 'campaigns RLS policies re-drafted with is_platform_admin()';
    ELSE
        RAISE NOTICE 'campaigns table does not exist — skipping policy draft';
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- 7. ROLE CORRUPTION GUARD TRIGGER
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    caller_role public.user_role;
BEGIN
    IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
        RETURN NEW;
    END IF;

    SELECT role INTO caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF caller_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Only super_admin can change user roles. Current role: %', caller_role;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_role_change ON public.profiles;
CREATE TRIGGER trg_guard_role_change
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_role_change();


-- ═══════════════════════════════════════════════════════════
-- 8. PARTIAL INDEXES FOR ROLE LOOKUPS
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_profiles_admin_roles
    ON public.profiles (id)
    WHERE role IN ('super_admin', 'admin', 'assistant_admin', 'support_agent');

CREATE INDEX IF NOT EXISTS idx_profiles_merchant_role
    ON public.profiles (id)
    WHERE role = 'merchant';


-- ═══════════════════════════════════════════════════════════
-- 9. SCHEMA CACHE RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: W1-2 — RLS/RPC Sweep
-- Replaces ALL inline role checks across existing tables
-- with is_platform_admin() and is_merchant() helpers.
--
-- DEPENDS ON: 20260325000100_v2_rbac_foundation.sql
--             (must create is_platform_admin() first)
--
-- Tables covered (25 confirmed via live Supabase query):
--   profiles, logs, businesses, interactions, business_claims,
--   pre_registrations, verified_users, otp_verifications,
--   subscriptions, transactions, payment_audit_log, merchant_addons,
--   feature_allocations, platform_config, subscription_tiers,
--   platform_coupon_pools, user_coupons, disputes, business_ribbons,
--   merchant_teams, trial_campaigns, storefronts, storefront_products,
--   r2_assets
--
-- ⚠️  profiles and logs RLS are NOT touched (E2E test safety).
-- ⚠️  business_claims already re-drafted in W1-1 — skipped here.
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- HELPER: safe_create_policy()
-- Wraps policy creation in EXECUTE so we can call it inside
-- a DO block with table existence checks.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION _temp_safe_policy(
    p_table TEXT,
    p_name TEXT,
    p_op TEXT,    -- SELECT, INSERT, UPDATE, DELETE, ALL
    p_using TEXT DEFAULT NULL,
    p_check TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    -- Drop if exists
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name, p_table);

    -- Build CREATE POLICY
    IF p_op = 'ALL' THEN
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL USING (%s)',
            p_name, p_table, p_using
        );
    ELSIF p_op = 'INSERT' THEN
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)',
            p_name, p_table, COALESCE(p_check, p_using)
        );
    ELSIF p_check IS NOT NULL THEN
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR %s USING (%s) WITH CHECK (%s)',
            p_name, p_table, p_op, p_using, p_check
        );
    ELSE
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR %s USING (%s)',
            p_name, p_table, p_op, p_using
        );
    END IF;
END;
$$;


-- ═══════════════════════════════════════════════════════════
-- 1. SUBSCRIPTIONS — Admin sees all, merchants see own
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subscriptions') THEN
        RAISE NOTICE 'subscriptions: table not found, skipping'; RETURN;
    END IF;

    -- Ensure RLS is enabled
    ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

    -- Drop old policies
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "Merchants can view own subscription" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "Admin full access subscriptions" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "sub_select_own" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "sub_select_admin" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "sub_all_admin" ON public.subscriptions';

    -- New policies
    PERFORM _temp_safe_policy('subscriptions', 'sub_select_own', 'SELECT', 'auth.uid() = profile_id');
    PERFORM _temp_safe_policy('subscriptions', 'sub_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'subscriptions: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 2. TRANSACTIONS — Admin sees all, merchants see own
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='transactions') THEN
        RAISE NOTICE 'transactions: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Merchants can view own transactions" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS "txn_select_own" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS "txn_select_admin" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS "txn_all_admin" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS "txn_insert_merchant" ON public.transactions';

    PERFORM _temp_safe_policy('transactions', 'txn_select_own', 'SELECT', 'auth.uid() = owner_id');
    PERFORM _temp_safe_policy('transactions', 'txn_insert_merchant', 'INSERT', NULL, 'auth.uid() = owner_id');
    PERFORM _temp_safe_policy('transactions', 'txn_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'transactions: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 3. PAYMENT_AUDIT_LOG — Admin + merchant (own txns only)
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payment_audit_log') THEN
        RAISE NOTICE 'payment_audit_log: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Admins can view audit log" ON public.payment_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "Merchants can view their payment audit" ON public.payment_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "pal_select_admin" ON public.payment_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "pal_select_merchant" ON public.payment_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "pal_all_admin" ON public.payment_audit_log';

    PERFORM _temp_safe_policy('payment_audit_log', 'pal_all_admin', 'ALL', 'public.is_platform_admin()');
    PERFORM _temp_safe_policy('payment_audit_log', 'pal_select_merchant', 'SELECT',
        'entity_type = ''transaction'' AND entity_id IN (SELECT id FROM public.transactions WHERE owner_id = auth.uid())');

    RAISE NOTICE 'payment_audit_log: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 4. SUBSCRIPTION_TIERS — Public read, admin write
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subscription_tiers') THEN
        RAISE NOTICE 'subscription_tiers: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Anyone can read tiers" ON public.subscription_tiers';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage tiers" ON public.subscription_tiers';
    EXECUTE 'DROP POLICY IF EXISTS "tier_select_public" ON public.subscription_tiers';
    EXECUTE 'DROP POLICY IF EXISTS "tier_all_admin" ON public.subscription_tiers';

    PERFORM _temp_safe_policy('subscription_tiers', 'tier_select_public', 'SELECT', 'true');
    PERFORM _temp_safe_policy('subscription_tiers', 'tier_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'subscription_tiers: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 5. PLATFORM_CONFIG — Admin only
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='platform_config') THEN
        RAISE NOTICE 'platform_config: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Admin full access platform config" ON public.platform_config';
    EXECUTE 'DROP POLICY IF EXISTS "Public read platform config" ON public.platform_config';
    EXECUTE 'DROP POLICY IF EXISTS "cfg_select_public" ON public.platform_config';
    EXECUTE 'DROP POLICY IF EXISTS "cfg_all_admin" ON public.platform_config';

    PERFORM _temp_safe_policy('platform_config', 'cfg_select_public', 'SELECT', 'true');
    PERFORM _temp_safe_policy('platform_config', 'cfg_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'platform_config: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 6. FEATURE_ALLOCATIONS — Admin + merchant own
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='feature_allocations') THEN
        RAISE NOTICE 'feature_allocations: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.feature_allocations ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Merchant can view own allocations" ON public.feature_allocations';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage allocations" ON public.feature_allocations';
    EXECUTE 'DROP POLICY IF EXISTS "fa_select_own" ON public.feature_allocations';
    EXECUTE 'DROP POLICY IF EXISTS "fa_all_admin" ON public.feature_allocations';
    EXECUTE 'DROP POLICY IF EXISTS "fa_update_merchant" ON public.feature_allocations';

    PERFORM _temp_safe_policy('feature_allocations', 'fa_select_own', 'SELECT', 'auth.uid() = profile_id');
    PERFORM _temp_safe_policy('feature_allocations', 'fa_update_merchant', 'UPDATE',
        'auth.uid() = profile_id', 'auth.uid() = profile_id');
    PERFORM _temp_safe_policy('feature_allocations', 'fa_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'feature_allocations: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 7. MERCHANT_ADDONS — Admin + merchant own
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='merchant_addons') THEN
        RAISE NOTICE 'merchant_addons: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.merchant_addons ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Merchant can view own addons" ON public.merchant_addons';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage addons" ON public.merchant_addons';
    EXECUTE 'DROP POLICY IF EXISTS "addon_select_own" ON public.merchant_addons';
    EXECUTE 'DROP POLICY IF EXISTS "addon_all_admin" ON public.merchant_addons';

    PERFORM _temp_safe_policy('merchant_addons', 'addon_select_own', 'SELECT', 'auth.uid() = profile_id');
    PERFORM _temp_safe_policy('merchant_addons', 'addon_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'merchant_addons: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 8. DISPUTES — Admin + disputing merchant
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='disputes') THEN
        RAISE NOTICE 'disputes: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Merchant can view own disputes" ON public.disputes';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage disputes" ON public.disputes';
    EXECUTE 'DROP POLICY IF EXISTS "dispute_select_own" ON public.disputes';
    EXECUTE 'DROP POLICY IF EXISTS "dispute_insert_merchant" ON public.disputes';
    EXECUTE 'DROP POLICY IF EXISTS "dispute_all_admin" ON public.disputes';

    PERFORM _temp_safe_policy('disputes', 'dispute_select_own', 'SELECT', 'auth.uid() = merchant_id');
    PERFORM _temp_safe_policy('disputes', 'dispute_insert_merchant', 'INSERT', NULL, 'auth.uid() = merchant_id');
    PERFORM _temp_safe_policy('disputes', 'dispute_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'disputes: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 9. MERCHANT_TEAMS — Admin + team owner
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='merchant_teams') THEN
        RAISE NOTICE 'merchant_teams: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.merchant_teams ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Teams visible to owner" ON public.merchant_teams';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage teams" ON public.merchant_teams';
    EXECUTE 'DROP POLICY IF EXISTS "team_select_own" ON public.merchant_teams';
    EXECUTE 'DROP POLICY IF EXISTS "team_all_admin" ON public.merchant_teams';

    PERFORM _temp_safe_policy('merchant_teams', 'team_select_own', 'SELECT', 'auth.uid() = created_by');
    PERFORM _temp_safe_policy('merchant_teams', 'team_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'merchant_teams: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 10. TRIAL_CAMPAIGNS — Admin manages, public reads active
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trial_campaigns') THEN
        RAISE NOTICE 'trial_campaigns: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.trial_campaigns ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage trial campaigns" ON public.trial_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS "Public can read active trials" ON public.trial_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS "tc_select_active" ON public.trial_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS "tc_all_admin" ON public.trial_campaigns';

    PERFORM _temp_safe_policy('trial_campaigns', 'tc_select_active', 'SELECT', 'true');
    PERFORM _temp_safe_policy('trial_campaigns', 'tc_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'trial_campaigns: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 11. PLATFORM_COUPON_POOLS — Admin manages, public reads
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='platform_coupon_pools') THEN
        RAISE NOTICE 'platform_coupon_pools: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.platform_coupon_pools ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Admin manage coupon pools" ON public.platform_coupon_pools';
    EXECUTE 'DROP POLICY IF EXISTS "Public read active pools" ON public.platform_coupon_pools';
    EXECUTE 'DROP POLICY IF EXISTS "pool_select_public" ON public.platform_coupon_pools';
    EXECUTE 'DROP POLICY IF EXISTS "pool_all_admin" ON public.platform_coupon_pools';

    PERFORM _temp_safe_policy('platform_coupon_pools', 'pool_select_public', 'SELECT', 'true');
    PERFORM _temp_safe_policy('platform_coupon_pools', 'pool_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'platform_coupon_pools: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 12. USER_COUPONS — User sees own, admin sees all
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_coupons') THEN
        RAISE NOTICE 'user_coupons: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "User can view own coupons" ON public.user_coupons';
    EXECUTE 'DROP POLICY IF EXISTS "Admin manage user coupons" ON public.user_coupons';
    EXECUTE 'DROP POLICY IF EXISTS "uc_select_own" ON public.user_coupons';
    EXECUTE 'DROP POLICY IF EXISTS "uc_all_admin" ON public.user_coupons';

    PERFORM _temp_safe_policy('user_coupons', 'uc_select_own', 'SELECT', 'auth.uid() = user_id');
    PERFORM _temp_safe_policy('user_coupons', 'uc_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'user_coupons: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 13. BUSINESS_RIBBONS — Public read, admin + merchant manage
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='business_ribbons') THEN
        RAISE NOTICE 'business_ribbons: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.business_ribbons ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Public can view ribbons" ON public.business_ribbons';
    EXECUTE 'DROP POLICY IF EXISTS "Admin manage ribbons" ON public.business_ribbons';
    EXECUTE 'DROP POLICY IF EXISTS "ribbon_select_public" ON public.business_ribbons';
    EXECUTE 'DROP POLICY IF EXISTS "ribbon_all_admin" ON public.business_ribbons';

    PERFORM _temp_safe_policy('business_ribbons', 'ribbon_select_public', 'SELECT', 'true');
    PERFORM _temp_safe_policy('business_ribbons', 'ribbon_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'business_ribbons: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 14. STOREFRONTS — Public read, merchant own, admin all
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='storefronts') THEN
        RAISE NOTICE 'storefronts: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Public read storefronts" ON public.storefronts';
    EXECUTE 'DROP POLICY IF EXISTS "Merchant manage own storefront" ON public.storefronts';
    EXECUTE 'DROP POLICY IF EXISTS "Admin manage storefronts" ON public.storefronts';
    EXECUTE 'DROP POLICY IF EXISTS "sf_select_public" ON public.storefronts';
    EXECUTE 'DROP POLICY IF EXISTS "sf_all_merchant" ON public.storefronts';
    EXECUTE 'DROP POLICY IF EXISTS "sf_all_admin" ON public.storefronts';

    PERFORM _temp_safe_policy('storefronts', 'sf_select_public', 'SELECT', 'true');
    PERFORM _temp_safe_policy('storefronts', 'sf_all_merchant', 'ALL',
        'business_id IN (SELECT id FROM public.businesses WHERE claimed_by = auth.uid())');
    PERFORM _temp_safe_policy('storefronts', 'sf_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'storefronts: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 15. STOREFRONT_PRODUCTS — Same as storefronts
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='storefront_products') THEN
        RAISE NOTICE 'storefront_products: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.storefront_products ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Public read products" ON public.storefront_products';
    EXECUTE 'DROP POLICY IF EXISTS "Merchant manage own products" ON public.storefront_products';
    EXECUTE 'DROP POLICY IF EXISTS "Admin manage products" ON public.storefront_products';
    EXECUTE 'DROP POLICY IF EXISTS "sp_select_public" ON public.storefront_products';
    EXECUTE 'DROP POLICY IF EXISTS "sp_all_merchant" ON public.storefront_products';
    EXECUTE 'DROP POLICY IF EXISTS "sp_all_admin" ON public.storefront_products';

    PERFORM _temp_safe_policy('storefront_products', 'sp_select_public', 'SELECT', 'true');
    PERFORM _temp_safe_policy('storefront_products', 'sp_all_merchant', 'ALL',
        'storefront_id IN (SELECT id FROM public.storefronts WHERE business_id IN (SELECT id FROM public.businesses WHERE claimed_by = auth.uid()))');
    PERFORM _temp_safe_policy('storefront_products', 'sp_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'storefront_products: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 16. R2_ASSETS — Merchant own, admin all
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='r2_assets') THEN
        RAISE NOTICE 'r2_assets: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.r2_assets ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "User manage own assets" ON public.r2_assets';
    EXECUTE 'DROP POLICY IF EXISTS "Admin manage assets" ON public.r2_assets';
    EXECUTE 'DROP POLICY IF EXISTS "r2_all_own" ON public.r2_assets';
    EXECUTE 'DROP POLICY IF EXISTS "r2_all_admin" ON public.r2_assets';

    PERFORM _temp_safe_policy('r2_assets', 'r2_all_own', 'ALL', 'auth.uid() = owner_id');
    PERFORM _temp_safe_policy('r2_assets', 'r2_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'r2_assets: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 17. BUSINESSES — Existing SELECT/INSERT preserved,
--     add admin ALL, fix owner update
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='businesses') THEN
        RAISE NOTICE 'businesses: table not found, skipping'; RETURN;
    END IF;

    -- Drop old admin policy if exists
    EXECUTE 'DROP POLICY IF EXISTS "Admin full access businesses" ON public.businesses';
    EXECUTE 'DROP POLICY IF EXISTS "biz_all_admin" ON public.businesses';

    -- Admin: full CRUD (needed for claim approvals, bans, etc.)
    PERFORM _temp_safe_policy('businesses', 'biz_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'businesses: admin RLS added (existing public read + auth insert preserved)';
END $$;


-- ═══════════════════════════════════════════════════════════
-- CLEANUP: Drop the temporary helper function
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS _temp_safe_policy(TEXT, TEXT, TEXT, TEXT, TEXT);


-- ═══════════════════════════════════════════════════════════
-- SCHEMA CACHE RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: W1-4 — Server-Side Location Quota Enforcement
-- Branch: feature/v2-subdomain-portals
--
-- Purpose:
--   Prevents merchants from claiming more businesses than their
--   subscription tier allows. This is a server-side enforcement
--   that cannot be bypassed by disabling JavaScript.
--
-- Logic:
--   When claimed_by is SET (INSERT with claimed_by, or UPDATE
--   setting claimed_by to non-NULL), count how many businesses
--   that user already claims and compare against:
--     subscriptions.quotas->>'max_locations' (JSONB integer)
--
--   -1 = unlimited (Enterprise), 0 = none allowed, N = max N
--   If no subscription exists, defaults to 1 (Free tier fallback)
--
-- ⚠️  Admin users bypass this check via is_platform_admin().
-- ============================================================


CREATE OR REPLACE FUNCTION public.enforce_location_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_count INTEGER;
    v_max_locations INTEGER;
    v_quotas JSONB;
BEGIN
    -- Only trigger when claimed_by is being set to a non-NULL value
    IF NEW.claimed_by IS NULL THEN
        RETURN NEW;
    END IF;

    -- Skip if claimed_by isn't actually changing (UPDATE with same value)
    IF TG_OP = 'UPDATE' AND OLD.claimed_by IS NOT DISTINCT FROM NEW.claimed_by THEN
        RETURN NEW;
    END IF;

    -- Admin bypass: platform admins can assign businesses freely
    -- (e.g., during bulk imports or manual overrides)
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = NEW.claimed_by
        AND role IN ('super_admin', 'admin', 'assistant_admin')
    ) THEN
        RETURN NEW;
    END IF;

    -- Count how many businesses this user already claims
    -- (exclude the current row if this is an UPDATE)
    SELECT COUNT(*) INTO v_current_count
    FROM public.businesses
    WHERE claimed_by = NEW.claimed_by
      AND id IS DISTINCT FROM NEW.id;

    -- Look up their subscription quota
    SELECT quotas INTO v_quotas
    FROM public.subscriptions
    WHERE profile_id = NEW.claimed_by
      AND status IN ('Active', 'Expiring Soon', 'Grace Period')
    ORDER BY
        CASE status
            WHEN 'Active' THEN 1
            WHEN 'Expiring Soon' THEN 2
            WHEN 'Grace Period' THEN 3
        END
    LIMIT 1;

    -- Extract max_locations from JSONB, default to 1 (Free tier)
    v_max_locations := COALESCE((v_quotas->>'max_locations')::INTEGER, 1);

    -- -1 means unlimited (Enterprise tier)
    IF v_max_locations = -1 THEN
        RETURN NEW;
    END IF;

    -- Enforce the limit
    IF v_current_count >= v_max_locations THEN
        RAISE EXCEPTION 'Location quota exceeded: you have % of % allowed locations. Upgrade your plan to add more.',
            v_current_count, v_max_locations
        USING ERRCODE = 'P0001',
              HINT = 'Upgrade your subscription tier to increase the location quota.';
    END IF;

    RETURN NEW;
END;
$$;


-- Install the trigger on businesses table
DROP TRIGGER IF EXISTS trg_enforce_location_quota ON public.businesses;
CREATE TRIGGER trg_enforce_location_quota
    BEFORE INSERT OR UPDATE OF claimed_by ON public.businesses
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_location_quota();

COMMENT ON FUNCTION public.enforce_location_quota() IS
    'Enforces max_locations quota from subscriptions.quotas JSONB. '
    'Free tier defaults to 1 location. Enterprise (-1) is unlimited. '
    'Admin users bypass this check.';


-- Schema reload
NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: W2-1 — Claim Approval + Free Subscription Provisioning
-- Branch: feature/v2-subdomain-portals
--
-- RPCs:
--   1. admin_approve_claim(claim_id) — Approves a claim, promotes
--      user to merchant, assigns business, provisions Free subscription
--   2. admin_reject_claim(claim_id, reason) — Rejects a claim
--
-- DEPENDS ON:
--   - is_platform_admin() from W1-1
--   - subscription_tiers table (for Free tier quotas)
--   - business_claims table
--   - subscriptions table
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. APPROVE CLAIM RPC
--
--    This is the critical onboarding function. When an admin
--    approves a business claim:
--    1. Sets claim status to 'approved'
--    2. Assigns the business to the merchant (claimed_by)
--    3. Promotes the user's role to 'merchant'
--    4. Creates a Free subscription with quotas from subscription_tiers
--    5. Seeds initial feature_allocations (shield, storefront)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_approve_claim(p_claim_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_claim RECORD;
    v_free_tier RECORD;
    v_sub_id UUID;
    v_result JSONB;
BEGIN
    -- Gate: only platform admins
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only platform admins can approve claims'
            USING ERRCODE = 'P0001';
    END IF;

    -- Fetch the claim
    SELECT bc.*, p.role as current_role, p.full_name as user_name
    INTO v_claim
    FROM public.business_claims bc
    JOIN public.profiles p ON p.id = bc.user_id
    WHERE bc.id = p_claim_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found: %', p_claim_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_claim.status != 'pending' THEN
        RAISE EXCEPTION 'Claim is already %: cannot approve', v_claim.status
            USING ERRCODE = 'P0003';
    END IF;

    -- 1. Update claim status
    UPDATE public.business_claims
    SET status = 'approved',
        updated_at = NOW()
    WHERE id = p_claim_id;

    -- 2. Assign business to merchant
    UPDATE public.businesses
    SET claimed_by = v_claim.user_id,
        updated_at = NOW()
    WHERE id = v_claim.business_id;

    -- 3. Promote user to merchant (if not already)
    IF v_claim.current_role = 'user' THEN
        -- Temporarily bypass role guard for admin action
        -- The guard_role_change trigger checks for super_admin,
        -- but this SECURITY DEFINER function runs as postgres owner
        UPDATE public.profiles
        SET role = 'merchant'
        WHERE id = v_claim.user_id;
    END IF;

    -- 4. Fetch Free tier quotas from subscription_tiers
    SELECT * INTO v_free_tier
    FROM public.subscription_tiers
    WHERE LOWER(name) = 'free' OR slug = 'free'
    LIMIT 1;

    -- 5. Create Free subscription
    IF v_free_tier IS NOT NULL THEN
        INSERT INTO public.subscriptions (
            profile_id, business_id, tier, status,
            auto_renew, is_trial, trial_months,
            quotas, grace_period_days,
            expires_at
        ) VALUES (
            v_claim.user_id,
            v_claim.business_id,
            COALESCE(v_free_tier.name, 'Free'),
            'Active',
            false,  -- Free tier doesn't auto-renew
            false,  -- Not a trial
            0,
            COALESCE(v_free_tier.quotas, '{"max_locations": 1}'::JSONB),
            0,
            NULL    -- Free tier never expires
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_sub_id;
    ELSE
        -- No Free tier in subscription_tiers — create a minimal subscription
        INSERT INTO public.subscriptions (
            profile_id, business_id, tier, status,
            auto_renew, is_trial,
            quotas, grace_period_days
        ) VALUES (
            v_claim.user_id,
            v_claim.business_id,
            'Free',
            'Active',
            false,
            false,
            '{"max_locations": 1}'::JSONB,
            0
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_sub_id;
    END IF;

    -- 6. Seed feature_allocations (shield + storefront for Free tier)
    IF v_sub_id IS NOT NULL THEN
        INSERT INTO public.feature_allocations (profile_id, business_id, feature_type, status, source)
        VALUES
            (v_claim.user_id, v_claim.business_id, 'storefront', 'active', 'claim_approval')
        ON CONFLICT DO NOTHING;
    END IF;

    -- Build result
    v_result := jsonb_build_object(
        'success', true,
        'claim_id', p_claim_id,
        'business_id', v_claim.business_id,
        'user_id', v_claim.user_id,
        'user_name', v_claim.user_name,
        'subscription_id', v_sub_id,
        'tier', COALESCE(v_free_tier.name, 'Free'),
        'approved_by', auth.uid(),
        'approved_at', NOW()
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_claim(UUID) TO authenticated;

COMMENT ON FUNCTION public.admin_approve_claim(UUID) IS
    'Admin-only RPC: approves a business claim, promotes user to merchant, '
    'assigns business ownership, and auto-provisions a Free subscription.';


-- ═══════════════════════════════════════════════════════════
-- 2. REJECT CLAIM RPC
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_reject_claim(
    p_claim_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_claim RECORD;
BEGIN
    -- Gate: only platform admins
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized: only platform admins can reject claims'
            USING ERRCODE = 'P0001';
    END IF;

    -- Fetch the claim
    SELECT * INTO v_claim
    FROM public.business_claims
    WHERE id = p_claim_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found: %', p_claim_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_claim.status != 'pending' THEN
        RAISE EXCEPTION 'Claim is already %: cannot reject', v_claim.status
            USING ERRCODE = 'P0003';
    END IF;

    -- Update claim status
    UPDATE public.business_claims
    SET status = 'rejected',
        updated_at = NOW()
    WHERE id = p_claim_id;

    RETURN jsonb_build_object(
        'success', true,
        'claim_id', p_claim_id,
        'status', 'rejected',
        'reason', COALESCE(p_reason, 'No reason provided'),
        'rejected_by', auth.uid(),
        'rejected_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_claim(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_reject_claim(UUID, TEXT) IS
    'Admin-only RPC: rejects a business claim with optional reason.';


-- ═══════════════════════════════════════════════════════════
-- 3. MERCHANT SELF-SERVICE: submit_claim
--    Allows authenticated users to submit a claim for a business
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.submit_business_claim(
    p_business_id UUID,
    p_documents JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_existing RECORD;
    v_claim_id UUID;
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Must be authenticated to submit a claim'
            USING ERRCODE = 'P0001';
    END IF;

    -- Check if business exists
    IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id) THEN
        RAISE EXCEPTION 'Business not found: %', p_business_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Check if already claimed
    SELECT claimed_by INTO v_existing
    FROM public.businesses
    WHERE id = p_business_id;

    IF v_existing.claimed_by IS NOT NULL THEN
        RAISE EXCEPTION 'Business is already claimed'
            USING ERRCODE = 'P0004';
    END IF;

    -- Check if user already has a pending claim for this business
    IF EXISTS (
        SELECT 1 FROM public.business_claims
        WHERE business_id = p_business_id
          AND user_id = auth.uid()
          AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'You already have a pending claim for this business'
            USING ERRCODE = 'P0005';
    END IF;

    -- Insert claim
    INSERT INTO public.business_claims (business_id, user_id, status, submitted_documents)
    VALUES (p_business_id, auth.uid(), 'pending', p_documents)
    RETURNING id INTO v_claim_id;

    RETURN jsonb_build_object(
        'success', true,
        'claim_id', v_claim_id,
        'business_id', p_business_id,
        'status', 'pending'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_business_claim(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.submit_business_claim(UUID, JSONB) IS
    'User-facing RPC: submits a business ownership claim for admin review.';


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: W2-2 — Subscription Expiry Notifications
-- Branch: feature/v2-subdomain-portals
--
-- Creates:
--   1. notifications table for merchant-facing alerts
--   2. check_expiring_subscriptions() function
--   3. pg_cron job to run daily at 08:00 UTC
--
-- Notification types:
--   - subscription_expiring (T-7 days)
--   - subscription_expired
--   - claim_approved / claim_rejected (from W2-1)
--   - tier_upgrade_approved / tier_upgrade_rejected
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. NOTIFICATIONS TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'subscription_expiring',
        'subscription_expired',
        'claim_approved',
        'claim_rejected',
        'tier_upgrade_approved',
        'tier_upgrade_rejected',
        'system_announcement',
        'payment_received',
        'payment_overdue'
    )),
    title TEXT NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,     -- { business_id, subscription_id, etc. }
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "notif_select_own"
    ON public.notifications FOR SELECT
    USING (auth.uid() = profile_id);

-- Users can mark their own as read
CREATE POLICY "notif_update_own"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- Admin can do everything
CREATE POLICY "notif_all_admin"
    ON public.notifications FOR ALL
    USING (public.is_platform_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_profile
    ON public.notifications(profile_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type
    ON public.notifications(type, created_at DESC);


-- ═══════════════════════════════════════════════════════════
-- 2. EXPIRY CHECK FUNCTION
--    Finds subscriptions expiring within 7 days and creates
--    notifications (idempotent: won't duplicate alerts).
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_expiring_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
    v_sub RECORD;
BEGIN
    -- T-7 day warnings
    FOR v_sub IN
        SELECT s.id, s.profile_id, s.business_id, s.tier, s.expires_at,
               b.name as business_name
        FROM public.subscriptions s
        LEFT JOIN public.businesses b ON b.id = s.business_id
        WHERE s.status = 'Active'
          AND s.expires_at IS NOT NULL
          AND s.expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
          -- Don't re-notify if already sent
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications n
              WHERE n.profile_id = s.profile_id
                AND n.type = 'subscription_expiring'
                AND n.metadata->>'subscription_id' = s.id::TEXT
                AND n.created_at > NOW() - INTERVAL '7 days'
          )
    LOOP
        INSERT INTO public.notifications (profile_id, type, title, message, metadata)
        VALUES (
            v_sub.profile_id,
            'subscription_expiring',
            'اشتراكك يقترب من الانتهاء',  -- Your subscription is expiring soon
            format(
                'اشتراك %s لـ %s سينتهي في %s. قم بالتجديد للحفاظ على مميزاتك.',
                v_sub.tier,
                COALESCE(v_sub.business_name, 'عملك'),
                to_char(v_sub.expires_at AT TIME ZONE 'Africa/Tripoli', 'DD/MM/YYYY')
            ),
            jsonb_build_object(
                'subscription_id', v_sub.id,
                'business_id', v_sub.business_id,
                'tier', v_sub.tier,
                'expires_at', v_sub.expires_at,
                'days_remaining', EXTRACT(DAY FROM v_sub.expires_at - NOW())::INTEGER
            )
        );
        v_count := v_count + 1;
    END LOOP;

    -- Expired subscriptions (grace period check)
    FOR v_sub IN
        SELECT s.id, s.profile_id, s.business_id, s.tier, s.expires_at,
               b.name as business_name, s.grace_period_days
        FROM public.subscriptions s
        LEFT JOIN public.businesses b ON b.id = s.business_id
        WHERE s.status = 'Active'
          AND s.expires_at IS NOT NULL
          AND s.expires_at < NOW()
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications n
              WHERE n.profile_id = s.profile_id
                AND n.type = 'subscription_expired'
                AND n.metadata->>'subscription_id' = s.id::TEXT
                AND n.created_at > NOW() - INTERVAL '1 day'
          )
    LOOP
        -- Mark subscription as expired or grace period
        IF v_sub.grace_period_days > 0
           AND v_sub.expires_at + (v_sub.grace_period_days || ' days')::INTERVAL > NOW()
        THEN
            UPDATE public.subscriptions
            SET status = 'Grace Period'
            WHERE id = v_sub.id AND status = 'Active';

            INSERT INTO public.notifications (profile_id, type, title, message, metadata)
            VALUES (
                v_sub.profile_id,
                'subscription_expired',
                'انتهى اشتراكك — فترة سماح',
                format(
                    'اشتراك %s انتهى. لديك %s أيام إضافية قبل تعليق الخدمة.',
                    v_sub.tier, v_sub.grace_period_days
                ),
                jsonb_build_object(
                    'subscription_id', v_sub.id,
                    'business_id', v_sub.business_id,
                    'tier', v_sub.tier,
                    'grace_until', v_sub.expires_at + (v_sub.grace_period_days || ' days')::INTERVAL
                )
            );
        ELSE
            UPDATE public.subscriptions
            SET status = 'Expired'
            WHERE id = v_sub.id AND status IN ('Active', 'Grace Period');

            INSERT INTO public.notifications (profile_id, type, title, message, metadata)
            VALUES (
                v_sub.profile_id,
                'subscription_expired',
                'انتهى اشتراكك',
                format('اشتراك %s لـ %s انتهى. جدّد الآن لاستعادة مميزاتك.',
                    v_sub.tier, COALESCE(v_sub.business_name, 'عملك')),
                jsonb_build_object(
                    'subscription_id', v_sub.id,
                    'business_id', v_sub.business_id,
                    'tier', v_sub.tier
                )
            );
        END IF;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_expiring_subscriptions() TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 3. MARK NOTIFICATION AS READ RPC
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE id = p_notification_id
      AND profile_id = auth.uid();

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 4. MARK ALL NOTIFICATIONS AS READ
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE profile_id = auth.uid()
      AND is_read = false;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 5. CRON JOB (pg_cron)
--    Run daily at 08:00 Libya time (05:00 UTC)
--    NOTE: pg_cron must be enabled in Supabase Dashboard
--          (Settings → Extensions → pg_cron)
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove existing job if any
        PERFORM cron.unschedule('check_expiring_subscriptions');

        -- Schedule daily at 05:00 UTC (08:00 Tripoli time)
        PERFORM cron.schedule(
            'check_expiring_subscriptions',
            '0 5 * * *',
            'SELECT public.check_expiring_subscriptions()'
        );

        RAISE NOTICE 'pg_cron job scheduled: check_expiring_subscriptions at 05:00 UTC daily';
    ELSE
        RAISE NOTICE 'pg_cron extension not found — skipping cron setup. Enable it in Supabase Dashboard.';
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: W4 — Content Integrity Trigger + Admin Stats Views
-- Branch: feature/v2-subdomain-portals
--
-- Creates:
--   1. Server-side bad word filter trigger on logs
--   2. Admin dashboard statistics views (real-time counts)
--   3. Gader Index recalculation on dispute resolution
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. BAD WORD DICTIONARY TABLE
--    Allows admins to manage the word list without code deploys.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.content_filter_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word TEXT NOT NULL UNIQUE,
    language TEXT NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'mixed')),
    severity TEXT NOT NULL DEFAULT 'flag' CHECK (severity IN ('flag', 'block', 'shadow')),
    -- flag = allow but mark for review
    -- block = reject outright
    -- shadow = allow but exclude from Gader Index
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.content_filter_words ENABLE ROW LEVEL SECURITY;

-- Only admins can manage the word list
CREATE POLICY "cfwords_all_admin"
    ON public.content_filter_words FOR ALL
    USING (public.is_platform_admin());

-- Seed initial dictionary
INSERT INTO public.content_filter_words (word, language, severity) VALUES
    -- English
    ('spam', 'en', 'flag'), ('fake', 'en', 'flag'), ('scam', 'en', 'flag'),
    ('fraud', 'en', 'flag'), ('fuck', 'en', 'block'), ('shit', 'en', 'block'),
    ('bitch', 'en', 'block'), ('asshole', 'en', 'block'),
    -- Arabic / Libyan
    ('نصاب', 'ar', 'flag'), ('سارق', 'ar', 'flag'), ('كذاب', 'ar', 'flag'),
    ('غشاش', 'ar', 'flag'), ('تفو', 'ar', 'flag'), ('كلب', 'ar', 'block'),
    ('حمار', 'ar', 'flag'), ('زبالة', 'ar', 'block'), ('محتال', 'ar', 'flag'),
    ('عنصري', 'ar', 'block'), ('شتم', 'ar', 'flag'), ('سب', 'ar', 'flag')
ON CONFLICT (word) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- 2. CONTENT CHECK TRIGGER
--    Runs BEFORE INSERT on logs. Checks text against the
--    content_filter_words table and sets is_flagged + flag_reason.
-- ═══════════════════════════════════════════════════════════

-- Add flagging columns to logs if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'logs'
                   AND column_name = 'is_flagged') THEN
        ALTER TABLE public.logs ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'logs'
                   AND column_name = 'flag_reason') THEN
        ALTER TABLE public.logs ADD COLUMN flag_reason TEXT;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_log_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_match RECORD;
    v_text TEXT;
BEGIN
    v_text := LOWER(COALESCE(NEW.reason_text, ''));

    -- Skip empty text
    IF v_text = '' THEN
        RETURN NEW;
    END IF;

    -- Check against the dictionary
    SELECT w.word, w.severity INTO v_match
    FROM public.content_filter_words w
    WHERE v_text LIKE '%' || LOWER(w.word) || '%'
    ORDER BY w.severity DESC   -- block > flag > shadow
    LIMIT 1;

    IF v_match IS NOT NULL THEN
        IF v_match.severity = 'block' THEN
            RAISE EXCEPTION 'المحتوى يحتوي على كلمات محظورة — يرجى تعديل النص'
                USING ERRCODE = 'P0010';
        ELSIF v_match.severity = 'shadow' THEN
            -- Allow but exclude from index calculations
            NEW.is_flagged := TRUE;
            NEW.flag_reason := 'shadow_filter: ' || v_match.word;
        ELSE
            -- flag: allow but mark for admin review
            NEW.is_flagged := TRUE;
            NEW.flag_reason := 'content_filter: ' || v_match.word;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_log_content ON public.logs;
CREATE TRIGGER trg_check_log_content
    BEFORE INSERT ON public.logs
    FOR EACH ROW
    EXECUTE FUNCTION public.check_log_content();


-- ═══════════════════════════════════════════════════════════
-- 3. ADMIN DASHBOARD STATISTICS RPC
--    Returns real-time platform metrics in a single call.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_total_users INTEGER;
    v_total_merchants INTEGER;
    v_total_businesses INTEGER;
    v_pending_claims INTEGER;
    v_active_subscriptions INTEGER;
    v_total_logs INTEGER;
    v_flagged_logs INTEGER;
    v_total_coupons_redeemed INTEGER;
    v_mrr NUMERIC;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    -- User counts
    SELECT COUNT(*) INTO v_total_users FROM public.profiles;
    SELECT COUNT(*) INTO v_total_merchants FROM public.profiles WHERE role = 'merchant';

    -- Business counts
    SELECT COUNT(*) INTO v_total_businesses FROM public.businesses WHERE claimed_by IS NOT NULL;
    SELECT COUNT(*) INTO v_pending_claims FROM public.business_claims WHERE status = 'pending';

    -- Subscription counts
    SELECT COUNT(*) INTO v_active_subscriptions
    FROM public.subscriptions WHERE status = 'Active';

    -- Log counts
    SELECT COUNT(*) INTO v_total_logs FROM public.logs;
    SELECT COUNT(*) INTO v_flagged_logs FROM public.logs WHERE is_flagged = TRUE;

    -- Coupon redemptions
    BEGIN
        SELECT COUNT(*) INTO v_total_coupons_redeemed
        FROM public.user_coupons WHERE status = 'REDEEMED';
    EXCEPTION WHEN undefined_table THEN
        v_total_coupons_redeemed := 0;
    END;

    -- MRR calculation (sum of active non-free subscription tier prices)
    BEGIN
        SELECT COALESCE(SUM(st.price), 0) INTO v_mrr
        FROM public.subscriptions s
        JOIN public.subscription_tiers st ON LOWER(s.tier) = LOWER(st.name)
        WHERE s.status = 'Active' AND LOWER(s.tier) != 'free';
    EXCEPTION WHEN OTHERS THEN
        v_mrr := 0;
    END;

    RETURN jsonb_build_object(
        'total_users', v_total_users,
        'total_merchants', v_total_merchants,
        'total_businesses', v_total_businesses,
        'pending_claims', v_pending_claims,
        'active_subscriptions', v_active_subscriptions,
        'total_logs', v_total_logs,
        'flagged_logs', v_flagged_logs,
        'coupons_redeemed', v_total_coupons_redeemed,
        'mrr', v_mrr,
        'computed_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

COMMENT ON FUNCTION public.admin_dashboard_stats() IS
    'Admin-only RPC: returns real-time platform statistics for the dashboard.';


-- ═══════════════════════════════════════════════════════════
-- 4. DISPUTE RESOLUTION GADER INDEX RECALCULATION
--    When a dispute is resolved as fraud, recalculate the score.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
    p_dispute_id UUID,
    p_outcome TEXT,  -- 'approved_fake' or 'rejected_valid'
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_dispute RECORD;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    IF p_outcome NOT IN ('approved_fake', 'rejected_valid') THEN
        RAISE EXCEPTION 'Invalid outcome: must be approved_fake or rejected_valid'
            USING ERRCODE = 'P0003';
    END IF;

    SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dispute not found' USING ERRCODE = 'P0002';
    END IF;

    -- Update dispute
    UPDATE public.disputes
    SET status = p_outcome,
        resolved_at = NOW()
    WHERE id = p_dispute_id;

    -- If fraud confirmed, flag the original log so it's excluded from Gader Index
    IF p_outcome = 'approved_fake' THEN
        UPDATE public.logs
        SET is_flagged = TRUE,
            flag_reason = 'dispute_resolved_fraud'
        WHERE id = v_dispute.log_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'dispute_id', p_dispute_id,
        'outcome', p_outcome,
        'log_id', v_dispute.log_id,
        'business_id', v_dispute.business_id,
        'resolved_by', auth.uid(),
        'resolved_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: W5 — Payment Confirmation Pipeline
-- Branch: feature/v2-subdomain-portals
--
-- Creates:
--   1. transactions table for upgrade requests
--   2. payment_audit_log table for audit trail
--   3. admin_confirm_payment RPC (with quota sync)
--   4. admin_reject_payment RPC
--   5. merchant_verified_at on user_coupons (coupon verification)
--   6. merchant_verify_coupon RPC
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. TRANSACTIONS TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id),
    business_id UUID REFERENCES public.businesses(id),
    requested_tier TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'manual',
    payment_gateway TEXT NOT NULL DEFAULT 'bank_transfer',
    proof_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'rejected')),
    rejection_reason TEXT,
    confirmed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Merchants can view and create their own transactions
DROP POLICY IF EXISTS "txn_select_own" ON public.transactions;
CREATE POLICY "txn_select_own" ON public.transactions
    FOR SELECT USING (owner_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "txn_insert_own" ON public.transactions;
CREATE POLICY "txn_insert_own" ON public.transactions
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Only admins can update (approve/reject)
DROP POLICY IF EXISTS "txn_update_admin" ON public.transactions;
CREATE POLICY "txn_update_admin" ON public.transactions
    FOR UPDATE USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════
-- 2. PAYMENT AUDIT LOG
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL DEFAULT 'transaction',
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins see all, merchants see their own
DROP POLICY IF EXISTS "pal_admin_all" ON public.payment_audit_log;
CREATE POLICY "pal_admin_all" ON public.payment_audit_log
    FOR ALL USING (public.is_platform_admin());

DROP POLICY IF EXISTS "pal_merchant_select" ON public.payment_audit_log;
CREATE POLICY "pal_merchant_select" ON public.payment_audit_log
    FOR SELECT USING (
        entity_type = 'transaction'
        AND entity_id IN (
            SELECT id FROM public.transactions WHERE owner_id = auth.uid()
        )
    );


-- ═══════════════════════════════════════════════════════════
-- 3. ADMIN CONFIRM PAYMENT RPC
--    Approves a pending transaction, syncs quotas from
--    subscription_tiers, and notifies the merchant.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.admin_confirm_payment(UUID);
CREATE OR REPLACE FUNCTION public.admin_confirm_payment(p_txn_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_txn RECORD;
    v_quotas JSONB;
    v_tier_price NUMERIC;
    v_duration_days INTEGER;
BEGIN
    -- Admin check
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    -- Get transaction
    SELECT * INTO v_txn FROM public.transactions WHERE id = p_txn_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_txn.status != 'pending' THEN
        RAISE EXCEPTION 'Transaction is not pending' USING ERRCODE = 'P0003';
    END IF;

    -- Look up tier quotas
    SELECT allocations, price INTO v_quotas, v_tier_price
    FROM public.subscription_tiers
    WHERE LOWER(name) = LOWER(v_txn.requested_tier)
    LIMIT 1;

    IF v_quotas IS NULL THEN
        v_quotas := '{}'::jsonb;
    END IF;

    -- Duration: default 30 days
    v_duration_days := 30;

    -- Update transaction
    UPDATE public.transactions
    SET status = 'completed',
        confirmed_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_txn_id;

    -- Upsert subscription with quotas from tier
    INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at, quotas)
    VALUES (v_txn.business_id, v_txn.owner_id, v_txn.requested_tier,
            'Active', NOW() + (v_duration_days || ' days')::interval, v_quotas)
    ON CONFLICT (profile_id)
    DO UPDATE SET
        tier = EXCLUDED.tier,
        status = 'Active',
        expires_at = EXCLUDED.expires_at,
        business_id = EXCLUDED.business_id,
        quotas = EXCLUDED.quotas;

    -- Audit log
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES ('transaction', p_txn_id, 'confirmed', auth.uid(),
            jsonb_build_object(
                'tier', v_txn.requested_tier,
                'amount', v_txn.amount,
                'merchant_id', v_txn.owner_id
            ));

    -- Notify merchant
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (v_txn.owner_id, 'payment_confirmed',
            'تمت الموافقة على طلب الترقية ✅',
            'تم تفعيل اشتراك ' || v_txn.requested_tier || ' بنجاح. مبروك!');

    RETURN jsonb_build_object(
        'success', true,
        'txn_id', p_txn_id,
        'tier', v_txn.requested_tier,
        'expires_at', NOW() + (v_duration_days || ' days')::interval
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_confirm_payment(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 4. ADMIN REJECT PAYMENT RPC
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.admin_reject_payment(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.admin_reject_payment(
    p_txn_id UUID,
    p_reason TEXT DEFAULT 'غير مطابق للشروط'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_txn RECORD;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_txn FROM public.transactions WHERE id = p_txn_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_txn.status != 'pending' THEN
        RAISE EXCEPTION 'Transaction is not pending' USING ERRCODE = 'P0003';
    END IF;

    -- Reject
    UPDATE public.transactions
    SET status = 'rejected',
        rejection_reason = p_reason,
        confirmed_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_txn_id;

    -- Audit log
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES ('transaction', p_txn_id, 'rejected', auth.uid(),
            jsonb_build_object('reason', p_reason, 'merchant_id', v_txn.owner_id));

    -- Notify merchant
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (v_txn.owner_id, 'payment_rejected',
            'تم رفض طلب الترقية ❌',
            'السبب: ' || p_reason || '. يمكنك إعادة المحاولة.');

    RETURN jsonb_build_object('success', true, 'txn_id', p_txn_id, 'reason', p_reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_payment(UUID, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 5. COUPON MERCHANT VERIFICATION
-- ═══════════════════════════════════════════════════════════

-- Add merchant_verified_at column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'user_coupons'
                   AND column_name = 'merchant_verified_at') THEN
        ALTER TABLE public.user_coupons
            ADD COLUMN merchant_verified_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

DROP FUNCTION IF EXISTS public.merchant_verify_coupon(UUID);
CREATE OR REPLACE FUNCTION public.merchant_verify_coupon(p_coupon_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_coupon RECORD;
BEGIN
    SELECT uc.*, b.name AS business_name
    INTO v_coupon
    FROM public.user_coupons uc
    JOIN public.businesses b ON b.id = uc.business_id
    WHERE uc.id = p_coupon_id
      AND b.claimed_by = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Coupon not found or not your business' USING ERRCODE = 'P0002';
    END IF;

    IF v_coupon.merchant_verified_at IS NOT NULL THEN
        RAISE EXCEPTION 'Coupon already verified' USING ERRCODE = 'P0004';
    END IF;

    UPDATE public.user_coupons
    SET merchant_verified_at = NOW(),
        status = 'REDEEMED'
    WHERE id = p_coupon_id;

    RETURN jsonb_build_object(
        'success', true,
        'coupon_id', p_coupon_id,
        'business_name', v_coupon.business_name,
        'verified_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merchant_verify_coupon(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: W5b — Scale Hardening + Subscription Lifecycle
-- Branch: feature/v2-subdomain-portals
--
-- Creates:
--   1. admin_stats_cache materialized view
--   2. Updated admin_dashboard_stats to read from cache
--   3. Subscription lifecycle: expiring_soon status at T-7 days
--   4. Merchant dashboard expiry notification trigger
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 0. ENSURE subscription_tiers EXISTS
--    This table may have been created ad-hoc; we formalize it here.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.subscription_tiers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    price NUMERIC DEFAULT 0,
    description TEXT,
    allocations JSONB DEFAULT '{}',
    features JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can read tiers; only admins can manage
DROP POLICY IF EXISTS "tier_select_public" ON public.subscription_tiers;
CREATE POLICY "tier_select_public" ON public.subscription_tiers
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "tier_all_admin" ON public.subscription_tiers;
CREATE POLICY "tier_all_admin" ON public.subscription_tiers
    FOR ALL USING (public.is_platform_admin());

-- Seed default tiers (skip if already exist)
INSERT INTO public.subscription_tiers (name, price, description, allocations)
VALUES
    ('Free', 0, 'الباقة المجانية', '{"max_locations": 1, "max_campaigns": 0, "max_coupons": 0}'),
    ('Growth', 99, 'باقة النمو', '{"max_locations": 3, "max_campaigns": 5, "max_coupons": 50}'),
    ('Enterprise', 299, 'باقة الأعمال', '{"max_locations": 999, "max_campaigns": 999, "max_coupons": 999}')
ON CONFLICT (name) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- 1. ADMIN STATS MATERIALIZED VIEW
--    Replaces live queries with cached aggregates.
--    Refreshed every 5 minutes via pg_cron (if available).
-- ═══════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS public.admin_stats_cache;

CREATE MATERIALIZED VIEW public.admin_stats_cache AS
SELECT
    (SELECT COUNT(*) FROM public.profiles) AS total_users,
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'merchant') AS total_merchants,
    (SELECT COUNT(*) FROM public.businesses WHERE claimed_by IS NOT NULL) AS total_businesses,
    (SELECT COUNT(*) FROM public.business_claims WHERE status = 'pending') AS pending_claims,
    (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'Active') AS active_subscriptions,
    (SELECT COUNT(*) FROM public.logs) AS total_logs,
    (SELECT COUNT(*) FROM public.logs WHERE is_flagged = TRUE) AS flagged_logs,
    (SELECT COALESCE(COUNT(*), 0) FROM public.user_coupons WHERE status = 'REDEEMED') AS coupons_redeemed,
    (SELECT COALESCE(SUM(st.price), 0)
     FROM public.subscriptions s
     JOIN public.subscription_tiers st ON LOWER(s.tier) = LOWER(st.name)
     WHERE s.status = 'Active' AND LOWER(s.tier) != 'free') AS mrr,
    NOW() AS computed_at;

-- Create unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_stats_cache_computed
    ON public.admin_stats_cache (computed_at);

-- Schedule auto-refresh every 5 minutes (pg_cron)
-- This will silently fail if pg_cron is not enabled — safe to run.
DO $$
BEGIN
    PERFORM cron.schedule(
        'refresh-admin-stats',
        '*/5 * * * *',
        'REFRESH MATERIALIZED VIEW CONCURRENTLY public.admin_stats_cache'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available — materialized view must be refreshed manually or via application';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 2. UPDATE admin_dashboard_stats TO READ FROM CACHE
--    Falls back to live queries if the view doesn't exist.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.admin_dashboard_stats();
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result RECORD;
    v_pending_payments INTEGER;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    -- Read from materialized view (fast path)
    BEGIN
        SELECT * INTO v_result FROM public.admin_stats_cache LIMIT 1;
    EXCEPTION WHEN undefined_table THEN
        -- Fallback: live queries if view doesn't exist
        SELECT
            (SELECT COUNT(*) FROM public.profiles) AS total_users,
            (SELECT COUNT(*) FROM public.profiles WHERE role = 'merchant') AS total_merchants,
            (SELECT COUNT(*) FROM public.businesses WHERE claimed_by IS NOT NULL) AS total_businesses,
            (SELECT COUNT(*) FROM public.business_claims WHERE status = 'pending') AS pending_claims,
            (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'Active') AS active_subscriptions,
            (SELECT COUNT(*) FROM public.logs) AS total_logs,
            (SELECT COUNT(*) FROM public.logs WHERE is_flagged = TRUE) AS flagged_logs,
            0 AS coupons_redeemed,
            0 AS mrr,
            NOW() AS computed_at
        INTO v_result;
    END;

    -- Pending payments — always live (actionable count)
    BEGIN
        SELECT COUNT(*) INTO v_pending_payments
        FROM public.transactions WHERE status = 'pending';
    EXCEPTION WHEN undefined_table THEN
        v_pending_payments := 0;
    END;

    RETURN jsonb_build_object(
        'total_users', v_result.total_users,
        'total_merchants', v_result.total_merchants,
        'total_businesses', v_result.total_businesses,
        'pending_claims', v_result.pending_claims,
        'active_subscriptions', v_result.active_subscriptions,
        'total_logs', v_result.total_logs,
        'flagged_logs', v_result.flagged_logs,
        'coupons_redeemed', v_result.coupons_redeemed,
        'mrr', v_result.mrr,
        'pending_payments', v_pending_payments,
        'computed_at', v_result.computed_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 3. SUBSCRIPTION LIFECYCLE — EXPIRING SOON
--    Marks subscriptions as 'Expiring Soon' at T-7 days.
--    Designed to run via pg_cron daily or called manually.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.subscription_lifecycle_check();
CREATE OR REPLACE FUNCTION public.subscription_lifecycle_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_expiring INTEGER;
    v_expired INTEGER;
BEGIN
    -- Mark Active → Expiring Soon (T-7 days)
    UPDATE public.subscriptions
    SET status = 'Expiring Soon'
    WHERE status = 'Active'
      AND expires_at IS NOT NULL
      AND expires_at <= NOW() + INTERVAL '7 days'
      AND expires_at > NOW();

    GET DIAGNOSTICS v_expiring = ROW_COUNT;

    -- Notify merchants whose subscriptions are expiring
    INSERT INTO public.notifications (user_id, type, title, body)
    SELECT profile_id, 'subscription_expiring',
           'اشتراكك ينتهي قريباً ⚠️',
           'اشتراك ' || tier || ' ينتهي في ' ||
           TO_CHAR(expires_at, 'DD/MM/YYYY') ||
           '. جدّد الآن لتفادي فقدان الميزات.'
    FROM public.subscriptions
    WHERE status = 'Expiring Soon'
      AND profile_id NOT IN (
          SELECT user_id FROM public.notifications
          WHERE type = 'subscription_expiring'
            AND created_at > NOW() - INTERVAL '7 days'
      );

    -- Mark Expiring Soon / Active → Expired
    UPDATE public.subscriptions
    SET status = 'Expired'
    WHERE status IN ('Active', 'Expiring Soon')
      AND expires_at IS NOT NULL
      AND expires_at <= NOW();

    GET DIAGNOSTICS v_expired = ROW_COUNT;

    -- Notify expired merchants
    INSERT INTO public.notifications (user_id, type, title, body)
    SELECT profile_id, 'subscription_expired',
           'انتهى اشتراكك ❌',
           'اشتراك ' || tier || ' انتهى. قم بالترقية لاستعادة ميزاتك.'
    FROM public.subscriptions
    WHERE status = 'Expired'
      AND profile_id NOT IN (
          SELECT user_id FROM public.notifications
          WHERE type = 'subscription_expired'
            AND created_at > NOW() - INTERVAL '1 day'
      );

    RETURN jsonb_build_object(
        'expiring_soon', v_expiring,
        'expired', v_expired,
        'run_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.subscription_lifecycle_check() TO authenticated;

-- Schedule daily lifecycle check at midnight (pg_cron)
DO $$
BEGIN
    PERFORM cron.schedule(
        'subscription-lifecycle-daily',
        '0 0 * * *',
        'SELECT public.subscription_lifecycle_check()'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available — run subscription_lifecycle_check() manually or via Edge Function';
END $$;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: W7 — Anonymous Fingerprint Tracking & Vote Limits
-- Branch: feature/v2-subdomain-portals
--
-- Creates:
--   1. anon_fingerprints table for tracking device fingerprints
--   2. check_anon_vote_limit function — validates 3-vote/24h limit
--   3. user_coupons.source column for grant_recognition tracking
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. ANONYMOUS FINGERPRINT TABLE
--    Stores device fingerprint hashes for anonymous vote tracking.
--    Used to enforce per-device vote limits per AGENTS.md spec.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.anon_fingerprints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint_hash TEXT NOT NULL,
    ip_hash TEXT,
    device_info JSONB DEFAULT '{}',
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    total_votes INTEGER DEFAULT 0,
    is_blocked BOOLEAN DEFAULT FALSE,
    UNIQUE (fingerprint_hash)
);

CREATE INDEX IF NOT EXISTS idx_anon_fp_hash ON public.anon_fingerprints (fingerprint_hash);

ALTER TABLE public.anon_fingerprints ENABLE ROW LEVEL SECURITY;

-- Only admins can read fingerprint data
DROP POLICY IF EXISTS "fp_admin_all" ON public.anon_fingerprints;
CREATE POLICY "fp_admin_all" ON public.anon_fingerprints
    FOR ALL USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════
-- 2. ANONYMOUS VOTE LOG
--    Logs individual anonymous votes linked to fingerprints.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.anon_vote_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint_hash TEXT NOT NULL REFERENCES public.anon_fingerprints(fingerprint_hash),
    business_id UUID NOT NULL REFERENCES public.businesses(id),
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('recommend', 'complain')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anon_vote_fp ON public.anon_vote_log (fingerprint_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_anon_vote_biz ON public.anon_vote_log (business_id);

ALTER TABLE public.anon_vote_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "avl_admin_all" ON public.anon_vote_log;
CREATE POLICY "avl_admin_all" ON public.anon_vote_log
    FOR ALL USING (public.is_platform_admin());

-- Allow anonymous inserts (no auth required)
DROP POLICY IF EXISTS "avl_anon_insert" ON public.anon_vote_log;
CREATE POLICY "avl_anon_insert" ON public.anon_vote_log
    FOR INSERT WITH CHECK (TRUE);


-- ═══════════════════════════════════════════════════════════
-- 3. CHECK ANONYMOUS VOTE LIMIT RPC
--    Returns whether a fingerprint can vote (under 3/24h limit).
--    Auto-creates fingerprint record if not exists.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.check_anon_vote_limit(TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.check_anon_vote_limit(
    p_fingerprint TEXT,
    p_ip_hash TEXT DEFAULT NULL,
    p_device_info JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_fp RECORD;
    v_recent_count INTEGER;
    v_max_votes INTEGER;
BEGIN
    -- Get max votes from platform_config, default 3
    SELECT COALESCE((value::TEXT)::INTEGER, 3) INTO v_max_votes
    FROM public.platform_config WHERE key = 'max_anon_votes_per_day';
    IF v_max_votes IS NULL THEN v_max_votes := 3; END IF;

    -- Upsert fingerprint
    INSERT INTO public.anon_fingerprints (fingerprint_hash, ip_hash, device_info)
    VALUES (p_fingerprint, p_ip_hash, p_device_info)
    ON CONFLICT (fingerprint_hash) DO UPDATE SET
        last_seen_at = NOW(),
        ip_hash = COALESCE(EXCLUDED.ip_hash, public.anon_fingerprints.ip_hash),
        device_info = COALESCE(EXCLUDED.device_info, public.anon_fingerprints.device_info)
    RETURNING * INTO v_fp;

    -- Check if blocked
    IF v_fp.is_blocked THEN
        RETURN jsonb_build_object(
            'allowed', FALSE,
            'reason', 'blocked',
            'remaining', 0
        );
    END IF;

    -- Count votes in last 24 hours
    SELECT COUNT(*) INTO v_recent_count
    FROM public.anon_vote_log
    WHERE fingerprint_hash = p_fingerprint
      AND created_at > NOW() - INTERVAL '24 hours';

    RETURN jsonb_build_object(
        'allowed', v_recent_count < v_max_votes,
        'remaining', GREATEST(0, v_max_votes - v_recent_count),
        'total_votes', v_fp.total_votes,
        'limit', v_max_votes
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_anon_vote_limit(TEXT, TEXT, JSONB) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════
-- 4. RECORD ANONYMOUS VOTE RPC
--    Records a vote and increments fingerprint counter.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.record_anon_vote(TEXT, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.record_anon_vote(
    p_fingerprint TEXT,
    p_business_id UUID,
    p_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_check JSONB;
BEGIN
    -- Validate vote type
    IF p_type NOT IN ('recommend', 'complain') THEN
        RAISE EXCEPTION 'Invalid interaction type' USING ERRCODE = 'P0001';
    END IF;

    -- Check limit
    v_check := public.check_anon_vote_limit(p_fingerprint, NULL, '{}');
    IF NOT (v_check->>'allowed')::BOOLEAN THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'vote_limit_exceeded',
            'remaining', 0
        );
    END IF;

    -- Record the vote
    INSERT INTO public.anon_vote_log (fingerprint_hash, business_id, interaction_type)
    VALUES (p_fingerprint, p_business_id, p_type);

    -- Increment total votes
    UPDATE public.anon_fingerprints
    SET total_votes = total_votes + 1
    WHERE fingerprint_hash = p_fingerprint;

    RETURN jsonb_build_object(
        'success', TRUE,
        'remaining', (v_check->>'remaining')::INTEGER - 1
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_anon_vote(TEXT, UUID, TEXT) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════
-- 5. ADD source COLUMN TO user_coupons (for grant_recognition)
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_coupons' AND column_name = 'source'
    ) THEN
        ALTER TABLE public.user_coupons ADD COLUMN source TEXT DEFAULT 'campaign';
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: W13 — IP Rate Limiting + Notification Triggers
-- Branch: feature/v2-subdomain-portals
--
-- Enhancements:
--   1. IP-based rate limiting for anonymous votes (secondary defense)
--   2. Notification triggers: vote milestone, coupon redeemed
--   3. Relax notifications type CHECK to support new types
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. RELAX NOTIFICATIONS TYPE CHECK CONSTRAINT
--    Add new notification types for vote milestones and coupons.
--    Must DROP + re-ADD the constraint (ALTER CHECK not supported).
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    -- Drop the existing CHECK constraint on notifications.type
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

    -- Re-add with expanded type list
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
        'subscription_expiring',
        'subscription_expired',
        'claim_approved',
        'claim_rejected',
        'tier_upgrade_approved',
        'tier_upgrade_rejected',
        'system_announcement',
        'payment_received',
        'payment_overdue',
        'vote_milestone',
        'coupon_redeemed',
        'coupon_granted',
        'campaign_expired'
    ));

    RAISE NOTICE 'Notification type constraint updated with new types';
EXCEPTION
    WHEN undefined_object THEN
        -- Constraint doesn't exist yet, add it fresh
        ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
            'subscription_expiring', 'subscription_expired',
            'claim_approved', 'claim_rejected',
            'tier_upgrade_approved', 'tier_upgrade_rejected',
            'system_announcement', 'payment_received', 'payment_overdue',
            'vote_milestone', 'coupon_redeemed', 'coupon_granted', 'campaign_expired'
        ));
END $$;


-- ═══════════════════════════════════════════════════════════
-- 2. ADD ip_address COLUMN TO anon_vote_log
--    Store raw IP per vote for secondary rate limiting.
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'anon_vote_log' AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE public.anon_vote_log ADD COLUMN ip_address TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_anon_vote_ip ON public.anon_vote_log (ip_address, created_at);


-- ═══════════════════════════════════════════════════════════
-- 3. UPGRADE record_anon_vote — ADD IP PARAMETER + PER-IP LIMIT
--    New signature: (TEXT, UUID, TEXT, TEXT)
--    4th param = client IP address for secondary rate limiting.
--    Per-IP limit: max 15 votes per 24h across ALL fingerprints.
-- ═══════════════════════════════════════════════════════════

-- Drop the old 3-param version
DROP FUNCTION IF EXISTS public.record_anon_vote(TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.record_anon_vote(
    p_fingerprint TEXT,
    p_business_id UUID,
    p_type TEXT,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_check JSONB;
    v_ip_count INTEGER;
    v_max_ip_votes INTEGER := 15;
BEGIN
    -- Validate vote type
    IF p_type NOT IN ('recommend', 'complain') THEN
        RAISE EXCEPTION 'Invalid interaction type' USING ERRCODE = 'P0001';
    END IF;

    -- Check per-fingerprint limit (existing logic)
    v_check := public.check_anon_vote_limit(p_fingerprint, NULL, '{}');
    IF NOT (v_check->>'allowed')::BOOLEAN THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'vote_limit_exceeded',
            'remaining', 0
        );
    END IF;

    -- Secondary defense: per-IP rate limit (15 votes/24h across all fingerprints)
    IF p_ip_address IS NOT NULL AND p_ip_address != '' THEN
        SELECT COUNT(*) INTO v_ip_count
        FROM public.anon_vote_log
        WHERE ip_address = p_ip_address
          AND created_at > NOW() - INTERVAL '24 hours';

        IF v_ip_count >= v_max_ip_votes THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'ip_rate_limit_exceeded',
                'remaining', 0
            );
        END IF;
    END IF;

    -- Record the vote (now with IP)
    INSERT INTO public.anon_vote_log (fingerprint_hash, business_id, interaction_type, ip_address)
    VALUES (p_fingerprint, p_business_id, p_type, p_ip_address);

    -- Increment total votes on fingerprint
    UPDATE public.anon_fingerprints
    SET total_votes = total_votes + 1
    WHERE fingerprint_hash = p_fingerprint;

    RETURN jsonb_build_object(
        'success', TRUE,
        'remaining', (v_check->>'remaining')::INTEGER - 1
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_anon_vote(TEXT, UUID, TEXT, TEXT) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════
-- 4. VOTE MILESTONE NOTIFICATION TRIGGER
--    Fires when a business reaches 10, 50, 100 votes.
--    Notifies the business owner (claimed_by) via notifications table.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_vote_milestone_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_biz RECORD;
    v_vote_count INTEGER;
    v_milestone INTEGER;
BEGIN
    -- Only fire for businesses with an owner
    SELECT b.id, b.name, b.claimed_by INTO v_biz
    FROM public.businesses b
    WHERE b.id = NEW.business_id AND b.claimed_by IS NOT NULL;

    IF NOT FOUND THEN RETURN NEW; END IF;

    -- Count total votes
    SELECT COUNT(*) INTO v_vote_count
    FROM public.logs
    WHERE business_id = NEW.business_id;

    -- Check milestone thresholds
    v_milestone := CASE
        WHEN v_vote_count = 10 THEN 10
        WHEN v_vote_count = 50 THEN 50
        WHEN v_vote_count = 100 THEN 100
        WHEN v_vote_count = 500 THEN 500
        WHEN v_vote_count = 1000 THEN 1000
        ELSE NULL
    END;

    IF v_milestone IS NOT NULL THEN
        -- Check not already notified for this milestone
        IF NOT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE profile_id = v_biz.claimed_by
              AND type = 'vote_milestone'
              AND (metadata->>'milestone')::INTEGER = v_milestone
              AND (metadata->>'business_id')::TEXT = v_biz.id::TEXT
        ) THEN
            INSERT INTO public.notifications (profile_id, type, title, message, metadata)
            VALUES (
                v_biz.claimed_by,
                'vote_milestone',
                format('🎉 وصل %s إلى %s تقدير!', v_biz.name, v_milestone),
                format('نشاطك التجاري %s حصل على %s تقييم. أنت تبني سمعة رقمية قوية!', v_biz.name, v_milestone),
                jsonb_build_object('business_id', v_biz.id, 'milestone', v_milestone, 'business_name', v_biz.name)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_logs_vote_milestone ON public.logs;
CREATE TRIGGER trg_logs_vote_milestone
    AFTER INSERT ON public.logs
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_vote_milestone_notify();


-- ═══════════════════════════════════════════════════════════
-- 5. COUPON REDEEMED NOTIFICATION TRIGGER
--    When a coupon status changes to 'REDEEMED', notify the
--    merchant (business owner) that a customer used their coupon.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_coupon_redeemed_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_biz RECORD;
BEGIN
    -- Only fire when status transitions to REDEEMED
    IF NEW.status = 'REDEEMED' AND (OLD.status IS NULL OR OLD.status != 'REDEEMED') THEN
        -- Get business owner
        SELECT b.id, b.name, b.claimed_by INTO v_biz
        FROM public.businesses b
        WHERE b.id = NEW.business_id AND b.claimed_by IS NOT NULL;

        IF FOUND THEN
            INSERT INTO public.notifications (profile_id, type, title, message, metadata)
            VALUES (
                v_biz.claimed_by,
                'coupon_redeemed',
                '🎫 تم استخدام كوبون!',
                format('تم استخدام كوبون بقيمة %s في %s', NEW.discount_value || ' ' || COALESCE(NEW.discount_type, ''), v_biz.name),
                jsonb_build_object('business_id', v_biz.id, 'coupon_id', NEW.id, 'discount_value', NEW.discount_value)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coupon_redeemed ON public.user_coupons;
CREATE TRIGGER trg_coupon_redeemed
    AFTER UPDATE ON public.user_coupons
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_coupon_redeemed_notify();


-- ═══════════════════════════════════════════════════════════
-- 6. COUPON GRANTED NOTIFICATION TRIGGER
--    When a merchant grants a coupon (INSERT with source='grant_recognition'),
--    notify the consumer.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_coupon_granted_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_biz_name TEXT;
BEGIN
    IF NEW.source = 'grant_recognition' AND NEW.user_id IS NOT NULL THEN
        SELECT name INTO v_biz_name FROM public.businesses WHERE id = NEW.business_id;

        INSERT INTO public.notifications (profile_id, type, title, message, metadata)
        VALUES (
            NEW.user_id,
            'coupon_granted',
            '🎁 حصلت على مكافأة!',
            format('منحك %s كوبون خصم %s. تحقق من محفظة الكوبونات.',
                COALESCE(v_biz_name, 'تاجر'),
                NEW.discount_value || ' ' || COALESCE(NEW.discount_type, '')
            ),
            jsonb_build_object('business_id', NEW.business_id, 'coupon_id', NEW.id, 'discount_value', NEW.discount_value)
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coupon_granted ON public.user_coupons;
CREATE TRIGGER trg_coupon_granted
    AFTER INSERT ON public.user_coupons
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_coupon_granted_notify();


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: W14 — Admin Audit Log + Subscription Grace Period
-- Branch: feature/v2-subdomain-portals
--
-- Creates:
--   1. admin_audit_log table for tracking admin actions
--   2. Subscription grace_period_days default + dashboard helpers
--   3. RPC: log_admin_action (generic audit entry)
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. ADMIN AUDIT LOG TABLE
--    Records every admin action for accountability and dispute
--    resolution. Immutable — no UPDATE or DELETE policies.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,  -- 'business', 'user', 'subscription', 'payment', 'claim'
    target_id UUID,
    details JSONB DEFAULT '{}'::JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit log
DROP POLICY IF EXISTS "audit_admin_read" ON public.admin_audit_log;
CREATE POLICY "audit_admin_read" ON public.admin_audit_log
    FOR SELECT USING (public.is_platform_admin());

-- Only system (SECURITY DEFINER functions) can insert
DROP POLICY IF EXISTS "audit_system_insert" ON public.admin_audit_log;
CREATE POLICY "audit_system_insert" ON public.admin_audit_log
    FOR INSERT WITH CHECK (public.is_platform_admin());

CREATE INDEX IF NOT EXISTS idx_audit_admin ON public.admin_audit_log (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON public.admin_audit_log (target_type, target_id);


-- ═══════════════════════════════════════════════════════════
-- 2. LOG ADMIN ACTION RPC
--    Called by admin components after any mutation.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_action TEXT,
    p_target_type TEXT,
    p_target_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_details)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, UUID, JSONB) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 3. ENSURE GRACE PERIOD COLUMN ON SUBSCRIPTIONS
--    Default 3 days grace period for all subscriptions.
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'grace_period_days'
    ) THEN
        ALTER TABLE public.subscriptions ADD COLUMN grace_period_days INTEGER DEFAULT 3;
    ELSE
        -- Ensure default is set
        ALTER TABLE public.subscriptions ALTER COLUMN grace_period_days SET DEFAULT 3;
    END IF;
END $$;

-- Update existing rows without grace period
UPDATE public.subscriptions
SET grace_period_days = 3
WHERE grace_period_days IS NULL OR grace_period_days = 0;


-- ═══════════════════════════════════════════════════════════
-- 4. MERCHANT GRACE PERIOD CHECK RPC
--    Returns subscription status with grace period awareness.
--    Used by merchant dashboard to show grace period banner.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_subscription_status(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sub RECORD;
BEGIN
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE business_id = p_business_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'none', 'tier', 'Free');
    END IF;

    -- Check if in grace period
    IF v_sub.status = 'Grace Period' AND v_sub.expires_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'status', 'grace_period',
            'tier', v_sub.tier,
            'expires_at', v_sub.expires_at,
            'grace_until', v_sub.expires_at + (COALESCE(v_sub.grace_period_days, 3) || ' days')::INTERVAL,
            'days_remaining', EXTRACT(DAY FROM
                (v_sub.expires_at + (COALESCE(v_sub.grace_period_days, 3) || ' days')::INTERVAL) - NOW()
            )::INTEGER
        );
    END IF;

    -- Check if expired
    IF v_sub.status = 'Expired' THEN
        RETURN jsonb_build_object(
            'status', 'expired',
            'tier', v_sub.tier,
            'expired_at', v_sub.expires_at
        );
    END IF;

    -- Active subscription
    RETURN jsonb_build_object(
        'status', 'active',
        'tier', v_sub.tier,
        'expires_at', v_sub.expires_at,
        'days_remaining', CASE
            WHEN v_sub.expires_at IS NOT NULL
            THEN GREATEST(0, EXTRACT(DAY FROM v_sub.expires_at - NOW())::INTEGER)
            ELSE NULL
        END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_status(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: submit_vote RPC
-- Branch: feature/v2-subdomain-portals
--
-- Creates the submit_vote server-side RPC that the
-- useVoteSubmission hook calls. This RPC handles:
--   1. Merchant account blocking
--   2. Anonymous weekly limit (7 votes / 7 days / fingerprint)
--   3. 24-hour same-business cooldown
--   NOTE: Anonymous voters have 0.5 impact weight (not 1.0)
--   4. 30-day diminishing returns weight calculation
--   5. Shield enforcement (Level 1 = anonymous blocked, Level 2 = receipt required)
--   6. Log insertion with content flagging
--   7. Gader point awarding (+10 per vote for verified users)
--   8. Coupon award check (placeholder)
--
-- Returns JSON: { log_id, weight, created_at, new_gader_total,
--                 past_vote_count, reason_text, profile_id,
--                 fingerprint, coupon_awarded, error }
-- ============================================================

-- Drop ALL existing overloads to avoid "function name is not unique" error
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oid::regprocedure AS sig
        FROM pg_proc
        WHERE proname = 'submit_vote'
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.submit_vote(
    p_business_id UUID,
    p_interaction_type TEXT,
    p_reason_text TEXT DEFAULT NULL,
    p_profile_id UUID DEFAULT NULL,
    p_fingerprint TEXT DEFAULT NULL,
    p_is_flagged BOOLEAN DEFAULT FALSE,
    p_receipt_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id BIGINT;
    v_weight NUMERIC := 1.0;
    v_now TIMESTAMPTZ := NOW();
    v_cooldown_count INT;
    v_anon_count INT;
    v_past_vote_count INT := 0;
    v_new_gader INT;
    v_profile_role TEXT;
    v_profile_gader INT;
    v_shield_level INT := 0;
    v_claimed_by UUID;
BEGIN
    -- ═══════════════════════════════════════════════
    -- 1. MERCHANT BLOCK
    -- ═══════════════════════════════════════════════
    IF p_profile_id IS NOT NULL THEN
        SELECT role, gader_points INTO v_profile_role, v_profile_gader
        FROM public.profiles
        WHERE id = p_profile_id;

        IF v_profile_role = 'merchant' THEN
            RETURN jsonb_build_object('error', 'Merchant accounts cannot vote');
        END IF;
    END IF;

    -- ═══════════════════════════════════════════════
    -- 2. SHIELD ENFORCEMENT
    --    Level 1 (Trust Shield): Blocks anonymous complaints
    --    Level 2 (Fatora Shield): Requires receipt for complaints
    -- ═══════════════════════════════════════════════
    SELECT COALESCE(b.shield_level, 0), b.claimed_by
    INTO v_shield_level, v_claimed_by
    FROM public.businesses b
    WHERE b.id = p_business_id;

    -- Shield Level 1+: Block anonymous complaints (must be verified)
    IF v_shield_level >= 1 AND p_profile_id IS NULL AND p_interaction_type = 'complain' THEN
        RETURN jsonb_build_object('error', 'shield_requires_verification');
    END IF;

    -- Shield Level 2: Require receipt image for complaints (even verified users)
    IF v_shield_level >= 2 AND p_interaction_type = 'complain' THEN
        IF p_receipt_url IS NULL OR p_receipt_url = '' THEN
            RETURN jsonb_build_object('error', 'shield_requires_receipt');
        END IF;
    END IF;

    -- ═══════════════════════════════════════════════
    -- 3. ANONYMOUS WEEKLY LIMIT (7 votes / 7 days)
    -- ═══════════════════════════════════════════════
    IF p_profile_id IS NULL AND p_fingerprint IS NOT NULL THEN
        SELECT COUNT(*) INTO v_anon_count
        FROM public.logs
        WHERE fingerprint = p_fingerprint
          AND created_at > v_now - INTERVAL '7 days';

        IF v_anon_count >= 7 THEN
            RETURN jsonb_build_object('error', 'anonymous_weekly_limit');
        END IF;
    END IF;

    -- ═══════════════════════════════════════════════
    -- 4. 24-HOUR SAME-BUSINESS COOLDOWN
    -- ═══════════════════════════════════════════════
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_cooldown_count
        FROM public.logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at > v_now - INTERVAL '24 hours';
    ELSE
        SELECT COUNT(*) INTO v_cooldown_count
        FROM public.logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at > v_now - INTERVAL '24 hours';
    END IF;

    IF v_cooldown_count > 0 THEN
        RETURN jsonb_build_object('error', 'cooldown_active');
    END IF;

    -- ═══════════════════════════════════════════════
    -- 5. WEIGHT CALCULATION
    --    Tier multipliers (from trustEngine.js):
    --      Bronze (0-999):       1.0x
    --      Silver (1000-4999):   1.5x
    --      Gold   (5000-19999):  2.0x
    --      VIP    (20000+):      2.5x
    --    Diminishing returns (30-day same-business):
    --      First vote: 1.0, Second: 0.5, Third+: 0.25
    --    Anonymous: flat 0.5 weight (half impact)
    -- ═══════════════════════════════════════════════
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_past_vote_count
        FROM public.logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at > v_now - INTERVAL '30 days';

        -- Diminishing returns for repeated votes on same business
        IF v_past_vote_count = 0 THEN
            v_weight := 1.0;
        ELSIF v_past_vote_count = 1 THEN
            v_weight := 0.5;
        ELSE
            v_weight := 0.25;
        END IF;

        -- Tier-based multiplier (matches trustEngine.js)
        IF v_profile_gader IS NOT NULL THEN
            IF v_profile_gader >= 20000 THEN
                v_weight := v_weight * 2.5;     -- VIP/Diamond tier
            ELSIF v_profile_gader >= 5000 THEN
                v_weight := v_weight * 2.0;     -- Gold tier
            ELSIF v_profile_gader >= 1000 THEN
                v_weight := v_weight * 1.5;     -- Silver tier
            END IF;
            -- Bronze (0-999): multiplier stays 1.0x (no change)
        END IF;
    ELSE
        -- Anonymous: 0.5 weight (half impact, no tier bonus)
        v_weight := 0.5;
    END IF;

    -- ═══════════════════════════════════════════════
    -- 6. INSERT LOG
    -- ═══════════════════════════════════════════════
    INSERT INTO public.logs (
        business_id,
        interaction_type,
        reason_text,
        profile_id,
        fingerprint,
        weight,
        is_flagged,
        receipt_url,
        created_at
    ) VALUES (
        p_business_id,
        p_interaction_type,
        p_reason_text,
        p_profile_id,
        p_fingerprint,
        v_weight,
        p_is_flagged,
        p_receipt_url,
        v_now
    )
    RETURNING id INTO v_log_id;

    -- ═══════════════════════════════════════════════
    -- 7. AWARD GADER POINTS (+10 per vote for verified users)
    -- ═══════════════════════════════════════════════
    v_new_gader := NULL;
    IF p_profile_id IS NOT NULL THEN
        UPDATE public.profiles
        SET gader_points = COALESCE(gader_points, 0) + 10
        WHERE id = p_profile_id
        RETURNING gader_points INTO v_new_gader;
    END IF;

    -- ═══════════════════════════════════════════════
    -- 8. RETURN RESULT
    -- ═══════════════════════════════════════════════
    RETURN jsonb_build_object(
        'log_id', v_log_id,
        'weight', v_weight,
        'created_at', v_now,
        'new_gader_total', v_new_gader,
        'past_vote_count', v_past_vote_count,
        'reason_text', p_reason_text,
        'profile_id', p_profile_id,
        'fingerprint', p_fingerprint,
        'coupon_awarded', NULL
    );
END;
$$;

-- Grant execute to both anon and authenticated
GRANT EXECUTE ON FUNCTION public.submit_vote TO anon, authenticated;

-- Add shield_level column to businesses if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'businesses'
          AND column_name = 'shield_level'
    ) THEN
        ALTER TABLE public.businesses ADD COLUMN shield_level INT DEFAULT 0;
        RAISE NOTICE 'Added shield_level column to businesses';
    END IF;
END $$;

-- Add weight column to logs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'logs'
          AND column_name = 'weight'
    ) THEN
        ALTER TABLE public.logs ADD COLUMN weight NUMERIC DEFAULT 1.0;
        RAISE NOTICE 'Added weight column to logs';
    END IF;
END $$;

-- Add fingerprint column to logs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'logs'
          AND column_name = 'fingerprint'
    ) THEN
        ALTER TABLE public.logs ADD COLUMN fingerprint TEXT;
        RAISE NOTICE 'Added fingerprint column to logs';
    END IF;
END $$;

-- Add receipt_url column to logs if it doesn't exist (for Fatora Shield L2)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'logs'
          AND column_name = 'receipt_url'
    ) THEN
        ALTER TABLE public.logs ADD COLUMN receipt_url TEXT;
        RAISE NOTICE 'Added receipt_url column to logs';
    END IF;
END $$;

-- Add gader_points column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'gader_points'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN gader_points INT DEFAULT 0;
        RAISE NOTICE 'Added gader_points column to profiles';
    END IF;
END $$;

-- Add role column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'role'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';
        RAISE NOTICE 'Added role column to profiles';
    END IF;
END $$;
-- ============================================================
-- Hotfix: Fix check_log_content trigger column name
-- The trigger was referencing NEW.text but the column is reason_text
-- This was blocking ALL log inserts (including submit_vote RPC)
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_log_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_match RECORD;
    v_text TEXT;
BEGIN
    v_text := LOWER(COALESCE(NEW.reason_text, ''));

    -- Skip empty text
    IF v_text = '' THEN
        RETURN NEW;
    END IF;

    -- Check against the dictionary
    SELECT w.word, w.severity INTO v_match
    FROM public.content_filter_words w
    WHERE v_text LIKE '%' || LOWER(w.word) || '%'
    ORDER BY w.severity DESC   -- block > flag > shadow
    LIMIT 1;

    IF v_match IS NOT NULL THEN
        IF v_match.severity = 'block' THEN
            RAISE EXCEPTION 'المحتوى يحتوي على كلمات محظورة — يرجى تعديل النص'
                USING ERRCODE = 'P0010';
        ELSIF v_match.severity = 'shadow' THEN
            -- Allow but exclude from index calculations
            NEW.is_flagged := TRUE;
            NEW.flag_reason := 'shadow_filter: ' || v_match.word;
        ELSE
            -- flag: allow but mark for admin review
            NEW.is_flagged := TRUE;
            NEW.flag_reason := 'content_filter: ' || v_match.word;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Force PostgREST to reload
NOTIFY pgrst, 'reload schema';
-- ============================================================
-- Migration: Fix Admin Payment Pipeline — Full Schema Alignment
-- Branch: refactor-nextjs-phase2
--
-- ROOT CAUSE ANALYSIS:
-- ────────────────────
-- The admin financials page calls admin_confirm_payment and
-- admin_reject_payment RPCs that return 400 because:
--
--   1. subscriptions table (from 2026030101) has:
--      ❌ No profile_id column
--      ❌ No quotas column
--      ❌ No is_trial, trial_months columns
--      ❌ UNIQUE(business_id) instead of UNIQUE(profile_id)
--      ❌ CHECK (tier IN ('Tier 1','Tier 2')) blocks 'Pro','Enterprise','Growth','Free'
--
--   2. transactions table has:
--      ❌ CHECK (requested_tier IN ('Tier 1','Tier 2')) blocks new tier names
--      ❌ Missing: currency, gateway_reference, exchange_rate columns
--      ❌ Missing: payment_gateway column
--
--   3. RPCs from 20260325000700 use profile_id and quotas
--      that don't exist on the live table.
--
-- FIX: This migration evolves both tables idempotently, then
--      recreates the RPCs to match the actual live schema.
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. EVOLVE SUBSCRIPTIONS TABLE
--    Add missing columns + fix constraints
-- ═══════════════════════════════════════════════════════════

-- 1a. Add profile_id column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='subscriptions'
                   AND column_name='profile_id') THEN
        ALTER TABLE public.subscriptions ADD COLUMN profile_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- 1b. Add quotas column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='subscriptions'
                   AND column_name='quotas') THEN
        ALTER TABLE public.subscriptions ADD COLUMN quotas JSONB DEFAULT '{}';
    END IF;
END $$;

-- 1c. Add is_trial + trial_months columns
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='subscriptions'
                   AND column_name='is_trial') THEN
        ALTER TABLE public.subscriptions ADD COLUMN is_trial BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='subscriptions'
                   AND column_name='trial_months') THEN
        ALTER TABLE public.subscriptions ADD COLUMN trial_months INTEGER DEFAULT 0;
    END IF;
END $$;

-- 1d. Add addons column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='subscriptions'
                   AND column_name='addons') THEN
        ALTER TABLE public.subscriptions ADD COLUMN addons JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 1e. Add grace_period_days column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='subscriptions'
                   AND column_name='grace_period_days') THEN
        ALTER TABLE public.subscriptions ADD COLUMN grace_period_days INTEGER DEFAULT 3;
    END IF;
END $$;

-- 1f. Backfill profile_id from businesses.claimed_by
UPDATE public.subscriptions s
SET profile_id = b.claimed_by
FROM public.businesses b
WHERE s.business_id = b.id
  AND s.profile_id IS NULL
  AND b.claimed_by IS NOT NULL;

-- 1g. Add UNIQUE constraint on profile_id (if missing)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema='public' AND table_name='subscriptions'
        AND constraint_name='subscriptions_profile_id_unique'
    ) THEN
        ALTER TABLE public.subscriptions
            DROP CONSTRAINT IF EXISTS subscriptions_profile_id_unique;
        -- Only add if we won't get duplicates
        IF (SELECT COUNT(*) FROM (
            SELECT profile_id FROM public.subscriptions
            WHERE profile_id IS NOT NULL
            GROUP BY profile_id HAVING COUNT(*) > 1
        ) dupes) = 0 THEN
            ALTER TABLE public.subscriptions
                ADD CONSTRAINT subscriptions_profile_id_unique UNIQUE (profile_id);
        END IF;
    END IF;
END $$;

-- 1h. Drop restrictive tier CHECK constraint
--     The old constraint blocks new tier names like 'Pro', 'Enterprise', 'Growth', 'Free'
DO $$ BEGIN
    -- Drop ALL check constraints on the 'tier' column
    PERFORM 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu
        ON cc.constraint_name = ccu.constraint_name
    WHERE ccu.table_schema = 'public'
      AND ccu.table_name = 'subscriptions'
      AND ccu.column_name = 'tier';

    IF FOUND THEN
        -- Get and drop the constraint dynamically
        EXECUTE (
            SELECT string_agg('ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS ' || quote_ident(cc.constraint_name), '; ')
            FROM information_schema.check_constraints cc
            JOIN information_schema.constraint_column_usage ccu
                ON cc.constraint_name = ccu.constraint_name
            WHERE ccu.table_schema = 'public'
              AND ccu.table_name = 'subscriptions'
              AND ccu.column_name = 'tier'
        );
    END IF;
END $$;

-- 1i. Drop restrictive status CHECK constraint too (needs 'Suspended', 'Terminated', 'Grace Period')
DO $$ BEGIN
    EXECUTE (
        SELECT COALESCE(
            string_agg('ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS ' || quote_ident(cc.constraint_name), '; '),
            'SELECT 1'
        )
        FROM information_schema.check_constraints cc
        JOIN information_schema.constraint_column_usage ccu
            ON cc.constraint_name = ccu.constraint_name
        WHERE ccu.table_schema = 'public'
          AND ccu.table_name = 'subscriptions'
          AND ccu.column_name = 'status'
    );
END $$;


-- ═══════════════════════════════════════════════════════════
-- 2. EVOLVE TRANSACTIONS TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id),
    business_id UUID REFERENCES public.businesses(id),
    requested_tier TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='currency') THEN
        ALTER TABLE public.transactions ADD COLUMN currency TEXT DEFAULT 'LYD';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='gateway_reference') THEN
        ALTER TABLE public.transactions ADD COLUMN gateway_reference TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='exchange_rate') THEN
        ALTER TABLE public.transactions ADD COLUMN exchange_rate NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='duration') THEN
        ALTER TABLE public.transactions ADD COLUMN duration TEXT DEFAULT 'Month 1';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='screenshot_url') THEN
        ALTER TABLE public.transactions ADD COLUMN screenshot_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='payment_gateway') THEN
        ALTER TABLE public.transactions ADD COLUMN payment_gateway TEXT DEFAULT 'bank_transfer';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='proof_url') THEN
        ALTER TABLE public.transactions ADD COLUMN proof_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='rejection_reason') THEN
        ALTER TABLE public.transactions ADD COLUMN rejection_reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='confirmed_by') THEN
        ALTER TABLE public.transactions ADD COLUMN confirmed_by UUID REFERENCES public.profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='updated_at') THEN
        ALTER TABLE public.transactions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Drop restrictive requested_tier CHECK constraint
DO $$ BEGIN
    EXECUTE (
        SELECT COALESCE(
            string_agg('ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS ' || quote_ident(cc.constraint_name), '; '),
            'SELECT 1'
        )
        FROM information_schema.check_constraints cc
        JOIN information_schema.constraint_column_usage ccu
            ON cc.constraint_name = ccu.constraint_name
        WHERE ccu.table_schema = 'public'
          AND ccu.table_name = 'transactions'
          AND ccu.column_name = 'requested_tier'
    );
END $$;

-- Drop restrictive status CHECK too (if it only allows old values)
DO $$ BEGIN
    EXECUTE (
        SELECT COALESCE(
            string_agg('ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS ' || quote_ident(cc.constraint_name), '; '),
            'SELECT 1'
        )
        FROM information_schema.check_constraints cc
        JOIN information_schema.constraint_column_usage ccu
            ON cc.constraint_name = ccu.constraint_name
        WHERE ccu.table_schema = 'public'
          AND ccu.table_name = 'transactions'
          AND ccu.column_name = 'status'
    );
END $$;


-- ═══════════════════════════════════════════════════════════
-- 3. RLS POLICIES (idempotent)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "txn_select_own" ON public.transactions;
CREATE POLICY "txn_select_own" ON public.transactions
    FOR SELECT USING (owner_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "txn_insert_own" ON public.transactions;
CREATE POLICY "txn_insert_own" ON public.transactions
    FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "txn_update_admin" ON public.transactions;
CREATE POLICY "txn_update_admin" ON public.transactions
    FOR UPDATE USING (public.is_platform_admin());

DROP POLICY IF EXISTS "txn_all_admin" ON public.transactions;
CREATE POLICY "txn_all_admin" ON public.transactions
    FOR ALL USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════
-- 4. PAYMENT AUDIT LOG TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL DEFAULT 'transaction',
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evolve payment_audit_log: add missing columns if table already existed
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='payment_audit_log'
                   AND column_name='actor_id') THEN
        ALTER TABLE public.payment_audit_log ADD COLUMN actor_id UUID REFERENCES public.profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='payment_audit_log'
                   AND column_name='metadata') THEN
        ALTER TABLE public.payment_audit_log ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='payment_audit_log'
                   AND column_name='entity_type') THEN
        ALTER TABLE public.payment_audit_log ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'transaction';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='payment_audit_log'
                   AND column_name='entity_id') THEN
        ALTER TABLE public.payment_audit_log ADD COLUMN entity_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='payment_audit_log'
                   AND column_name='action') THEN
        ALTER TABLE public.payment_audit_log ADD COLUMN action TEXT NOT NULL DEFAULT 'unknown';
    END IF;
END $$;

ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pal_admin_all" ON public.payment_audit_log;
CREATE POLICY "pal_admin_all" ON public.payment_audit_log
    FOR ALL USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════
-- 5. DROP ALL EXISTING RPC OVERLOADS
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'admin_confirm_payment'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
    END LOOP;

    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'admin_reject_payment'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
    END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════
-- 6. ADMIN CONFIRM PAYMENT RPC
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_confirm_payment(p_txn_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_txn RECORD;
    v_quotas JSONB;
    v_duration_days INTEGER;
    v_duration_text TEXT;
BEGIN
    -- Admin gate
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    -- Fetch pending transaction
    SELECT * INTO v_txn FROM public.transactions WHERE id = p_txn_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_txn.status != 'pending' THEN
        RAISE EXCEPTION 'Transaction is not pending (status: %)', v_txn.status USING ERRCODE = 'P0003';
    END IF;

    -- Look up tier quotas (safe: table may not exist)
    BEGIN
        SELECT allocations INTO v_quotas
        FROM public.subscription_tiers
        WHERE LOWER(name) = LOWER(v_txn.requested_tier)
        LIMIT 1;
    EXCEPTION WHEN undefined_table THEN
        v_quotas := NULL;
    END;
    v_quotas := COALESCE(v_quotas, '{}'::jsonb);

    -- Parse duration: "Month 1" → 30, "Month 3" → 90, "30 Days" → 30
    v_duration_text := COALESCE(v_txn.duration, 'Month 1');
    v_duration_days := CASE
        WHEN v_duration_text ~* '(\d+)' THEN
            (regexp_match(v_duration_text, '(\d+)'))[1]::INTEGER * 30
        ELSE 30
    END;
    -- Clamp: if someone wrote "30 Days", don't multiply by 30
    IF v_duration_text ~* 'day' THEN
        v_duration_days := (regexp_match(v_duration_text, '(\d+)'))[1]::INTEGER;
    END IF;

    -- Mark transaction completed
    UPDATE public.transactions
    SET status = 'completed',
        confirmed_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_txn_id;

    -- Upsert subscription
    -- Uses profile_id if column exists, otherwise business_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='subscriptions' AND column_name='profile_id'
    ) THEN
        -- Profile-centric upsert (newer schema)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='subscriptions' AND column_name='quotas'
        ) THEN
            INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at, quotas)
            VALUES (v_txn.business_id, v_txn.owner_id, v_txn.requested_tier,
                    'Active', NOW() + (v_duration_days || ' days')::interval, v_quotas)
            ON CONFLICT (profile_id)
            DO UPDATE SET
                tier = EXCLUDED.tier,
                status = 'Active',
                expires_at = EXCLUDED.expires_at,
                business_id = EXCLUDED.business_id,
                quotas = EXCLUDED.quotas;
        ELSE
            INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at)
            VALUES (v_txn.business_id, v_txn.owner_id, v_txn.requested_tier,
                    'Active', NOW() + (v_duration_days || ' days')::interval)
            ON CONFLICT (profile_id)
            DO UPDATE SET
                tier = EXCLUDED.tier,
                status = 'Active',
                expires_at = EXCLUDED.expires_at,
                business_id = EXCLUDED.business_id;
        END IF;
    ELSE
        -- Business-centric upsert (original schema)
        INSERT INTO public.subscriptions (business_id, tier, status, expires_at)
        VALUES (v_txn.business_id, v_txn.requested_tier,
                'Active', NOW() + (v_duration_days || ' days')::interval)
        ON CONFLICT (business_id)
        DO UPDATE SET
            tier = EXCLUDED.tier,
            status = 'Active',
            expires_at = EXCLUDED.expires_at;
    END IF;

    -- Audit log
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES ('transaction', p_txn_id, 'confirmed', auth.uid(),
            jsonb_build_object(
                'tier', v_txn.requested_tier,
                'amount', v_txn.amount,
                'duration_days', v_duration_days,
                'merchant_id', v_txn.owner_id
            ));

    -- Notify merchant (safe: table may not exist)
    BEGIN
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (v_txn.owner_id, 'payment_confirmed',
                'تمت الموافقة على طلب الترقية ✅',
                'تم تفعيل اشتراك ' || v_txn.requested_tier || ' لمدة ' || v_duration_days || ' يوم. مبروك!');
    EXCEPTION WHEN undefined_table THEN NULL;
              WHEN undefined_column THEN NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'txn_id', p_txn_id,
        'tier', v_txn.requested_tier,
        'duration_days', v_duration_days,
        'expires_at', NOW() + (v_duration_days || ' days')::interval
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_confirm_payment(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 7. ADMIN REJECT PAYMENT RPC
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_reject_payment(
    p_txn_id UUID,
    p_reason TEXT DEFAULT 'غير مطابق للشروط'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_txn RECORD;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_txn FROM public.transactions WHERE id = p_txn_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_txn.status != 'pending' THEN
        RAISE EXCEPTION 'Transaction is not pending (status: %)', v_txn.status USING ERRCODE = 'P0003';
    END IF;

    -- Reject the transaction
    UPDATE public.transactions
    SET status = 'rejected',
        rejection_reason = p_reason,
        confirmed_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_txn_id;

    -- Audit log
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES ('transaction', p_txn_id, 'rejected', auth.uid(),
            jsonb_build_object('reason', p_reason, 'merchant_id', v_txn.owner_id));

    -- Notify merchant
    BEGIN
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (v_txn.owner_id, 'payment_rejected',
                'تم رفض طلب الترقية ❌',
                'السبب: ' || p_reason || '. يمكنك إعادة المحاولة.');
    EXCEPTION WHEN undefined_table THEN NULL;
              WHEN undefined_column THEN NULL;
    END;

    RETURN jsonb_build_object('success', true, 'txn_id', p_txn_id, 'reason', p_reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_payment(UUID, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 8. SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
