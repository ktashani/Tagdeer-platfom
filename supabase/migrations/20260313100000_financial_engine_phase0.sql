-- ========================================================
-- Migration: Financial Engine — Phase 0: Schema Cleanup
-- Description: Resolves legacy tier naming, adds multi-gateway
--   payment columns, expands subscription state machine,
--   creates immutable payment audit log, and seeds
--   payment gateway configuration.
-- ========================================================


-- ═══════════════════════════════════════════════════════════
-- 1. SUBSCRIPTION STATUS EXPANSION
-- ═══════════════════════════════════════════════════════════

-- Drop the old CHECK constraint on subscriptions.status
DO $$
DECLARE
    const_name text;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.subscriptions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';

    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.subscriptions DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- Add the expanded state machine
ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_status_check
CHECK (status IN (
    'Pending',        -- Payment submitted, awaiting admin review
    'Active',         -- Confirmed and running
    'Expiring Soon',  -- Within 7 days of expiry (cron-set)
    'Expired',        -- Past expires_at date
    'Grace Period',   -- Post-expiry window before feature revocation
    'Suspended',      -- Admin-initiated hold (fraud/dispute)
    'Terminated'      -- Permanently ended
));

-- Add grace_period_days column for per-tier configurability
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 3;


-- ═══════════════════════════════════════════════════════════
-- 2. TRANSACTIONS TABLE EXPANSION
-- ═══════════════════════════════════════════════════════════

-- Add multi-currency and multi-gateway fields
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'LYD';

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'manual_bank';

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS gateway_reference TEXT;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,4);

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Expand transaction status to include 'rejected' (may already exist)
DO $$
DECLARE
    const_name text;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%';

    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.transactions DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_status_check
CHECK (status IN ('pending', 'completed', 'rejected'));


-- ═══════════════════════════════════════════════════════════
-- 3. IMMUTABLE PAYMENT AUDIT LOG
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.payment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,          -- 'transaction', 'subscription'
    entity_id UUID NOT NULL,            -- FK to source record
    action TEXT NOT NULL,               -- 'created', 'approved', 'rejected', 'expired', 'suspended', 'terminated', 'reinstated'
    old_status TEXT,
    new_status TEXT,
    performed_by UUID REFERENCES public.profiles(id),
    reason TEXT,                        -- Admin note / rejection reason
    metadata JSONB DEFAULT '{}'::jsonb, -- Gateway details, amounts, currency
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.payment_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.payment_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.payment_audit_log(created_at);

-- Enable RLS
ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

-- IMMUTABLE: INSERT only for admins, SELECT for admins. NO UPDATE. NO DELETE.
CREATE POLICY "Admins can insert audit entries"
    ON public.payment_audit_log FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
    );

-- Service role can also insert (for cron jobs and RPCs)
CREATE POLICY "Service role can insert audit entries"
    ON public.payment_audit_log FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can read audit log"
    ON public.payment_audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin', 'assistant_admin')
        )
    );

-- Grant permissions
GRANT SELECT, INSERT ON public.payment_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.payment_audit_log TO service_role;


-- ═══════════════════════════════════════════════════════════
-- 4. SEED PAYMENT GATEWAYS CONFIG
-- ═══════════════════════════════════════════════════════════

