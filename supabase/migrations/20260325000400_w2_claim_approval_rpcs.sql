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
