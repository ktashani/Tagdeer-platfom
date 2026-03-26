-- ============================================================
-- Migration: Fix Admin Payment Confirm/Reject RPCs
-- Branch: feature/v2-subdomain-portals
--
-- Problem:
--   The admin financials page calls admin_confirm_payment and
--   admin_reject_payment RPCs which return 400 errors because:
--     1. The transactions table may be missing columns that
--        the frontend writes (currency, gateway_reference,
--        exchange_rate, duration, screenshot_url).
--     2. The RPCs may not exist in the schema cache.
--     3. The confirm RPC hardcodes 30 days instead of reading
--        the duration from the transaction record.
--
-- This migration:
--   1. Ensures transactions table has all required columns
--   2. Recreates admin_confirm_payment with duration parsing
--   3. Recreates admin_reject_payment
--   4. Ensures payment_audit_log table exists
--   5. Reloads PostgREST schema cache
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. ENSURE TRANSACTIONS TABLE EXISTS + HAS ALL COLUMNS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id),
    business_id UUID REFERENCES public.businesses(id),
    requested_tier TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'manual',
    payment_gateway TEXT NOT NULL DEFAULT 'bank_transfer',
    proof_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'rejected')),
    rejection_reason TEXT,
    confirmed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns the frontend expects (safe: IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'transactions'
                   AND column_name = 'currency') THEN
        ALTER TABLE public.transactions ADD COLUMN currency TEXT DEFAULT 'LYD';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'transactions'
                   AND column_name = 'gateway_reference') THEN
        ALTER TABLE public.transactions ADD COLUMN gateway_reference TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'transactions'
                   AND column_name = 'exchange_rate') THEN
        ALTER TABLE public.transactions ADD COLUMN exchange_rate NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'transactions'
                   AND column_name = 'duration') THEN
        ALTER TABLE public.transactions ADD COLUMN duration TEXT DEFAULT 'Month 1';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'transactions'
                   AND column_name = 'screenshot_url') THEN
        ALTER TABLE public.transactions ADD COLUMN screenshot_url TEXT;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- 2. ENSURE RLS POLICIES ON TRANSACTIONS
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "txn_select_own" ON public.transactions;
CREATE POLICY "txn_select_own" ON public.transactions
    FOR SELECT USING (owner_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "txn_insert_own" ON public.transactions;
CREATE POLICY "txn_insert_own" ON public.transactions
    FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "txn_update_admin" ON public.transactions;
CREATE POLICY "txn_update_admin" ON public.transactions
    FOR UPDATE USING (public.is_platform_admin());

-- Admin ALL override
DROP POLICY IF EXISTS "txn_all_admin" ON public.transactions;
CREATE POLICY "txn_all_admin" ON public.transactions
    FOR ALL USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════
-- 3. ENSURE PAYMENT AUDIT LOG TABLE EXISTS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL DEFAULT 'transaction',
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pal_admin_all" ON public.payment_audit_log;
CREATE POLICY "pal_admin_all" ON public.payment_audit_log
    FOR ALL USING (public.is_platform_admin());

DROP POLICY IF EXISTS "pal_merchant_select" ON public.payment_audit_log;
CREATE POLICY "pal_merchant_select" ON public.payment_audit_log
    FOR SELECT USING (
        entity_type = 'transaction'
        AND entity_id IN (
            SELECT id FROM public.transactions WHERE owner_id = auth.uid()
        )
    );


-- ═══════════════════════════════════════════════════════════
-- 4. DROP ALL EXISTING OVERLOADS OF ADMIN PAYMENT RPCs
--    (prevents "function name is not unique" error)
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all admin_confirm_payment overloads
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'admin_confirm_payment'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
    END LOOP;

    -- Drop all admin_reject_payment overloads
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'admin_reject_payment'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
    END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════
-- 5. ADMIN CONFIRM PAYMENT RPC
--    Approves a pending transaction, creates/updates the
--    subscription, syncs quotas, and notifies the merchant.
--    Reads the `duration` field from the transaction to
--    calculate the correct expiration date.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_confirm_payment(p_txn_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_txn RECORD;
    v_quotas JSONB;
    v_tier_price NUMERIC;
    v_duration_days INTEGER;
    v_duration_text TEXT;
BEGIN
    -- Admin check
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    -- Get transaction
    SELECT * INTO v_txn FROM public.transactions WHERE id = p_txn_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_txn.status != 'pending' THEN
        RAISE EXCEPTION 'Transaction is not pending' USING ERRCODE = 'P0003';
    END IF;

    -- Look up tier quotas from subscription_tiers (if exists)
    BEGIN
        SELECT allocations, price INTO v_quotas, v_tier_price
        FROM public.subscription_tiers
        WHERE LOWER(name) = LOWER(v_txn.requested_tier)
        LIMIT 1;
    EXCEPTION WHEN undefined_table THEN
        v_quotas := NULL;
    END;

    IF v_quotas IS NULL THEN
        v_quotas := '{}'::jsonb;
    END IF;

    -- Parse duration from the transaction record
    -- Supports: "Month 1", "Month 3", "Month 6", "Month 12", a raw number, or fallback 30
    v_duration_text := COALESCE(v_txn.duration, 'Month 1');
    v_duration_days := CASE
        WHEN v_duration_text ~* '(\d+)' THEN
            -- Extract the first number and multiply by 30
            (regexp_match(v_duration_text, '(\d+)'))[1]::INTEGER * 30
        ELSE 30
    END;

    -- Update transaction status
    UPDATE public.transactions
    SET status = 'completed',
        confirmed_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_txn_id;

    -- Upsert subscription with quotas from tier
    INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at, quotas)
    VALUES (v_txn.business_id, v_txn.owner_id, v_txn.requested_tier,
            'Active', NOW() + (v_duration_days || ' days')::interval, v_quotas)
    ON CONFLICT (profile_id)
    DO UPDATE SET
        tier = EXCLUDED.tier,
        status = 'Active',
        expires_at = EXCLUDED.expires_at,
        business_id = EXCLUDED.business_id,
        quotas = EXCLUDED.quotas;

    -- Audit log
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES ('transaction', p_txn_id, 'confirmed', auth.uid(),
            jsonb_build_object(
                'tier', v_txn.requested_tier,
                'amount', v_txn.amount,
                'duration_days', v_duration_days,
                'merchant_id', v_txn.owner_id
            ));

    -- Notify merchant (wrapped in BEGIN/EXCEPTION to not fail if notifications table is missing)
    BEGIN
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (v_txn.owner_id, 'payment_confirmed',
                'تمت الموافقة على طلب الترقية ✅',
                'تم تفعيل اشتراك ' || v_txn.requested_tier || ' لمدة ' || v_duration_days || ' يوم. مبروك!');
    EXCEPTION WHEN undefined_table THEN
        -- notifications table may not exist yet
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'txn_id', p_txn_id,
        'tier', v_txn.requested_tier,
        'duration_days', v_duration_days,
        'expires_at', NOW() + (v_duration_days || ' days')::interval
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_confirm_payment(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 6. ADMIN REJECT PAYMENT RPC
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_reject_payment(
    p_txn_id UUID,
    p_reason TEXT DEFAULT 'غير مطابق للشروط'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_txn RECORD;
BEGIN
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_txn FROM public.transactions WHERE id = p_txn_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_txn.status != 'pending' THEN
        RAISE EXCEPTION 'Transaction is not pending' USING ERRCODE = 'P0003';
    END IF;

    -- Reject
    UPDATE public.transactions
    SET status = 'rejected',
        rejection_reason = p_reason,
        confirmed_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_txn_id;

    -- Audit log
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES ('transaction', p_txn_id, 'rejected', auth.uid(),
            jsonb_build_object('reason', p_reason, 'merchant_id', v_txn.owner_id));

    -- Notify merchant
    BEGIN
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (v_txn.owner_id, 'payment_rejected',
                'تم رفض طلب الترقية ❌',
                'السبب: ' || p_reason || '. يمكنك إعادة المحاولة.');
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    RETURN jsonb_build_object('success', true, 'txn_id', p_txn_id, 'reason', p_reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_payment(UUID, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 7. SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
