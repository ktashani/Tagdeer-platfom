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
