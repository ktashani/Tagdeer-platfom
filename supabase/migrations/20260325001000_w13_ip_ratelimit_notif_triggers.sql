-- ============================================================
-- Migration: W13 — IP Rate Limiting + Notification Triggers
-- Branch: feature/v2-subdomain-portals
--
-- Enhancements:
--   1. IP-based rate limiting for anonymous votes (secondary defense)
--   2. Notification triggers: vote milestone, coupon redeemed
--   3. Relax notifications type CHECK to support new types
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. RELAX NOTIFICATIONS TYPE CHECK CONSTRAINT
--    Add new notification types for vote milestones and coupons.
--    Must DROP + re-ADD the constraint (ALTER CHECK not supported).
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    -- Drop the existing CHECK constraint on notifications.type
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

    -- Re-add with expanded type list
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
        'subscription_expiring',
        'subscription_expired',
        'claim_approved',
        'claim_rejected',
        'tier_upgrade_approved',
        'tier_upgrade_rejected',
        'system_announcement',
        'payment_received',
        'payment_overdue',
        'vote_milestone',
        'coupon_redeemed',
        'coupon_granted',
        'campaign_expired'
    ));

    RAISE NOTICE 'Notification type constraint updated with new types';
EXCEPTION
    WHEN undefined_object THEN
        -- Constraint doesn't exist yet, add it fresh
        ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
            'subscription_expiring', 'subscription_expired',
            'claim_approved', 'claim_rejected',
            'tier_upgrade_approved', 'tier_upgrade_rejected',
            'system_announcement', 'payment_received', 'payment_overdue',
            'vote_milestone', 'coupon_redeemed', 'coupon_granted', 'campaign_expired'
        ));
END $$;


-- ═══════════════════════════════════════════════════════════
-- 2. ADD ip_address COLUMN TO anon_vote_log
--    Store raw IP per vote for secondary rate limiting.
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'anon_vote_log' AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE public.anon_vote_log ADD COLUMN ip_address TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_anon_vote_ip ON public.anon_vote_log (ip_address, created_at);


-- ═══════════════════════════════════════════════════════════
-- 3. UPGRADE record_anon_vote — ADD IP PARAMETER + PER-IP LIMIT
--    New signature: (TEXT, UUID, TEXT, TEXT)
--    4th param = client IP address for secondary rate limiting.
--    Per-IP limit: max 15 votes per 24h across ALL fingerprints.
-- ═══════════════════════════════════════════════════════════

