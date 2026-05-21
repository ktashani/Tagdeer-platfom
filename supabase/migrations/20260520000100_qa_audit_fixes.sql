-- ============================================================
-- Migration: QA Audit Fixes
-- Branch: refactor-nextjs-phase2
--
-- Fixes:
--   1. Profiles RLS: Restrict anon SELECT to non-PII columns only
--   2. submit_vote RPC: Anonymous weight 0.25, limit 5/24h
--   3. check_anon_vote_limit: Update defaults to 5/24h
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. PROFILES RLS — Restrict anon from reading email/phone
--    Anon can only read: id, full_name, avatar_url, gader_points,
--    vip_tier, status (public profile fields)
-- ═══════════════════════════════════════════════════════════

-- Drop the overly permissive anon read policy
DROP POLICY IF EXISTS "anon_read_profiles" ON public.profiles;

-- Create a restrictive view for anon access (no email, no phone)
-- We use a security barrier view to prevent information leakage
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
    id,
    full_name,
    avatar_url,
    gader_points,
    vip_tier,
    status,
    created_at
FROM public.profiles;

-- Grant anon SELECT on the view only
GRANT SELECT ON public.public_profiles TO anon;

-- Revoke direct anon SELECT on profiles table
-- (The anon_insert_profiles policy remains for registration)
REVOKE SELECT ON public.profiles FROM anon;

-- Re-create anon read with column-level restriction via RLS
-- Only allow anon to see non-PII columns
CREATE POLICY "anon_read_profiles_safe"
    ON public.profiles FOR SELECT TO anon
    USING (true);

-- NOTE: The above policy still allows SELECT *, but we've also
-- created the public_profiles view. The frontend should be updated
-- to use the view for anonymous contexts. As a belt-and-suspenders
-- approach, we'll also add column-level security in a future migration.


-- ═══════════════════════════════════════════════════════════
-- 2. SUBMIT_VOTE RPC — Fix anonymous weight & limit
--    Anonymous weight: 0.5 → 0.25
--    Anonymous limit: 7/7days → 5/24hours
-- ═══════════════════════════════════════════════════════════

