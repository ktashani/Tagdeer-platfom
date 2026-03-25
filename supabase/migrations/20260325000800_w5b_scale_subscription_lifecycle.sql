-- ============================================================
-- Migration: W5b — Scale Hardening + Subscription Lifecycle
-- Branch: feature/v2-subdomain-portals
--
-- Creates:
--   1. admin_stats_cache materialized view
--   2. Updated admin_dashboard_stats to read from cache
--   3. Subscription lifecycle: expiring_soon status at T-7 days
--   4. Merchant dashboard expiry notification trigger
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. ADMIN STATS MATERIALIZED VIEW
--    Replaces live queries with cached aggregates.
--    Refreshed every 5 minutes via pg_cron (if available).
-- ═══════════════════════════════════════════════════════════

DROP MATERIALIZED VIEW IF EXISTS public.admin_stats_cache;

CREATE MATERIALIZED VIEW public.admin_stats_cache AS
SELECT
    (SELECT COUNT(*) FROM public.profiles) AS total_users,
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'merchant') AS total_merchants,
    (SELECT COUNT(*) FROM public.businesses WHERE claimed_by IS NOT NULL) AS total_businesses,
    (SELECT COUNT(*) FROM public.business_claims WHERE status = 'pending') AS pending_claims,
    (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'Active') AS active_subscriptions,
    (SELECT COUNT(*) FROM public.logs) AS total_logs,
    (SELECT COUNT(*) FROM public.logs WHERE is_flagged = TRUE) AS flagged_logs,
    (SELECT COALESCE(COUNT(*), 0) FROM public.user_coupons WHERE status = 'REDEEMED') AS coupons_redeemed,
    (SELECT COALESCE(SUM(st.price), 0)
     FROM public.subscriptions s
     JOIN public.subscription_tiers st ON LOWER(s.tier) = LOWER(st.name)
     WHERE s.status = 'Active' AND LOWER(s.tier) != 'free') AS mrr,
    NOW() AS computed_at;

-- Create unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_stats_cache_computed
    ON public.admin_stats_cache (computed_at);

-- Schedule auto-refresh every 5 minutes (pg_cron)
-- This will silently fail if pg_cron is not enabled — safe to run.
DO $$
BEGIN
    PERFORM cron.schedule(
        'refresh-admin-stats',
        '*/5 * * * *',
        'REFRESH MATERIALIZED VIEW CONCURRENTLY public.admin_stats_cache'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available — materialized view must be refreshed manually or via application';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 2. UPDATE admin_dashboard_stats TO READ FROM CACHE
--    Falls back to live queries if the view doesn't exist.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.admin_dashboard_stats();
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result RECORD;
    v_pending_payments INTEGER;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    -- Read from materialized view (fast path)
    BEGIN
        SELECT * INTO v_result FROM public.admin_stats_cache LIMIT 1;
    EXCEPTION WHEN undefined_table THEN
        -- Fallback: live queries if view doesn't exist
        SELECT
            (SELECT COUNT(*) FROM public.profiles) AS total_users,
            (SELECT COUNT(*) FROM public.profiles WHERE role = 'merchant') AS total_merchants,
            (SELECT COUNT(*) FROM public.businesses WHERE claimed_by IS NOT NULL) AS total_businesses,
            (SELECT COUNT(*) FROM public.business_claims WHERE status = 'pending') AS pending_claims,
            (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'Active') AS active_subscriptions,
            (SELECT COUNT(*) FROM public.logs) AS total_logs,
            (SELECT COUNT(*) FROM public.logs WHERE is_flagged = TRUE) AS flagged_logs,
            0 AS coupons_redeemed,
            0 AS mrr,
            NOW() AS computed_at
        INTO v_result;
    END;

    -- Pending payments — always live (actionable count)
    BEGIN
        SELECT COUNT(*) INTO v_pending_payments
        FROM public.transactions WHERE status = 'pending';
    EXCEPTION WHEN undefined_table THEN
        v_pending_payments := 0;
    END;

    RETURN jsonb_build_object(
        'total_users', v_result.total_users,
        'total_merchants', v_result.total_merchants,
        'total_businesses', v_result.total_businesses,
        'pending_claims', v_result.pending_claims,
        'active_subscriptions', v_result.active_subscriptions,
        'total_logs', v_result.total_logs,
        'flagged_logs', v_result.flagged_logs,
        'coupons_redeemed', v_result.coupons_redeemed,
        'mrr', v_result.mrr,
        'pending_payments', v_pending_payments,
        'computed_at', v_result.computed_at
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 3. SUBSCRIPTION LIFECYCLE — EXPIRING SOON
--    Marks subscriptions as 'Expiring Soon' at T-7 days.
--    Designed to run via pg_cron daily or called manually.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.subscription_lifecycle_check();
CREATE OR REPLACE FUNCTION public.subscription_lifecycle_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_expiring INTEGER;
    v_expired INTEGER;
BEGIN
    -- Mark Active → Expiring Soon (T-7 days)
    UPDATE public.subscriptions
    SET status = 'Expiring Soon'
    WHERE status = 'Active'
      AND expires_at IS NOT NULL
      AND expires_at <= NOW() + INTERVAL '7 days'
      AND expires_at > NOW();

    GET DIAGNOSTICS v_expiring = ROW_COUNT;

    -- Notify merchants whose subscriptions are expiring
    INSERT INTO public.notifications (user_id, type, title, body)
    SELECT profile_id, 'subscription_expiring',
           'اشتراكك ينتهي قريباً ⚠️',
           'اشتراك ' || tier || ' ينتهي في ' ||
           TO_CHAR(expires_at, 'DD/MM/YYYY') ||
           '. جدّد الآن لتفادي فقدان الميزات.'
    FROM public.subscriptions
    WHERE status = 'Expiring Soon'
      AND profile_id NOT IN (
          SELECT user_id FROM public.notifications
          WHERE type = 'subscription_expiring'
            AND created_at > NOW() - INTERVAL '7 days'
      );

    -- Mark Expiring Soon / Active → Expired
    UPDATE public.subscriptions
    SET status = 'Expired'
    WHERE status IN ('Active', 'Expiring Soon')
      AND expires_at IS NOT NULL
      AND expires_at <= NOW();

    GET DIAGNOSTICS v_expired = ROW_COUNT;

    -- Notify expired merchants
    INSERT INTO public.notifications (user_id, type, title, body)
    SELECT profile_id, 'subscription_expired',
           'انتهى اشتراكك ❌',
           'اشتراك ' || tier || ' انتهى. قم بالترقية لاستعادة ميزاتك.'
    FROM public.subscriptions
    WHERE status = 'Expired'
      AND profile_id NOT IN (
          SELECT user_id FROM public.notifications
          WHERE type = 'subscription_expired'
            AND created_at > NOW() - INTERVAL '1 day'
      );

    RETURN jsonb_build_object(
        'expiring_soon', v_expiring,
        'expired', v_expired,
        'run_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.subscription_lifecycle_check() TO authenticated;

-- Schedule daily lifecycle check at midnight (pg_cron)
DO $$
BEGIN
    PERFORM cron.schedule(
        'subscription-lifecycle-daily',
        '0 0 * * *',
        'SELECT public.subscription_lifecycle_check()'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available — run subscription_lifecycle_check() manually or via Edge Function';
END $$;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
