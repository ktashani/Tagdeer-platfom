-- ============================================================
-- Migration: submit_vote RPC
-- Branch: feature/v2-subdomain-portals
--
-- Creates the submit_vote server-side RPC that the
-- useVoteSubmission hook calls. This RPC handles:
--   1. Merchant account blocking
--   2. Anonymous weekly limit (7 votes / 7 days / fingerprint)
--   3. 24-hour same-business cooldown
--   4. 30-day diminishing returns weight calculation
--   5. Shield enforcement (Level 1 = anonymous blocked, Level 2 = receipt required)
--   6. Log insertion with content flagging
--   7. Gader point awarding (+10 per vote for verified users)
--   8. Coupon award check (placeholder)
--
-- Returns JSON: { log_id, weight, created_at, new_gader_total,
--                 past_vote_count, reason_text, profile_id,
--                 fingerprint, coupon_awarded, error }
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_vote(
    p_business_id UUID,
    p_interaction_type TEXT,
    p_reason_text TEXT DEFAULT NULL,
    p_profile_id UUID DEFAULT NULL,
    p_fingerprint TEXT DEFAULT NULL,
    p_is_flagged BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
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
    --    Level 2 (Fatora Shield): Requires receipt (handled client-side)
    -- ═══════════════════════════════════════════════
    SELECT COALESCE(b.shield_level, 0), b.claimed_by
    INTO v_shield_level, v_claimed_by
    FROM public.businesses b
    WHERE b.id = p_business_id;

    -- Shield Level 1+: Block anonymous complaints
    IF v_shield_level >= 1 AND p_profile_id IS NULL AND p_interaction_type = 'complain' THEN
        RETURN jsonb_build_object('error', 'shield_requires_verification');
    END IF;

    -- ═══════════════════════════════════════════════
    -- 3. ANONYMOUS WEEKLY LIMIT (7 votes / 7 days)
    -- ═══════════════════════════════════════════════
    IF p_profile_id IS NULL AND p_fingerprint IS NOT NULL THEN
        SELECT COUNT(*) INTO v_anon_count
        FROM public.logs
        WHERE fingerprint = p_fingerprint
          AND created_at > v_now - INTERVAL '7 days';

        IF v_anon_count >= 7 THEN
            RETURN jsonb_build_object('error', 'anonymous_weekly_limit');
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
    -- 5. WEIGHT CALCULATION (30-day diminishing returns)
    --    First vote on a business: weight = 1.0
    --    Second vote (within 30 days): weight = 0.5
    --    Third+: weight = 0.25
    --    Verified users: base weight * (1 + gader_points/1000)
    -- ═══════════════════════════════════════════════
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_past_vote_count
        FROM public.logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at > v_now - INTERVAL '30 days';

        -- Diminishing returns
        IF v_past_vote_count = 0 THEN
            v_weight := 1.0;
        ELSIF v_past_vote_count = 1 THEN
            v_weight := 0.5;
        ELSE
            v_weight := 0.25;
        END IF;

        -- Verified user bonus: weight * (1 + gader/1000)
        IF v_profile_gader IS NOT NULL AND v_profile_gader > 0 THEN
            v_weight := v_weight * (1.0 + (v_profile_gader::NUMERIC / 1000.0));
        END IF;
    ELSE
        -- Anonymous: always weight 1.0 (no diminishing, no bonus)
        v_weight := 1.0;
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
        created_at
    ) VALUES (
        p_business_id,
        p_interaction_type,
        p_reason_text,
        p_profile_id,
        p_fingerprint,
        v_weight,
        p_is_flagged,
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

-- Grant execute to both anon and authenticated
GRANT EXECUTE ON FUNCTION public.submit_vote TO anon, authenticated;

-- Add shield_level column to businesses if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'businesses'
          AND column_name = 'shield_level'
    ) THEN
        ALTER TABLE public.businesses ADD COLUMN shield_level INT DEFAULT 0;
        RAISE NOTICE 'Added shield_level column to businesses';
    END IF;
END $$;

-- Add weight column to logs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'logs'
          AND column_name = 'weight'
    ) THEN
        ALTER TABLE public.logs ADD COLUMN weight NUMERIC DEFAULT 1.0;
        RAISE NOTICE 'Added weight column to logs';
    END IF;
END $$;

-- Add fingerprint column to logs if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'logs'
          AND column_name = 'fingerprint'
    ) THEN
        ALTER TABLE public.logs ADD COLUMN fingerprint TEXT;
        RAISE NOTICE 'Added fingerprint column to logs';
    END IF;
END $$;

-- Add gader_points column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'gader_points'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN gader_points INT DEFAULT 0;
        RAISE NOTICE 'Added gader_points column to profiles';
    END IF;
END $$;

-- Add role column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'role'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';
        RAISE NOTICE 'Added role column to profiles';
    END IF;
END $$;
