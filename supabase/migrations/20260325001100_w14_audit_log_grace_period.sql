-- ============================================================
-- Migration: W14 — Admin Audit Log + Subscription Grace Period
-- Branch: feature/v2-subdomain-portals
--
-- Creates:
--   1. admin_audit_log table for tracking admin actions
--   2. Subscription grace_period_days default + dashboard helpers
--   3. RPC: log_admin_action (generic audit entry)
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. ADMIN AUDIT LOG TABLE
--    Records every admin action for accountability and dispute
--    resolution. Immutable — no UPDATE or DELETE policies.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,  -- 'business', 'user', 'subscription', 'payment', 'claim'
    target_id UUID,
    details JSONB DEFAULT '{}'::JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit log
DROP POLICY IF EXISTS "audit_admin_read" ON public.admin_audit_log;
CREATE POLICY "audit_admin_read" ON public.admin_audit_log
    FOR SELECT USING (public.is_platform_admin());

-- Only system (SECURITY DEFINER functions) can insert
DROP POLICY IF EXISTS "audit_system_insert" ON public.admin_audit_log;
CREATE POLICY "audit_system_insert" ON public.admin_audit_log
    FOR INSERT WITH CHECK (public.is_platform_admin());

CREATE INDEX IF NOT EXISTS idx_audit_admin ON public.admin_audit_log (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON public.admin_audit_log (target_type, target_id);


-- ═══════════════════════════════════════════════════════════
-- 2. LOG ADMIN ACTION RPC
--    Called by admin components after any mutation.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_action TEXT,
    p_target_type TEXT,
    p_target_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_details)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, UUID, JSONB) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 3. ENSURE GRACE PERIOD COLUMN ON SUBSCRIPTIONS
--    Default 3 days grace period for all subscriptions.
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'grace_period_days'
    ) THEN
        ALTER TABLE public.subscriptions ADD COLUMN grace_period_days INTEGER DEFAULT 3;
    ELSE
        -- Ensure default is set
        ALTER TABLE public.subscriptions ALTER COLUMN grace_period_days SET DEFAULT 3;
    END IF;
END $$;

-- Update existing rows without grace period
UPDATE public.subscriptions
SET grace_period_days = 3
WHERE grace_period_days IS NULL OR grace_period_days = 0;


-- ═══════════════════════════════════════════════════════════
-- 4. MERCHANT GRACE PERIOD CHECK RPC
--    Returns subscription status with grace period awareness.
--    Used by merchant dashboard to show grace period banner.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_subscription_status(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sub RECORD;
BEGIN
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE business_id = p_business_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'none', 'tier', 'Free');
    END IF;

    -- Check if in grace period
    IF v_sub.status = 'Grace Period' AND v_sub.expires_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'status', 'grace_period',
            'tier', v_sub.tier,
            'expires_at', v_sub.expires_at,
            'grace_until', v_sub.expires_at + (COALESCE(v_sub.grace_period_days, 3) || ' days')::INTERVAL,
            'days_remaining', EXTRACT(DAY FROM
                (v_sub.expires_at + (COALESCE(v_sub.grace_period_days, 3) || ' days')::INTERVAL) - NOW()
            )::INTEGER
        );
    END IF;

    -- Check if expired
    IF v_sub.status = 'Expired' THEN
        RETURN jsonb_build_object(
            'status', 'expired',
            'tier', v_sub.tier,
            'expired_at', v_sub.expires_at
        );
    END IF;

    -- Active subscription
    RETURN jsonb_build_object(
        'status', 'active',
        'tier', v_sub.tier,
        'expires_at', v_sub.expires_at,
        'days_remaining', CASE
            WHEN v_sub.expires_at IS NOT NULL
            THEN GREATEST(0, EXTRACT(DAY FROM v_sub.expires_at - NOW())::INTEGER)
            ELSE NULL
        END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_status(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
