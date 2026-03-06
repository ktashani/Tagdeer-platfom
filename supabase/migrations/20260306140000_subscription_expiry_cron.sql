-- Migration: Subscription Auto Expiry Cron
-- Description: Adds a pg_cron job to automatically expire subscriptions that are past their expires_at date

CREATE OR REPLACE FUNCTION check_and_expire_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Mark active subscriptions as expired if past their expiry date
    UPDATE public.subscriptions
    SET status = 'Expired'
    WHERE status = 'Active'
      AND expires_at < NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Also mark subscriptions expiring within 7 days as "Expiring Soon"
    UPDATE public.subscriptions
    SET status = 'Expiring Soon'
    WHERE status = 'Active'
      AND expires_at < NOW() + INTERVAL '7 days'
      AND expires_at >= NOW();
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Try to enable pg_cron and schedule the job
-- NOTE: pg_cron may not be available on all Supabase plans
-- If this fails, the client-side check serves as fallback
DO $$
BEGIN
    -- Check if pg_cron extension is available
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
        
        -- Remove existing job if any
        PERFORM cron.unschedule('expire-subscriptions');
        
        -- Run daily at 3:00 AM UTC
        PERFORM cron.schedule(
            'expire-subscriptions',
            '0 3 * * *',
            'SELECT check_and_expire_subscriptions()'
        );
    END IF;
EXCEPTION
    WHEN others THEN
        -- pg_cron not available, silently continue
        RAISE NOTICE 'pg_cron not available';
END;
$$;
