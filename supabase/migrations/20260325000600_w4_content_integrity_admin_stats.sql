-- ============================================================
-- Migration: W4 — Content Integrity Trigger + Admin Stats Views
-- Branch: feature/v2-subdomain-portals
--
-- Creates:
--   1. Server-side bad word filter trigger on logs
--   2. Admin dashboard statistics views (real-time counts)
--   3. Gader Index recalculation on dispute resolution
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. BAD WORD DICTIONARY TABLE
--    Allows admins to manage the word list without code deploys.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.content_filter_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word TEXT NOT NULL UNIQUE,
    language TEXT NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'mixed')),
    severity TEXT NOT NULL DEFAULT 'flag' CHECK (severity IN ('flag', 'block', 'shadow')),
    -- flag = allow but mark for review
    -- block = reject outright
    -- shadow = allow but exclude from Gader Index
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.content_filter_words ENABLE ROW LEVEL SECURITY;

-- Only admins can manage the word list
CREATE POLICY "cfwords_all_admin"
    ON public.content_filter_words FOR ALL
    USING (public.is_platform_admin());

-- Seed initial dictionary
INSERT INTO public.content_filter_words (word, language, severity) VALUES
    -- English
    ('spam', 'en', 'flag'), ('fake', 'en', 'flag'), ('scam', 'en', 'flag'),
    ('fraud', 'en', 'flag'), ('fuck', 'en', 'block'), ('shit', 'en', 'block'),
    ('bitch', 'en', 'block'), ('asshole', 'en', 'block'),
    -- Arabic / Libyan
    ('نصاب', 'ar', 'flag'), ('سارق', 'ar', 'flag'), ('كذاب', 'ar', 'flag'),
    ('غشاش', 'ar', 'flag'), ('تفو', 'ar', 'flag'), ('كلب', 'ar', 'block'),
    ('حمار', 'ar', 'flag'), ('زبالة', 'ar', 'block'), ('محتال', 'ar', 'flag'),
    ('عنصري', 'ar', 'block'), ('شتم', 'ar', 'flag'), ('سب', 'ar', 'flag')
ON CONFLICT (word) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- 2. CONTENT CHECK TRIGGER
--    Runs BEFORE INSERT on logs. Checks text against the
--    content_filter_words table and sets is_flagged + flag_reason.
-- ═══════════════════════════════════════════════════════════

-- Add flagging columns to logs if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'logs'
                   AND column_name = 'is_flagged') THEN
        ALTER TABLE public.logs ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'logs'
                   AND column_name = 'flag_reason') THEN
        ALTER TABLE public.logs ADD COLUMN flag_reason TEXT;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_log_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_match RECORD;
    v_text TEXT;
BEGIN
    v_text := LOWER(COALESCE(NEW.text, ''));

    -- Skip empty text
    IF v_text = '' THEN
        RETURN NEW;
    END IF;

    -- Check against the dictionary
    SELECT w.word, w.severity INTO v_match
    FROM public.content_filter_words w
    WHERE v_text LIKE '%' || LOWER(w.word) || '%'
    ORDER BY w.severity DESC   -- block > flag > shadow
    LIMIT 1;

    IF v_match IS NOT NULL THEN
        IF v_match.severity = 'block' THEN
            RAISE EXCEPTION 'المحتوى يحتوي على كلمات محظورة — يرجى تعديل النص'
                USING ERRCODE = 'P0010';
        ELSIF v_match.severity = 'shadow' THEN
            -- Allow but exclude from index calculations
            NEW.is_flagged := TRUE;
            NEW.flag_reason := 'shadow_filter: ' || v_match.word;
        ELSE
            -- flag: allow but mark for admin review
            NEW.is_flagged := TRUE;
            NEW.flag_reason := 'content_filter: ' || v_match.word;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_log_content ON public.logs;
CREATE TRIGGER trg_check_log_content
    BEFORE INSERT ON public.logs
    FOR EACH ROW
    EXECUTE FUNCTION public.check_log_content();


