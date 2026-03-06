-- ========================================================
-- Migration: Trial Campaigns System
-- Description: Adds tables and functions to allow admins
--              to generate shareable trial links with
--              specific tiers, addons, duration, and limits.
-- ========================================================

-- 1. Ensure subscriptions table supports addons (if it doesn't already)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscriptions'
          AND column_name = 'addons'
    ) THEN
        ALTER TABLE public.subscriptions ADD COLUMN addons JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. Create Trial Campaigns table
CREATE TABLE IF NOT EXISTS public.trial_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'Pro',
    addons JSONB DEFAULT '[]'::jsonb,
    trial_months INTEGER NOT NULL DEFAULT 3,
    max_redemptions INTEGER NOT NULL DEFAULT 50,
    current_redemptions INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Optional expiration
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.trial_campaigns ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "Admins manage trial campaigns" ON public.trial_campaigns
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin', 'assistant_admin')
        )
    );

-- Anyone authenticated can view active campaigns (for the banner)
CREATE POLICY "Public can view active campaigns" ON public.trial_campaigns
    FOR SELECT
    USING (is_active = true);


-- 3. Create Trial Campaign Redemptions (Tracks who claimed what)
CREATE TABLE IF NOT EXISTS public.trial_campaign_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.trial_campaigns(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, business_id) -- Prevent same biz claiming twice
);

-- Enable RLS
ALTER TABLE public.trial_campaign_redemptions ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own redemptions
CREATE POLICY "Merchants view own redemptions" ON public.trial_campaign_redemptions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.businesses 
            WHERE id = business_id AND claimed_by = auth.uid()
        )
    );

-- Admins can view all
CREATE POLICY "Admins view all redemptions" ON public.trial_campaign_redemptions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin', 'assistant_admin')
        )
    );


-- 4. RPC to Redeem a Trial Campaign
CREATE OR REPLACE FUNCTION redeem_trial_campaign(p_business_id UUID, p_campaign_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_merchant_id UUID;
    v_campaign RECORD;
    v_existing_sub RECORD;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Verify caller owns the business
    SELECT claimed_by INTO v_merchant_id FROM public.businesses WHERE id = p_business_id;
    
    IF v_merchant_id IS NULL OR v_merchant_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not own this business');
    END IF;

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
    
    -- Register the redemption
    INSERT INTO public.trial_campaign_redemptions (campaign_id, business_id) VALUES (p_campaign_id, p_business_id);
    
    -- Increment campaign usage
    UPDATE public.trial_campaigns SET current_redemptions = current_redemptions + 1 WHERE id = p_campaign_id;

    -- Upsert the trial subscription
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


-- 5. Fix `admin_grant_free_trial` to allow super_admin
CREATE OR REPLACE FUNCTION admin_grant_free_trial(p_business_id UUID, p_tier TEXT, p_months INTEGER)
RETURNS JSONB AS $$
DECLARE
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Ensure caller is an admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'admin', 'assistant_admin')
    ) THEN
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


-- 6. Create `admin_cancel_trial` RPC to quickly terminate ongoing trials
CREATE OR REPLACE FUNCTION admin_cancel_trial(p_business_id UUID)
RETURNS JSONB AS $$
BEGIN
    -- Ensure caller is an admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('super_admin', 'admin', 'assistant_admin')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Delete the trial row (reverting them effectively to 'Free' tier UI representation)
    -- We only allow deleting IF it's a trial, to prevent accidentally wiping paid subs
    DELETE FROM public.subscriptions 
    WHERE business_id = p_business_id AND is_trial = true;

    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'message', 'Trial canceled successfully');
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'No active trial found to cancel');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- FINAL FIXES for API PostgREST visibility
-- ==========================================

-- 1. Grant usage strictly to authenticated and service_role schemas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_campaign_redemptions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_campaign_redemptions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_campaign_redemptions TO anon;

-- 2. Force Supabase API to reload the schema cache immediately!
NOTIFY pgrst, 'reload schema';
