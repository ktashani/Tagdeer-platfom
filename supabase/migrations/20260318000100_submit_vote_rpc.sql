-- ============================================================
-- Phase 1a: Server-Side Vote Weight Calculation
-- Moves the entire vote submission pipeline into a single
-- atomic SECURITY DEFINER function to prevent client-side
-- weight manipulation.
--
-- Also:
--  - Adds is_flagged column to logs (Phase 1b prep)
--  - Hardens RLS on profiles (Phase 1c)
--  - Enforces cooldown + anonymous limits server-side
-- ============================================================

-- ─── 1. Add is_flagged column for content moderation ──────
ALTER TABLE logs ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;

-- ─── 2. The submit_vote RPC ───────────────────────────────
CREATE OR REPLACE FUNCTION submit_vote(
    p_business_id UUID,
    p_interaction_type TEXT,
    p_reason_text TEXT DEFAULT NULL,
    p_profile_id UUID DEFAULT NULL,
    p_fingerprint TEXT DEFAULT NULL,
    p_is_flagged BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier_multiplier NUMERIC;
    v_diminishing NUMERIC;
    v_weight NUMERIC;
    v_past_count INT;
    v_gader_points INT;
    v_vip_tier TEXT;
    v_points_from_tier NUMERIC;
    v_inserted_id UUID;
    v_inserted_at TIMESTAMPTZ;
    v_earned_points INT;
    v_new_points INT;
    v_cooldown_count INT;
    v_anon_count INT;
    v_role TEXT;
BEGIN
    -- ── Validate inputs ──────────────────────────────────
    IF p_interaction_type NOT IN ('recommend', 'complain') THEN
        RETURN jsonb_build_object('error', 'Invalid interaction_type');
    END IF;

    IF p_business_id IS NULL THEN
        RETURN jsonb_build_object('error', 'business_id is required');
    END IF;

    -- ── Block merchant accounts ──────────────────────────
    IF p_profile_id IS NOT NULL THEN
        SELECT role INTO v_role FROM profiles WHERE id = p_profile_id;
        IF v_role = 'merchant' THEN
            RETURN jsonb_build_object('error', 'Merchant accounts cannot vote');
        END IF;
    END IF;

    -- ── Anonymous global limit: 7 per week (configurable) ─
    IF p_profile_id IS NULL AND p_fingerprint IS NOT NULL THEN
        SELECT COUNT(*) INTO v_anon_count
        FROM logs
        WHERE fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '7 days';

        IF v_anon_count >= 7 THEN
            RETURN jsonb_build_object('error', 'anonymous_weekly_limit', 'limit', 7);
        END IF;
    END IF;

    -- ── 24-Hour same-business cooldown ────────────────────
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_cooldown_count
        FROM logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at >= NOW() - INTERVAL '24 hours';
    ELSE
        SELECT COUNT(*) INTO v_cooldown_count
        FROM logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '24 hours';
    END IF;

    IF v_cooldown_count > 0 THEN
        RETURN jsonb_build_object('error', 'cooldown_active');
    END IF;

    -- ── Tier multiplier ──────────────────────────────────
    IF p_profile_id IS NULL THEN
        v_tier_multiplier := 0.2;  -- Anonymous
    ELSE
        SELECT gader_points, vip_tier
        INTO v_gader_points, v_vip_tier
        FROM profiles WHERE id = p_profile_id;

        -- From VIP tier string
        v_tier_multiplier := 1.0;  -- Bronze default
        IF LOWER(COALESCE(v_vip_tier, '')) LIKE '%vip%'
           OR LOWER(COALESCE(v_vip_tier, '')) LIKE '%diamond%' THEN
            v_tier_multiplier := 2.5;
        ELSIF LOWER(COALESCE(v_vip_tier, '')) LIKE '%gold%' THEN
            v_tier_multiplier := 2.0;
        ELSIF LOWER(COALESCE(v_vip_tier, '')) LIKE '%silver%' THEN
            v_tier_multiplier := 1.5;
        END IF;

        -- From Gader points (take the higher)
        v_points_from_tier := 1.0;
        IF COALESCE(v_gader_points, 0) >= 20000 THEN
            v_points_from_tier := 2.5;
        ELSIF COALESCE(v_gader_points, 0) >= 5000 THEN
            v_points_from_tier := 2.0;
        ELSIF COALESCE(v_gader_points, 0) >= 1000 THEN
            v_points_from_tier := 1.5;
        END IF;

        v_tier_multiplier := GREATEST(v_tier_multiplier, v_points_from_tier);
    END IF;

    -- ── Diminishing returns (30-day same-business count) ──
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_past_count
        FROM logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at >= NOW() - INTERVAL '30 days';
    ELSE
        SELECT COUNT(*) INTO v_past_count
        FROM logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '30 days';
    END IF;

    IF v_past_count <= 0 THEN
        v_diminishing := 1.0;
    ELSIF v_past_count = 1 THEN
        v_diminishing := 0.5;
    ELSE
        v_diminishing := 0.25;
    END IF;

    -- ── Calculate final weight ───────────────────────────
    v_weight := ROUND(v_tier_multiplier * v_diminishing * 100) / 100;

    -- ── Insert log ───────────────────────────────────────
    INSERT INTO logs (
        business_id, interaction_type, reason_text,
        profile_id, fingerprint, weight, is_flagged
    )
    VALUES (
        p_business_id, p_interaction_type,
        CASE WHEN p_reason_text IS NOT NULL AND TRIM(p_reason_text) <> ''
             THEN TRIM(p_reason_text) ELSE NULL END,
        p_profile_id, p_fingerprint, v_weight, p_is_flagged
    )
    RETURNING id, created_at INTO v_inserted_id, v_inserted_at;

    -- ── Award Gader points (verified users only) ─────────
    v_earned_points := GREATEST(5, LEAST(25, ROUND(v_weight * 10)));
    v_new_points := NULL;

    IF p_profile_id IS NOT NULL THEN
        UPDATE profiles
        SET gader_points = GREATEST(COALESCE(gader_points, 0) + v_earned_points, 0)
        WHERE id = p_profile_id
        RETURNING gader_points INTO v_new_points;
    END IF;

    -- ── Return result ────────────────────────────────────
    RETURN jsonb_build_object(
        'success', true,
        'log_id', v_inserted_id,
        'created_at', v_inserted_at,
        'interaction_type', p_interaction_type,
        'reason_text', p_reason_text,
        'profile_id', p_profile_id,
        'fingerprint', p_fingerprint,
        'weight', v_weight,
        'is_flagged', p_is_flagged,
        'earned_points', v_earned_points,
        'new_gader_total', v_new_points,
        'past_vote_count', v_past_count
    );
END;
$$;

-- ─── 3. Grant execute to anon + authenticated ─────────────
GRANT EXECUTE ON FUNCTION submit_vote TO anon, authenticated;

-- ─── 4. (Phase 1c) Harden profiles RLS ───────────────────
-- Replace the permissive update policy with one that blocks
-- direct writes to gader_points and coupon_difficulty_level.
-- These fields can only be modified by SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "auth_update_own_profile" ON profiles;
CREATE POLICY "auth_update_own_profile" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        -- Block direct gader_points manipulation
        AND (gader_points IS NOT DISTINCT FROM (SELECT gader_points FROM profiles WHERE id = auth.uid()))
        -- Block direct coupon_difficulty_level manipulation
        AND (coupon_difficulty_level IS NOT DISTINCT FROM (SELECT coupon_difficulty_level FROM profiles WHERE id = auth.uid()))
    );

-- ─── 5. Revoke direct INSERT on logs for extra safety ─────
-- The submit_vote RPC (SECURITY DEFINER) can still insert.
-- Note: We keep anon SELECT for reading logs on public pages.
-- If this breaks existing anon log inserts, we rely on the RPC.
DO $$ BEGIN
    -- Only revoke if INSERT was granted (safe to run multiple times)
    REVOKE INSERT ON logs FROM anon;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not revoke INSERT from anon on logs: %', SQLERRM;
END $$;
