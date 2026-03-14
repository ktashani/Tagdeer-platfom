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
