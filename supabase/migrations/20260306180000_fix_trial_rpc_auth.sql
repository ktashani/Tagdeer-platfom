-- 20260306180000_fix_trial_rpc_auth.sql

-- Redeploy the RPC to skip checking auth.uid() since
-- users log in via custom OTP mechanisms that bypass formal Supabase Auth sessions,
-- or act as dev mock users. The frontend/API is responsible for enforcing business ownership via RLS or context.
CREATE OR REPLACE FUNCTION redeem_trial_campaign(p_business_id UUID, p_campaign_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_merchant_id UUID;
    v_campaign RECORD;
    v_existing_sub RECORD;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Check if business exists at all
    SELECT claimed_by INTO v_merchant_id FROM public.businesses WHERE id = p_business_id;
    
    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Business not found or unclaimed');
    END IF;

    -- Removed auth.uid() check because users log in via WhatsApp/Mock without sessions.

    -- 2. Lock and Fetch Campaign details
    SELECT * INTO v_campaign 
    FROM public.trial_campaigns 
    WHERE id = p_campaign_id 
    FOR UPDATE; -- Prevent race conditions on 'current_redemptions'

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Campaign not found');
    END IF;

    IF NOT v_campaign.is_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'This trial campaign is no longer active');
    END IF;

    IF v_campaign.expires_at IS NOT NULL AND v_campaign.expires_at < NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'This trial campaign has expired');
    END IF;

    IF v_campaign.current_redemptions >= v_campaign.max_redemptions THEN
        RETURN jsonb_build_object('success', false, 'error', 'This trial campaign has reached its redemption limit');
    END IF;

    -- 3. Check if business already redeemed this specific campaign
    IF EXISTS (SELECT 1 FROM public.trial_campaign_redemptions WHERE campaign_id = p_campaign_id AND business_id = p_business_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Your business has already redeemed this trial');
    END IF;

    -- 4. Check existing active subscription (prevent overriding a paid subscription with a trial)
    SELECT * INTO v_existing_sub FROM public.subscriptions WHERE business_id = p_business_id;
    IF FOUND AND (v_existing_sub.status = 'Active' OR v_existing_sub.status = 'Pending') THEN
        IF NOT v_existing_sub.is_trial THEN
            RETURN jsonb_build_object('success', false, 'error', 'Active paid subscriptions cannot be replaced by a free trial');
        END IF;
    END IF;

    -- 5. Calculate expiry
    v_expires_at := NOW() + (v_campaign.trial_months || ' months')::interval;

    -- 6. Execute updates
    INSERT INTO public.trial_campaign_redemptions (campaign_id, business_id) VALUES (p_campaign_id, p_business_id);
    
    UPDATE public.trial_campaigns SET current_redemptions = current_redemptions + 1 WHERE id = p_campaign_id;

    INSERT INTO public.subscriptions (business_id, tier, addons, status, expires_at, is_trial, trial_months)
    VALUES (p_business_id, v_campaign.tier, v_campaign.addons, 'Active', v_expires_at, true, v_campaign.trial_months)
    ON CONFLICT (business_id) 
    DO UPDATE SET 
        tier = EXCLUDED.tier,
        addons = EXCLUDED.addons,
        status = 'Active',
        expires_at = EXCLUDED.expires_at,
        is_trial = true,
        trial_months = v_campaign.trial_months;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Successfully redeemed ' || v_campaign.tier || ' trial for ' || v_campaign.trial_months || ' months!',
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
