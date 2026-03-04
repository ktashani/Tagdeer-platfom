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
