-- Migration: Subscription Lifecycle State Machine (Automated Transitions)
-- Replaces the original check_and_expire_subscriptions function

CREATE OR REPLACE FUNCTION check_and_expire_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_row RECORD;
BEGIN
    -- 1. Grace Period → Free (grace expired, revoke to Free tier)
    FOR v_row IN
        SELECT id, profile_id FROM public.subscriptions
        WHERE status = 'Grace Period'
          AND expires_at + (COALESCE((quotas->>'gracePeriodDays')::int, 3) || ' days')::interval < NOW()
    LOOP
        UPDATE public.subscriptions
        SET status = 'Expired', tier = 'Free', quotas = '{}'::jsonb
        WHERE id = v_row.id;

        -- Write audit log
        INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, reason)
        VALUES ('subscription', v_row.id, 'expired', 'Grace Period', 'Expired', NULL, 'Grace period ended — auto-reverted to Free');

        v_count := v_count + 1;
    END LOOP;

    -- 2. Expired → Grace Period (just expired, enter grace window)
    FOR v_row IN
        SELECT id, profile_id FROM public.subscriptions
        WHERE status = 'Expired'
          AND tier != 'Free'
          AND expires_at >= NOW() - INTERVAL '1 day'
    LOOP
        UPDATE public.subscriptions
        SET status = 'Grace Period'
        WHERE id = v_row.id;

        INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, reason)
        VALUES ('subscription', v_row.id, 'expired', 'Expired', 'Grace Period', NULL, 'Entered grace period — merchant has 3 days to renew');

        v_count := v_count + 1;
    END LOOP;

    -- 3. Active → Expired (past expiry date)
    UPDATE public.subscriptions
    SET status = 'Expired'
    WHERE status = 'Active'
      AND expires_at < NOW();
    GET DIAGNOSTICS v_count = v_count + ROW_COUNT;

    -- 4. Active → Expiring Soon (within 7 days)
    UPDATE public.subscriptions
    SET status = 'Expiring Soon'
    WHERE status = 'Active'
      AND expires_at < NOW() + INTERVAL '7 days'
      AND expires_at >= NOW();

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-schedule the cron job (idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
        PERFORM cron.unschedule('expire-subscriptions');
        PERFORM cron.schedule(
            'expire-subscriptions',
            '0 */6 * * *',  -- Run every 6 hours instead of daily for tighter lifecycle
            'SELECT check_and_expire_subscriptions()'
        );
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'pg_cron not available';
END;
$$;
