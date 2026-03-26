-- ============================================================
-- Migration: W1-4 — Server-Side Location Quota Enforcement
-- Branch: feature/v2-subdomain-portals
--
-- Purpose:
--   Prevents merchants from claiming more businesses than their
--   subscription tier allows. This is a server-side enforcement
--   that cannot be bypassed by disabling JavaScript.
--
-- Logic:
--   When claimed_by is SET (INSERT with claimed_by, or UPDATE
--   setting claimed_by to non-NULL), count how many businesses
--   that user already claims and compare against:
--     subscriptions.quotas->>'max_locations' (JSONB integer)
--
--   -1 = unlimited (Enterprise), 0 = none allowed, N = max N
--   If no subscription exists, defaults to 1 (Free tier fallback)
--
-- ⚠️  Admin users bypass this check via is_platform_admin().
-- ============================================================


CREATE OR REPLACE FUNCTION public.enforce_location_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_count INTEGER;
    v_max_locations INTEGER;
    v_quotas JSONB;
BEGIN
    -- Only trigger when claimed_by is being set to a non-NULL value
    IF NEW.claimed_by IS NULL THEN
        RETURN NEW;
    END IF;

    -- Skip if claimed_by isn't actually changing (UPDATE with same value)
    IF TG_OP = 'UPDATE' AND OLD.claimed_by IS NOT DISTINCT FROM NEW.claimed_by THEN
        RETURN NEW;
    END IF;

    -- Admin bypass: platform admins can assign businesses freely
    -- (e.g., during bulk imports or manual overrides)
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = NEW.claimed_by
        AND role IN ('super_admin', 'admin', 'assistant_admin')
    ) THEN
        RETURN NEW;
    END IF;

    -- Count how many businesses this user already claims
    -- (exclude the current row if this is an UPDATE)
    SELECT COUNT(*) INTO v_current_count
    FROM public.businesses
    WHERE claimed_by = NEW.claimed_by
      AND id IS DISTINCT FROM NEW.id;

    -- Look up their subscription quota
    SELECT quotas INTO v_quotas
    FROM public.subscriptions
    WHERE profile_id = NEW.claimed_by
      AND status IN ('Active', 'Expiring Soon', 'Grace Period')
    ORDER BY
        CASE status
            WHEN 'Active' THEN 1
            WHEN 'Expiring Soon' THEN 2
            WHEN 'Grace Period' THEN 3
        END
    LIMIT 1;

    -- Extract max_locations from JSONB, default to 1 (Free tier)
    v_max_locations := COALESCE((v_quotas->>'max_locations')::INTEGER, 1);

    -- -1 means unlimited (Enterprise tier)
    IF v_max_locations = -1 THEN
        RETURN NEW;
    END IF;

    -- Enforce the limit
    IF v_current_count >= v_max_locations THEN
        RAISE EXCEPTION 'Location quota exceeded: you have % of % allowed locations. Upgrade your plan to add more.',
            v_current_count, v_max_locations
        USING ERRCODE = 'P0001',
              HINT = 'Upgrade your subscription tier to increase the location quota.';
    END IF;

    RETURN NEW;
END;
$$;


-- Install the trigger on businesses table
DROP TRIGGER IF EXISTS trg_enforce_location_quota ON public.businesses;
CREATE TRIGGER trg_enforce_location_quota
    BEFORE INSERT OR UPDATE OF claimed_by ON public.businesses
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_location_quota();

COMMENT ON FUNCTION public.enforce_location_quota() IS
    'Enforces max_locations quota from subscriptions.quotas JSONB. '
    'Free tier defaults to 1 location. Enterprise (-1) is unlimited. '
    'Admin users bypass this check.';


-- Schema reload
NOTIFY pgrst, 'reload schema';
