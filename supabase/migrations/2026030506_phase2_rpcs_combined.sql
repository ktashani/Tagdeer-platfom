
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
    SELECT tier INTO v_sub_tier FROM public.subscriptions WHERE profile_id = v_merchant_id AND status = 'active';
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
    SELECT tier INTO v_sub_tier FROM public.subscriptions WHERE profile_id = v_merchant_id AND status = 'active';
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

