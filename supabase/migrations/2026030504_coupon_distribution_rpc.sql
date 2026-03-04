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