-- Drop the old 3-param version
DROP FUNCTION IF EXISTS public.record_anon_vote(TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.record_anon_vote(
    p_fingerprint TEXT,
    p_business_id UUID,
    p_type TEXT,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_check JSONB;
    v_ip_count INTEGER;
    v_max_ip_votes INTEGER := 15;
BEGIN
    -- Validate vote type
    IF p_type NOT IN ('recommend', 'complain') THEN
        RAISE EXCEPTION 'Invalid interaction type' USING ERRCODE = 'P0001';
    END IF;

    -- Check per-fingerprint limit (existing logic)
    v_check := public.check_anon_vote_limit(p_fingerprint, NULL, '{}');
    IF NOT (v_check->>'allowed')::BOOLEAN THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'vote_limit_exceeded',
            'remaining', 0
        );
    END IF;

    -- Secondary defense: per-IP rate limit (15 votes/24h across all fingerprints)
    IF p_ip_address IS NOT NULL AND p_ip_address != '' THEN
        SELECT COUNT(*) INTO v_ip_count
        FROM public.anon_vote_log
        WHERE ip_address = p_ip_address
          AND created_at > NOW() - INTERVAL '24 hours';

        IF v_ip_count >= v_max_ip_votes THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'ip_rate_limit_exceeded',
                'remaining', 0
            );
        END IF;
    END IF;

    -- Record the vote (now with IP)
    INSERT INTO public.anon_vote_log (fingerprint_hash, business_id, interaction_type, ip_address)
    VALUES (p_fingerprint, p_business_id, p_type, p_ip_address);

    -- Increment total votes on fingerprint
    UPDATE public.anon_fingerprints
    SET total_votes = total_votes + 1
    WHERE fingerprint_hash = p_fingerprint;

    RETURN jsonb_build_object(
        'success', TRUE,
        'remaining', (v_check->>'remaining')::INTEGER - 1
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_anon_vote(TEXT, UUID, TEXT, TEXT) TO anon, authenticated;


-- ═══════════════════════════════════════════════════════════
-- 4. VOTE MILESTONE NOTIFICATION TRIGGER
--    Fires when a business reaches 10, 50, 100 votes.
--    Notifies the business owner (claimed_by) via notifications table.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_vote_milestone_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_biz RECORD;
    v_vote_count INTEGER;
    v_milestone INTEGER;
BEGIN
    -- Only fire for businesses with an owner
    SELECT b.id, b.name, b.claimed_by INTO v_biz
    FROM public.businesses b
    WHERE b.id = NEW.business_id AND b.claimed_by IS NOT NULL;

    IF NOT FOUND THEN RETURN NEW; END IF;

    -- Count total votes
    SELECT COUNT(*) INTO v_vote_count
    FROM public.logs
    WHERE business_id = NEW.business_id;

    -- Check milestone thresholds
    v_milestone := CASE
        WHEN v_vote_count = 10 THEN 10
        WHEN v_vote_count = 50 THEN 50
        WHEN v_vote_count = 100 THEN 100
        WHEN v_vote_count = 500 THEN 500
        WHEN v_vote_count = 1000 THEN 1000
        ELSE NULL
    END;

    IF v_milestone IS NOT NULL THEN
        -- Check not already notified for this milestone
        IF NOT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE profile_id = v_biz.claimed_by
              AND type = 'vote_milestone'
              AND (metadata->>'milestone')::INTEGER = v_milestone
              AND (metadata->>'business_id')::TEXT = v_biz.id::TEXT
        ) THEN
            INSERT INTO public.notifications (profile_id, type, title, message, metadata)
            VALUES (
                v_biz.claimed_by,
                'vote_milestone',
                format('🎉 وصل %s إلى %s تقدير!', v_biz.name, v_milestone),
                format('نشاطك التجاري %s حصل على %s تقييم. أنت تبني سمعة رقمية قوية!', v_biz.name, v_milestone),
                jsonb_build_object('business_id', v_biz.id, 'milestone', v_milestone, 'business_name', v_biz.name)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_logs_vote_milestone ON public.logs;
CREATE TRIGGER trg_logs_vote_milestone
    AFTER INSERT ON public.logs
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_vote_milestone_notify();


-- ═══════════════════════════════════════════════════════════
-- 5. COUPON REDEEMED NOTIFICATION TRIGGER
--    When a coupon status changes to 'REDEEMED', notify the
--    merchant (business owner) that a customer used their coupon.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_coupon_redeemed_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_biz RECORD;
BEGIN
    -- Only fire when status transitions to REDEEMED
    IF NEW.status = 'REDEEMED' AND (OLD.status IS NULL OR OLD.status != 'REDEEMED') THEN
        -- Get business owner
        SELECT b.id, b.name, b.claimed_by INTO v_biz
        FROM public.businesses b
        WHERE b.id = NEW.business_id AND b.claimed_by IS NOT NULL;

        IF FOUND THEN
            INSERT INTO public.notifications (profile_id, type, title, message, metadata)
            VALUES (
                v_biz.claimed_by,
                'coupon_redeemed',
                '🎫 تم استخدام كوبون!',
                format('تم استخدام كوبون بقيمة %s في %s', NEW.discount_value || ' ' || COALESCE(NEW.discount_type, ''), v_biz.name),
                jsonb_build_object('business_id', v_biz.id, 'coupon_id', NEW.id, 'discount_value', NEW.discount_value)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coupon_redeemed ON public.user_coupons;
CREATE TRIGGER trg_coupon_redeemed
    AFTER UPDATE ON public.user_coupons
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_coupon_redeemed_notify();


-- ═══════════════════════════════════════════════════════════
-- 6. COUPON GRANTED NOTIFICATION TRIGGER
--    When a merchant grants a coupon (INSERT with source='grant_recognition'),
--    notify the consumer.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_coupon_granted_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_biz_name TEXT;
BEGIN
    IF NEW.source = 'grant_recognition' AND NEW.user_id IS NOT NULL THEN
        SELECT name INTO v_biz_name FROM public.businesses WHERE id = NEW.business_id;

        INSERT INTO public.notifications (profile_id, type, title, message, metadata)
        VALUES (
            NEW.user_id,
            'coupon_granted',
            '🎁 حصلت على مكافأة!',
            format('منحك %s كوبون خصم %s. تحقق من محفظة الكوبونات.',
                COALESCE(v_biz_name, 'تاجر'),
                NEW.discount_value || ' ' || COALESCE(NEW.discount_type, '')
            ),
            jsonb_build_object('business_id', NEW.business_id, 'coupon_id', NEW.id, 'discount_value', NEW.discount_value)
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coupon_granted ON public.user_coupons;
CREATE TRIGGER trg_coupon_granted
    AFTER INSERT ON public.user_coupons
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_coupon_granted_notify();


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
