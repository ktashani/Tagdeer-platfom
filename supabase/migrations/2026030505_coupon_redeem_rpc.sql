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
