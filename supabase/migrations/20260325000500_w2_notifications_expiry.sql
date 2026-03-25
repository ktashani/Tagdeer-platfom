-- ============================================================
-- Migration: W2-2 — Subscription Expiry Notifications
-- Branch: feature/v2-subdomain-portals
--
-- Creates:
--   1. notifications table for merchant-facing alerts
--   2. check_expiring_subscriptions() function
--   3. pg_cron job to run daily at 08:00 UTC
--
-- Notification types:
--   - subscription_expiring (T-7 days)
--   - subscription_expired
--   - claim_approved / claim_rejected (from W2-1)
--   - tier_upgrade_approved / tier_upgrade_rejected
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. NOTIFICATIONS TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'subscription_expiring',
        'subscription_expired',
        'claim_approved',
        'claim_rejected',
        'tier_upgrade_approved',
        'tier_upgrade_rejected',
        'system_announcement',
        'payment_received',
        'payment_overdue'
    )),
    title TEXT NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,     -- { business_id, subscription_id, etc. }
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "notif_select_own"
    ON public.notifications FOR SELECT
    USING (auth.uid() = profile_id);

-- Users can mark their own as read
CREATE POLICY "notif_update_own"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- Admin can do everything
CREATE POLICY "notif_all_admin"
    ON public.notifications FOR ALL
    USING (public.is_platform_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_profile
    ON public.notifications(profile_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type
    ON public.notifications(type, created_at DESC);


-- ═══════════════════════════════════════════════════════════
-- 2. EXPIRY CHECK FUNCTION
--    Finds subscriptions expiring within 7 days and creates
--    notifications (idempotent: won't duplicate alerts).
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_expiring_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
    v_sub RECORD;
BEGIN
    -- T-7 day warnings
    FOR v_sub IN
        SELECT s.id, s.profile_id, s.business_id, s.tier, s.expires_at,
               b.name as business_name
        FROM public.subscriptions s
        LEFT JOIN public.businesses b ON b.id = s.business_id
        WHERE s.status = 'Active'
          AND s.expires_at IS NOT NULL
          AND s.expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
          -- Don't re-notify if already sent
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications n
              WHERE n.profile_id = s.profile_id
                AND n.type = 'subscription_expiring'
                AND n.metadata->>'subscription_id' = s.id::TEXT
                AND n.created_at > NOW() - INTERVAL '7 days'
          )
    LOOP
        INSERT INTO public.notifications (profile_id, type, title, message, metadata)
        VALUES (
            v_sub.profile_id,
            'subscription_expiring',
            'اشتراكك يقترب من الانتهاء',  -- Your subscription is expiring soon
            format(
                'اشتراك %s لـ %s سينتهي في %s. قم بالتجديد للحفاظ على مميزاتك.',
                v_sub.tier,
                COALESCE(v_sub.business_name, 'عملك'),
                to_char(v_sub.expires_at AT TIME ZONE 'Africa/Tripoli', 'DD/MM/YYYY')
            ),
            jsonb_build_object(
                'subscription_id', v_sub.id,
                'business_id', v_sub.business_id,
                'tier', v_sub.tier,
                'expires_at', v_sub.expires_at,
                'days_remaining', EXTRACT(DAY FROM v_sub.expires_at - NOW())::INTEGER
            )
        );
        v_count := v_count + 1;
    END LOOP;

    -- Expired subscriptions (grace period check)
    FOR v_sub IN
        SELECT s.id, s.profile_id, s.business_id, s.tier, s.expires_at,
               b.name as business_name, s.grace_period_days
        FROM public.subscriptions s
        LEFT JOIN public.businesses b ON b.id = s.business_id
        WHERE s.status = 'Active'
          AND s.expires_at IS NOT NULL
          AND s.expires_at < NOW()
          AND NOT EXISTS (
              SELECT 1 FROM public.notifications n
              WHERE n.profile_id = s.profile_id
                AND n.type = 'subscription_expired'
                AND n.metadata->>'subscription_id' = s.id::TEXT
                AND n.created_at > NOW() - INTERVAL '1 day'
          )
    LOOP
        -- Mark subscription as expired or grace period
        IF v_sub.grace_period_days > 0
           AND v_sub.expires_at + (v_sub.grace_period_days || ' days')::INTERVAL > NOW()
        THEN
            UPDATE public.subscriptions
            SET status = 'Grace Period'
            WHERE id = v_sub.id AND status = 'Active';

            INSERT INTO public.notifications (profile_id, type, title, message, metadata)
            VALUES (
                v_sub.profile_id,
                'subscription_expired',
                'انتهى اشتراكك — فترة سماح',
                format(
                    'اشتراك %s انتهى. لديك %s أيام إضافية قبل تعليق الخدمة.',
                    v_sub.tier, v_sub.grace_period_days
                ),
                jsonb_build_object(
                    'subscription_id', v_sub.id,
                    'business_id', v_sub.business_id,
                    'tier', v_sub.tier,
                    'grace_until', v_sub.expires_at + (v_sub.grace_period_days || ' days')::INTERVAL
                )
            );
        ELSE
            UPDATE public.subscriptions
            SET status = 'Expired'
            WHERE id = v_sub.id AND status IN ('Active', 'Grace Period');

            INSERT INTO public.notifications (profile_id, type, title, message, metadata)
            VALUES (
                v_sub.profile_id,
                'subscription_expired',
                'انتهى اشتراكك',
                format('اشتراك %s لـ %s انتهى. جدّد الآن لاستعادة مميزاتك.',
                    v_sub.tier, COALESCE(v_sub.business_name, 'عملك')),
                jsonb_build_object(
                    'subscription_id', v_sub.id,
                    'business_id', v_sub.business_id,
                    'tier', v_sub.tier
                )
            );
        END IF;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_expiring_subscriptions() TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 3. MARK NOTIFICATION AS READ RPC
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE id = p_notification_id
      AND profile_id = auth.uid();

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 4. MARK ALL NOTIFICATIONS AS READ
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE profile_id = auth.uid()
      AND is_read = false;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 5. CRON JOB (pg_cron)
--    Run daily at 08:00 Libya time (05:00 UTC)
--    NOTE: pg_cron must be enabled in Supabase Dashboard
--          (Settings → Extensions → pg_cron)
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove existing job if any
        PERFORM cron.unschedule('check_expiring_subscriptions');

        -- Schedule daily at 05:00 UTC (08:00 Tripoli time)
        PERFORM cron.schedule(
            'check_expiring_subscriptions',
            '0 5 * * *',
            'SELECT public.check_expiring_subscriptions()'
        );

        RAISE NOTICE 'pg_cron job scheduled: check_expiring_subscriptions at 05:00 UTC daily';
    ELSE
        RAISE NOTICE 'pg_cron extension not found — skipping cron setup. Enable it in Supabase Dashboard.';
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