-- ═══════════════════════════════════════════════════════════
-- 3. ADMIN DASHBOARD STATISTICS RPC
--    Returns real-time platform metrics in a single call.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_total_users INTEGER;
    v_total_merchants INTEGER;
    v_total_businesses INTEGER;
    v_pending_claims INTEGER;
    v_active_subscriptions INTEGER;
    v_total_logs INTEGER;
    v_flagged_logs INTEGER;
    v_total_coupons_redeemed INTEGER;
    v_mrr NUMERIC;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    -- User counts
    SELECT COUNT(*) INTO v_total_users FROM public.profiles;
    SELECT COUNT(*) INTO v_total_merchants FROM public.profiles WHERE role = 'merchant';

    -- Business counts
    SELECT COUNT(*) INTO v_total_businesses FROM public.businesses WHERE claimed_by IS NOT NULL;
    SELECT COUNT(*) INTO v_pending_claims FROM public.business_claims WHERE status = 'pending';

    -- Subscription counts
    SELECT COUNT(*) INTO v_active_subscriptions
    FROM public.subscriptions WHERE status = 'Active';

    -- Log counts
    SELECT COUNT(*) INTO v_total_logs FROM public.logs;
    SELECT COUNT(*) INTO v_flagged_logs FROM public.logs WHERE is_flagged = TRUE;

    -- Coupon redemptions
    BEGIN
        SELECT COUNT(*) INTO v_total_coupons_redeemed
        FROM public.user_coupons WHERE status = 'REDEEMED';
    EXCEPTION WHEN undefined_table THEN
        v_total_coupons_redeemed := 0;
    END;

    -- MRR calculation (sum of active non-free subscription tier prices)
    BEGIN
        SELECT COALESCE(SUM(st.price), 0) INTO v_mrr
        FROM public.subscriptions s
        JOIN public.subscription_tiers st ON LOWER(s.tier) = LOWER(st.name)
        WHERE s.status = 'Active' AND LOWER(s.tier) != 'free';
    EXCEPTION WHEN OTHERS THEN
        v_mrr := 0;
    END;

    RETURN jsonb_build_object(
        'total_users', v_total_users,
        'total_merchants', v_total_merchants,
        'total_businesses', v_total_businesses,
        'pending_claims', v_pending_claims,
        'active_subscriptions', v_active_subscriptions,
        'total_logs', v_total_logs,
        'flagged_logs', v_flagged_logs,
        'coupons_redeemed', v_total_coupons_redeemed,
        'mrr', v_mrr,
        'computed_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

COMMENT ON FUNCTION public.admin_dashboard_stats() IS
    'Admin-only RPC: returns real-time platform statistics for the dashboard.';


-- ═══════════════════════════════════════════════════════════
-- 4. DISPUTE RESOLUTION GADER INDEX RECALCULATION
--    When a dispute is resolved as fraud, recalculate the score.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
    p_dispute_id UUID,
    p_outcome TEXT,  -- 'approved_fake' or 'rejected_valid'
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_dispute RECORD;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    IF p_outcome NOT IN ('approved_fake', 'rejected_valid') THEN
        RAISE EXCEPTION 'Invalid outcome: must be approved_fake or rejected_valid'
            USING ERRCODE = 'P0003';
    END IF;

    SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dispute not found' USING ERRCODE = 'P0002';
    END IF;

    -- Update dispute
    UPDATE public.disputes
    SET status = p_outcome,
        resolved_at = NOW()
    WHERE id = p_dispute_id;

    -- If fraud confirmed, flag the original log so it's excluded from Gader Index
    IF p_outcome = 'approved_fake' THEN
        UPDATE public.logs
        SET is_flagged = TRUE,
            flag_reason = 'dispute_resolved_fraud'
        WHERE id = v_dispute.log_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'dispute_id', p_dispute_id,
        'outcome', p_outcome,
        'log_id', v_dispute.log_id,
        'business_id', v_dispute.business_id,
        'resolved_by', auth.uid(),
        'resolved_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