INSERT INTO public.platform_config (key, value) VALUES
('payment_gateways', '[
    {
        "id": "manual_bank",
        "name": "Bank Transfer",
        "name_ar": "تحويل بنكي",
        "type": "manual",
        "currency": "LYD",
        "isActive": true,
        "config": {
            "bank_name": "Bank of Commerce & Development",
            "account_number": "",
            "instructions": "Transfer to the above account and upload your receipt.",
            "instructions_ar": "حوّل المبلغ إلى الحساب أعلاه وارفع صورة الإيصال."
        }
    },
    {
        "id": "crypto_usdt",
        "name": "Crypto (USDT-TRC20)",
        "name_ar": "عملة رقمية (USDT)",
        "type": "crypto",
        "currency": "USDT",
        "isActive": false,
        "config": {
            "wallet_address": "",
            "network": "TRC-20",
            "exchange_rate_lyd_per_usdt": 6.2
        }
    },
    {
        "id": "tlync_lyd",
        "name": "Tlync (Online Payment)",
        "name_ar": "تلينك (دفع إلكتروني)",
        "type": "api",
        "currency": "LYD",
        "isActive": false,
        "config": {
            "api_base_url": "",
            "merchant_id": "",
            "webhook_secret": ""
        }
    }
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ═══════════════════════════════════════════════════════════
-- 5. ADD FREEBIE MODE TO TIER PRICING
-- ═══════════════════════════════════════════════════════════

-- Update each tier in the existing tier_pricing JSON to include isFreebie and originalPrice
UPDATE public.platform_config
SET value = (
    SELECT jsonb_agg(
        tier || jsonb_build_object(
            'isFreebie', COALESCE(tier->>'isFreebie', 'false')::boolean,
            'originalPrice', CASE WHEN tier ? 'originalPrice' THEN tier->'originalPrice' ELSE 'null'::jsonb END,
            'gracePeriodDays', COALESCE((tier->>'gracePeriodDays')::int, 3)
        )
    )
    FROM jsonb_array_elements(value) AS tier
)
WHERE key = 'tier_pricing';


-- ═══════════════════════════════════════════════════════════
-- 6. UPDATED admin_confirm_payment RPC
--    - Uses new tier names from platform_config
--    - Writes immutable audit log
--    - Sets confirmed_by / confirmed_at
-- ═══════════════════════════════════════════════════════════

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
BEGIN
    v_admin_id := auth.uid();

    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Get transaction details
    SELECT business_id, requested_tier, duration, owner_id, amount, currency, payment_gateway
    INTO v_business_id, v_tier, v_duration, v_owner_id, v_amount, v_currency, v_gateway
    FROM public.transactions
    WHERE id = p_txn_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending transaction not found';
    END IF;

    -- Map duration to days
    IF v_duration = '30 Days' OR v_duration = '1 Month' THEN v_days := 30;
    ELSIF v_duration = '90 Days' OR v_duration = '3 Months' THEN v_days := 90;
    ELSIF v_duration = '365 Days' OR v_duration = '1 Year' THEN v_days := 365;
    ELSE v_days := 30;
    END IF;

    -- Mark transaction as completed with audit fields
    UPDATE public.transactions
    SET status = 'completed',
        confirmed_by = v_admin_id,
        confirmed_at = NOW()
    WHERE id = p_txn_id;

    -- Write immutable audit log
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, metadata)
    VALUES (
        'transaction', p_txn_id, 'approved', 'pending', 'completed', v_admin_id,
        jsonb_build_object('amount', v_amount, 'currency', v_currency, 'gateway', v_gateway, 'tier', v_tier)
    );

    -- Check if it is an Addon Purchase
    IF v_tier LIKE '%Addon%' THEN
        v_addon_type := lower(split_part(v_tier, ' ', 1));

        INSERT INTO public.merchant_addons (profile_id, addon_type, quantity, status, expires_at)
        VALUES (v_owner_id, v_addon_type, 1, 'active', now() + (v_days || ' days')::interval);

        INSERT INTO public.feature_allocations (profile_id, business_id, feature_type, status)
        VALUES (v_owner_id, v_business_id, v_addon_type, 'active')
        ON CONFLICT (profile_id, business_id, feature_type)
        DO UPDATE SET status = 'active';

    ELSE
        -- Tier Upgrade — normalize legacy tier names
        IF v_tier = 'Tier 1' THEN v_tier := 'Pro'; END IF;
        IF v_tier = 'Tier 2' THEN v_tier := 'Enterprise'; END IF;

        -- Upsert Subscription
        INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at)
        VALUES (v_business_id, v_owner_id, v_tier, 'Active', now() + (v_days || ' days')::interval)
        ON CONFLICT (business_id)
        DO UPDATE SET
            tier = EXCLUDED.tier,
            status = 'Active',
            expires_at = EXCLUDED.expires_at,
            profile_id = EXCLUDED.profile_id;

        -- Write subscription audit log
        INSERT INTO public.payment_audit_log (entity_type, entity_id, action, new_status, performed_by, metadata)
        VALUES (
            'subscription', v_business_id, 'activated', 'Active', v_admin_id,
            jsonb_build_object('tier', v_tier, 'days', v_days, 'source_txn', p_txn_id)
        );
    END IF;

END;
$$;


-- ═══════════════════════════════════════════════════════════
-- 7. NEW: admin_reject_payment RPC
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION admin_reject_payment(p_txn_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_id UUID;
    v_amount NUMERIC;
    v_currency TEXT;
    v_gateway TEXT;
    v_tier TEXT;
BEGIN
    v_admin_id := auth.uid();

    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Verify transaction exists and is pending
    SELECT amount, currency, payment_gateway, requested_tier
    INTO v_amount, v_currency, v_gateway, v_tier
    FROM public.transactions
    WHERE id = p_txn_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending transaction not found';
    END IF;

    -- Mark as rejected
    UPDATE public.transactions
    SET status = 'rejected',
        rejection_reason = p_reason,
        confirmed_by = v_admin_id,
        confirmed_at = NOW()
    WHERE id = p_txn_id;

    -- Write immutable audit log
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, reason, metadata)
    VALUES (
        'transaction', p_txn_id, 'rejected', 'pending', 'rejected', v_admin_id, p_reason,
        jsonb_build_object('amount', v_amount, 'currency', v_currency, 'gateway', v_gateway, 'tier', v_tier)
    );
END;
$$;


-- ═══════════════════════════════════════════════════════════
-- 8. FORCE SCHEMA CACHE RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
