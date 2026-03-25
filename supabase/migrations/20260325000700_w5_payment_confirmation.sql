-- ============================================================
-- Migration: W5 — Payment Confirmation Pipeline
-- Branch: feature/v2-subdomain-portals
--
-- Creates:
--   1. transactions table for upgrade requests
--   2. payment_audit_log table for audit trail
--   3. admin_confirm_payment RPC (with quota sync)
--   4. admin_reject_payment RPC
--   5. merchant_verified_at on user_coupons (coupon verification)
--   6. merchant_verify_coupon RPC
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. TRANSACTIONS TABLE
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

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Merchants can view and create their own transactions
DROP POLICY IF EXISTS "txn_select_own" ON public.transactions;
CREATE POLICY "txn_select_own" ON public.transactions
    FOR SELECT USING (owner_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "txn_insert_own" ON public.transactions;
CREATE POLICY "txn_insert_own" ON public.transactions
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Only admins can update (approve/reject)
DROP POLICY IF EXISTS "txn_update_admin" ON public.transactions;
CREATE POLICY "txn_update_admin" ON public.transactions
    FOR UPDATE USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════
-- 2. PAYMENT AUDIT LOG
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

-- Admins see all, merchants see their own
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
-- 3. ADMIN CONFIRM PAYMENT RPC
--    Approves a pending transaction, syncs quotas from
--    subscription_tiers, and notifies the merchant.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.admin_confirm_payment(UUID);
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

    -- Look up tier quotas
    SELECT allocations, price INTO v_quotas, v_tier_price
    FROM public.subscription_tiers
    WHERE LOWER(name) = LOWER(v_txn.requested_tier)
    LIMIT 1;

    IF v_quotas IS NULL THEN
        v_quotas := '{}'::jsonb;
    END IF;

    -- Duration: default 30 days
    v_duration_days := 30;

    -- Update transaction
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
                'merchant_id', v_txn.owner_id
            ));

    -- Notify merchant
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (v_txn.owner_id, 'payment_confirmed',
            'تمت الموافقة على طلب الترقية ✅',
            'تم تفعيل اشتراك ' || v_txn.requested_tier || ' بنجاح. مبروك!');

    RETURN jsonb_build_object(
        'success', true,
        'txn_id', p_txn_id,
        'tier', v_txn.requested_tier,
        'expires_at', NOW() + (v_duration_days || ' days')::interval
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_confirm_payment(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 4. ADMIN REJECT PAYMENT RPC
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.admin_reject_payment(UUID, TEXT);
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
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (v_txn.owner_id, 'payment_rejected',
            'تم رفض طلب الترقية ❌',
            'السبب: ' || p_reason || '. يمكنك إعادة المحاولة.');

    RETURN jsonb_build_object('success', true, 'txn_id', p_txn_id, 'reason', p_reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_payment(UUID, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 5. COUPON MERCHANT VERIFICATION
-- ═══════════════════════════════════════════════════════════

-- Add merchant_verified_at column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'user_coupons'
                   AND column_name = 'merchant_verified_at') THEN
        ALTER TABLE public.user_coupons
            ADD COLUMN merchant_verified_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

DROP FUNCTION IF EXISTS public.merchant_verify_coupon(UUID);
CREATE OR REPLACE FUNCTION public.merchant_verify_coupon(p_coupon_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_coupon RECORD;
BEGIN
    SELECT uc.*, b.name AS business_name
    INTO v_coupon
    FROM public.user_coupons uc
    JOIN public.businesses b ON b.id = uc.business_id
    WHERE uc.id = p_coupon_id
      AND b.claimed_by = auth.uid();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Coupon not found or not your business' USING ERRCODE = 'P0002';
    END IF;

    IF v_coupon.merchant_verified_at IS NOT NULL THEN
        RAISE EXCEPTION 'Coupon already verified' USING ERRCODE = 'P0004';
    END IF;

    UPDATE public.user_coupons
    SET merchant_verified_at = NOW(),
        status = 'REDEEMED'
    WHERE id = p_coupon_id;

    RETURN jsonb_build_object(
        'success', true,
        'coupon_id', p_coupon_id,
        'business_name', v_coupon.business_name,
        'verified_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merchant_verify_coupon(UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
