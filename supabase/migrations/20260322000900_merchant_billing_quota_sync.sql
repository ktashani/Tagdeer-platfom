-- ============================================================
-- Migration: Merchant Billing — Quota Sync + RLS + Gateway Hook
-- Addresses GAPs 1, 3, 5, 6 of Merchant Billing Implementation Plan
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- GAP 1 + 3: admin_confirm_payment WITH quota sync from subscription_tiers
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_confirm_payment(p_txn_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_tier TEXT;
    v_duration TEXT;
    v_owner_id UUID;
    v_days INTEGER;
    v_addon_type TEXT;
    v_admin_id UUID;
    v_amount NUMERIC;
    v_currency TEXT;
    v_gateway TEXT;
    v_quotas JSONB;
BEGIN
    v_admin_id := auth.uid();

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT business_id, requested_tier, duration, owner_id, amount, currency, payment_gateway
    INTO v_business_id, v_tier, v_duration, v_owner_id, v_amount, v_currency, v_gateway
    FROM public.transactions
    WHERE id = p_txn_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending transaction not found';
    END IF;

    IF v_duration = '30 Days' OR v_duration = '1 Month' THEN v_days := 30;
    ELSIF v_duration = '90 Days' OR v_duration = '3 Months' THEN v_days := 90;
    ELSIF v_duration = '365 Days' OR v_duration = '1 Year' THEN v_days := 365;
    ELSE v_days := 30;
    END IF;

    -- ── NEW: Lookup tier allocations from subscription_tiers ──
    SELECT allocations INTO v_quotas
    FROM public.subscription_tiers
    WHERE name = v_tier
    LIMIT 1;

    -- Defensive fallback: if tier not found, use empty quotas
    IF v_quotas IS NULL THEN
        v_quotas := '{}'::jsonb;
    END IF;

    -- Mark transaction as completed
    UPDATE public.transactions
    SET status = 'completed',
        confirmed_by = v_admin_id,
        confirmed_at = NOW()
    WHERE id = p_txn_id;

    -- Audit log for transaction approval
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, metadata)
    VALUES (
        'transaction', p_txn_id, 'approved', 'pending', 'completed', v_admin_id,
        jsonb_build_object('amount', v_amount, 'currency', v_currency, 'gateway', v_gateway, 'tier', v_tier)
    );

    IF v_tier LIKE '%Addon%' THEN
        v_addon_type := lower(split_part(v_tier, ' ', 1));

        INSERT INTO public.merchant_addons (profile_id, addon_type, quantity, status, expires_at)
        VALUES (v_owner_id, v_addon_type, 1, 'active', now() + (v_days || ' days')::interval);

        INSERT INTO public.feature_allocations (profile_id, business_id, feature_type, status)
        VALUES (v_owner_id, v_business_id, v_addon_type, 'active')
        ON CONFLICT (profile_id, business_id, feature_type)
        DO UPDATE SET status = 'active';
    ELSE
        -- ── FIXED: Upsert subscription WITH quotas ──
        INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at, quotas)
        VALUES (v_business_id, v_owner_id, v_tier, 'Active', now() + (v_days || ' days')::interval, v_quotas)
        ON CONFLICT (profile_id)
        DO UPDATE SET
            tier = EXCLUDED.tier,
            status = 'Active',
            expires_at = EXCLUDED.expires_at,
            business_id = EXCLUDED.business_id,
            quotas = EXCLUDED.quotas;

        -- ── NEW: Seed base feature_allocations for the tier ──
        -- These are inactive by default; merchant activates via Settings toggles
        INSERT INTO public.feature_allocations (profile_id, business_id, feature_type, status)
        VALUES
            (v_owner_id, v_business_id, 'shield', 'inactive'),
            (v_owner_id, v_business_id, 'storefront', 'inactive')
        ON CONFLICT (profile_id, business_id, feature_type) DO NOTHING;

        -- Subscription activation audit log
        INSERT INTO public.payment_audit_log (entity_type, entity_id, action, new_status, performed_by, metadata)
        VALUES (
            'subscription', v_business_id, 'activated', 'Active', v_admin_id,
            jsonb_build_object('tier', v_tier, 'days', v_days, 'source_txn', p_txn_id, 'quotas', v_quotas)
        );
    END IF;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- GAP 6: payment_audit_log — Merchant-facing SELECT policy
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Merchants can view their payment audit" ON public.payment_audit_log;
CREATE POLICY "Merchants can view their payment audit"
    ON public.payment_audit_log FOR SELECT
    USING (
        entity_type = 'transaction'
        AND entity_id IN (
            SELECT id FROM public.transactions WHERE owner_id = auth.uid()
        )
    );


-- ────────────────────────────────────────────────────────────
-- GAP 5: Payment gateway config seed in platform_config
-- ────────────────────────────────────────────────────────────

INSERT INTO public.platform_config (key, value)
VALUES (
    'payment_gateway_config',
    '{"enabled": false, "default_gateway": null, "gateways": {}}'::jsonb
)
ON CONFLICT (key) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- Ensure subscriptions.quotas column exists
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS quotas JSONB DEFAULT '{}'::jsonb;


-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
