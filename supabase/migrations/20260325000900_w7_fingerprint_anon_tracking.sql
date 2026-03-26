-- ============================================================
-- Migration: W7 — Anonymous Fingerprint Tracking & Vote Limits
-- Branch: feature/v2-subdomain-portals
--
-- Creates:
--   1. anon_fingerprints table for tracking device fingerprints
--   2. check_anon_vote_limit function — validates 3-vote/24h limit
--   3. user_coupons.source column for grant_recognition tracking
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. ANONYMOUS FINGERPRINT TABLE
--    Stores device fingerprint hashes for anonymous vote tracking.
--    Used to enforce per-device vote limits per AGENTS.md spec.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.anon_fingerprints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint_hash TEXT NOT NULL,
    ip_hash TEXT,
    device_info JSONB DEFAULT '{}',
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    total_votes INTEGER DEFAULT 0,
    is_blocked BOOLEAN DEFAULT FALSE,
    UNIQUE (fingerprint_hash)
);

CREATE INDEX IF NOT EXISTS idx_anon_fp_hash ON public.anon_fingerprints (fingerprint_hash);

ALTER TABLE public.anon_fingerprints ENABLE ROW LEVEL SECURITY;

-- Only admins can read fingerprint data
DROP POLICY IF EXISTS "fp_admin_all" ON public.anon_fingerprints;
CREATE POLICY "fp_admin_all" ON public.anon_fingerprints
    FOR ALL USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════
-- 2. ANONYMOUS VOTE LOG
--    Logs individual anonymous votes linked to fingerprints.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.anon_vote_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint_hash TEXT NOT NULL REFERENCES public.anon_fingerprints(fingerprint_hash),
    business_id UUID NOT NULL REFERENCES public.businesses(id),
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('recommend', 'complain')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anon_vote_fp ON public.anon_vote_log (fingerprint_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_anon_vote_biz ON public.anon_vote_log (business_id);

ALTER TABLE public.anon_vote_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "avl_admin_all" ON public.anon_vote_log;
CREATE POLICY "avl_admin_all" ON public.anon_vote_log
    FOR ALL USING (public.is_platform_admin());

-- Allow anonymous inserts (no auth required)
DROP POLICY IF EXISTS "avl_anon_insert" ON public.anon_vote_log;
CREATE POLICY "avl_anon_insert" ON public.anon_vote_log
    FOR INSERT WITH CHECK (TRUE);


-- ═══════════════════════════════════════════════════════════
-- 3. CHECK ANONYMOUS VOTE LIMIT RPC
--    Returns whether a fingerprint can vote (under 3/24h limit).
--    Auto-creates fingerprint record if not exists.
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
    -- Get max votes from platform_config, default 3
    SELECT COALESCE((value::TEXT)::INTEGER, 3) INTO v_max_votes
    FROM public.platform_config WHERE key = 'max_anon_votes_per_day';
    IF v_max_votes IS NULL THEN v_max_votes := 3; END IF;

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

    -- Count votes in last 24 hours
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
-- 4. RECORD ANONYMOUS VOTE RPC
--    Records a vote and increments fingerprint counter.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.record_anon_vote(TEXT, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.record_anon_vote(
    p_fingerprint TEXT,
    p_business_id UUID,
    p_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_check JSONB;
BEGIN
    -- Validate vote type
    IF p_type NOT IN ('recommend', 'complain') THEN
        RAISE EXCEPTION 'Invalid interaction type' USING ERRCODE = 'P0001';
    END IF;

    -- Check limit
    v_check := public.check_anon_vote_limit(p_fingerprint, NULL, '{}');
    IF NOT (v_check->>'allowed')::BOOLEAN THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'vote_limit_exceeded',
            'remaining', 0
        );
    END IF;

    -- Record the vote
    INSERT INTO public.anon_vote_log (fingerprint_hash, business_id, interaction_type)
    VALUES (p_fingerprint, p_business_id, p_type);

    -- Increment total votes
    UPDATE public.anon_fingerprints
    SET total_votes = total_votes + 1
    WHERE fingerprint_hash = p_fingerprint;

    RETURN jsonb_build_object(
        'success', TRUE,
        'remaining', (v_check->>'remaining')::INTEGER - 1
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_anon_vote(TEXT, UUID, TEXT) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════
-- 5. ADD source COLUMN TO user_coupons (for grant_recognition)
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_coupons' AND column_name = 'source'
    ) THEN
        ALTER TABLE public.user_coupons ADD COLUMN source TEXT DEFAULT 'campaign';
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
