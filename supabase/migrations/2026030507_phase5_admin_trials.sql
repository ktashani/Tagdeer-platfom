CREATE OR REPLACE FUNCTION admin_grant_free_trial(p_business_id UUID, p_tier TEXT, p_months INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Calculate new expiry date based on requested trial months
    v_expires_at := NOW() + (p_months || ' months')::interval;

    -- Upsert the subscription record marking it as a trial
    INSERT INTO public.subscriptions (business_id, tier, status, expires_at, is_trial, trial_months)
    VALUES (p_business_id, p_tier, 'Active', v_expires_at, true, p_months)
    ON CONFLICT (business_id) 
    DO UPDATE SET 
        tier = EXCLUDED.tier,
        status = 'Active',
        expires_at = EXCLUDED.expires_at,
        is_trial = true,
        trial_months = p_months;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Granted ' || p_tier || ' trial for ' || p_months || ' months'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