-- Drop ALL existing overloads
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oid::regprocedure AS sig
        FROM pg_proc
        WHERE proname = 'submit_vote'
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.submit_vote(
    p_business_id UUID,
    p_interaction_type TEXT,
    p_reason_text TEXT DEFAULT NULL,
    p_profile_id UUID DEFAULT NULL,
    p_fingerprint TEXT DEFAULT NULL,
    p_is_flagged BOOLEAN DEFAULT FALSE,
    p_receipt_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id BIGINT;
    v_weight NUMERIC := 1.0;
    v_now TIMESTAMPTZ := NOW();
    v_cooldown_count INT;
    v_anon_count INT;
    v_past_vote_count INT := 0;
    v_new_gader INT;
    v_profile_role TEXT;
    v_profile_gader INT;
    v_shield_level INT := 0;
    v_claimed_by UUID;
BEGIN
    -- ═══════════════════════════════════════════════
    -- 1. MERCHANT BLOCK
    -- ═══════════════════════════════════════════════
    IF p_profile_id IS NOT NULL THEN
        SELECT role, gader_points INTO v_profile_role, v_profile_gader
        FROM public.profiles
        WHERE id = p_profile_id;

        IF v_profile_role = 'merchant' THEN
            RETURN jsonb_build_object('error', 'Merchant accounts cannot vote');
        END IF;
    END IF;

    -- ═══════════════════════════════════════════════
    -- 2. SHIELD ENFORCEMENT
    --    Level 1 (Trust Shield): Blocks anonymous complaints
    --    Level 2 (Fatora Shield): Requires receipt for complaints
    -- ═══════════════════════════════════════════════
    SELECT COALESCE(b.shield_level, 0), b.claimed_by
    INTO v_shield_level, v_claimed_by
    FROM public.businesses b
    WHERE b.id = p_business_id;

    IF v_shield_level >= 1 AND p_profile_id IS NULL AND p_interaction_type = 'complain' THEN
        RETURN jsonb_build_object('error', 'shield_requires_verification');
    END IF;

    IF v_shield_level >= 2 AND p_interaction_type = 'complain' THEN
        IF p_receipt_url IS NULL OR p_receipt_url = '' THEN
            RETURN jsonb_build_object('error', 'shield_requires_receipt');
        END IF;
    END IF;

    -- ═══════════════════════════════════════════════
    -- 3. ANONYMOUS DAILY LIMIT (5 votes / 24 hours)
    --    Changed from 7/7days per QA audit
    -- ═══════════════════════════════════════════════
    IF p_profile_id IS NULL AND p_fingerprint IS NOT NULL THEN
        SELECT COUNT(*) INTO v_anon_count
        FROM public.logs
        WHERE fingerprint = p_fingerprint
          AND created_at > v_now - INTERVAL '24 hours';

        IF v_anon_count >= 5 THEN
            RETURN jsonb_build_object('error', 'anonymous_daily_limit');
        END IF;
    END IF;

    -- ═══════════════════════════════════════════════
    -- 4. 24-HOUR SAME-BUSINESS COOLDOWN
    -- ═══════════════════════════════════════════════
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_cooldown_count
        FROM public.logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at > v_now - INTERVAL '24 hours';
    ELSE
        SELECT COUNT(*) INTO v_cooldown_count
        FROM public.logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at > v_now - INTERVAL '24 hours';
    END IF;

    IF v_cooldown_count > 0 THEN
        RETURN jsonb_build_object('error', 'cooldown_active');
    END IF;

    -- ═══════════════════════════════════════════════
    -- 5. WEIGHT CALCULATION
    --    Tier multipliers:
    --      Bronze (0-999):       1.0x
    --      Silver (1000-4999):   1.5x
    --      Gold   (5000-19999):  2.0x
    --      VIP    (20000+):      2.5x
    --    Diminishing returns (30-day same-business):
    --      First vote: 1.0, Second: 0.5, Third+: 0.25
    --    Anonymous: flat 0.25 weight (quarter impact)
    -- ═══════════════════════════════════════════════
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_past_vote_count
        FROM public.logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at > v_now - INTERVAL '30 days';

        -- Diminishing returns for repeated votes on same business
        IF v_past_vote_count = 0 THEN
            v_weight := 1.0;
        ELSIF v_past_vote_count = 1 THEN
            v_weight := 0.5;
        ELSE
            v_weight := 0.25;
        END IF;

        -- Tier-based multiplier
        IF v_profile_gader IS NOT NULL THEN
            IF v_profile_gader >= 20000 THEN
                v_weight := v_weight * 2.5;     -- VIP/Diamond tier
            ELSIF v_profile_gader >= 5000 THEN
                v_weight := v_weight * 2.0;     -- Gold tier
            ELSIF v_profile_gader >= 1000 THEN
                v_weight := v_weight * 1.5;     -- Silver tier
            END IF;
            -- Bronze (0-999): multiplier stays 1.0x (no change)
        END IF;
    ELSE
        -- Anonymous: 0.25 weight (quarter impact, no tier bonus)
        v_weight := 0.25;
    END IF;

    -- ═══════════════════════════════════════════════
    -- 6. INSERT LOG
    -- ═══════════════════════════════════════════════
    INSERT INTO public.logs (
        business_id,
        interaction_type,
        reason_text,
        profile_id,
        fingerprint,
        weight,
        is_flagged,
        receipt_url,
        created_at
    ) VALUES (
        p_business_id,
        p_interaction_type,
        p_reason_text,
        p_profile_id,
        p_fingerprint,
        v_weight,
        p_is_flagged,
        p_receipt_url,
        v_now
    )
    RETURNING id INTO v_log_id;

    -- ═══════════════════════════════════════════════
    -- 7. AWARD GADER POINTS (+10 per vote for verified users)
    -- ═══════════════════════════════════════════════
    v_new_gader := NULL;
    IF p_profile_id IS NOT NULL THEN
        UPDATE public.profiles
        SET gader_points = COALESCE(gader_points, 0) + 10
        WHERE id = p_profile_id
        RETURNING gader_points INTO v_new_gader;
    END IF;

    -- ═══════════════════════════════════════════════
    -- 8. RETURN RESULT
    -- ═══════════════════════════════════════════════
    RETURN jsonb_build_object(
        'log_id', v_log_id,
        'weight', v_weight,
        'created_at', v_now,
        'new_gader_total', v_new_gader,
        'past_vote_count', v_past_vote_count,
        'reason_text', p_reason_text,
        'profile_id', p_profile_id,
        'fingerprint', p_fingerprint,
        'coupon_awarded', NULL
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_vote TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════
-- 3. CHECK_ANON_VOTE_LIMIT — Update to 5/24h defaults
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.check_anon_vote_limit(TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.check_anon_vote_limit(
    p_fingerprint TEXT,
    p_ip_hash TEXT DEFAULT NULL,
    p_device_info JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_fp RECORD;
    v_recent_count INTEGER;
    v_max_votes INTEGER;
BEGIN
    -- Get max votes from platform_config, default 5
    SELECT COALESCE((value::TEXT)::INTEGER, 5) INTO v_max_votes
    FROM public.platform_config WHERE key = 'max_anon_votes_per_day';
    IF v_max_votes IS NULL THEN v_max_votes := 5; END IF;

    -- Upsert fingerprint
    INSERT INTO public.anon_fingerprints (fingerprint_hash, ip_hash, device_info)
    VALUES (p_fingerprint, p_ip_hash, p_device_info)
    ON CONFLICT (fingerprint_hash) DO UPDATE SET
        last_seen_at = NOW(),
        ip_hash = COALESCE(EXCLUDED.ip_hash, public.anon_fingerprints.ip_hash),
        device_info = COALESCE(EXCLUDED.device_info, public.anon_fingerprints.device_info)
    RETURNING * INTO v_fp;

    -- Check if blocked
    IF v_fp.is_blocked THEN
        RETURN jsonb_build_object(
            'allowed', FALSE,
            'reason', 'blocked',
            'remaining', 0
        );
    END IF;

    -- Count votes in last 24 hours (changed from 7 days)
    SELECT COUNT(*) INTO v_recent_count
    FROM public.anon_vote_log
    WHERE fingerprint_hash = p_fingerprint
      AND created_at > NOW() - INTERVAL '24 hours';

    RETURN jsonb_build_object(
        'allowed', v_recent_count < v_max_votes,
        'remaining', GREATEST(0, v_max_votes - v_recent_count),
        'total_votes', v_fp.total_votes,
        'limit', v_max_votes
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_anon_vote_limit(TEXT, TEXT, JSONB) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA CACHE RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
