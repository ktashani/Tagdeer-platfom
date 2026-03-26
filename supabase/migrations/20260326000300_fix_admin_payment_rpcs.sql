-- ============================================================
-- Migration: Fix Admin Payment Pipeline — Full Schema Alignment
-- Branch: refactor-nextjs-phase2
--
-- ROOT CAUSE ANALYSIS:
-- ────────────────────
-- The admin financials page calls admin_confirm_payment and
-- admin_reject_payment RPCs that return 400 because:
--
--   1. subscriptions table (from 2026030101) has:
--      ❌ No profile_id column
--      ❌ No quotas column
--      ❌ No is_trial, trial_months columns
--      ❌ UNIQUE(business_id) instead of UNIQUE(profile_id)
--      ❌ CHECK (tier IN ('Tier 1','Tier 2')) blocks 'Pro','Enterprise','Growth','Free'
--
--   2. transactions table has:
--      ❌ CHECK (requested_tier IN ('Tier 1','Tier 2')) blocks new tier names
--      ❌ Missing: currency, gateway_reference, exchange_rate columns
--      ❌ Missing: payment_gateway column
--
--   3. RPCs from 20260325000700 use profile_id and quotas
--      that don't exist on the live table.
--
-- FIX: This migration evolves both tables idempotently, then
--      recreates the RPCs to match the actual live schema.
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. EVOLVE SUBSCRIPTIONS TABLE
--    Add missing columns + fix constraints
-- ═══════════════════════════════════════════════════════════

-- 1a. Add profile_id column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='subscriptions'
                   AND column_name='profile_id') THEN
        ALTER TABLE public.subscriptions ADD COLUMN profile_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- 1b. Add quotas column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='subscriptions'
                   AND column_name='quotas') THEN
        ALTER TABLE public.subscriptions ADD COLUMN quotas JSONB DEFAULT '{}';
    END IF;
END $$;

-- 1c. Add is_trial + trial_months columns
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='subscriptions'
                   AND column_name='is_trial') THEN
        ALTER TABLE public.subscriptions ADD COLUMN is_trial BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='subscriptions'
                   AND column_name='trial_months') THEN
        ALTER TABLE public.subscriptions ADD COLUMN trial_months INTEGER DEFAULT 0;
    END IF;
END $$;

-- 1d. Add addons column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='subscriptions'
                   AND column_name='addons') THEN
        ALTER TABLE public.subscriptions ADD COLUMN addons JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 1e. Add grace_period_days column
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='subscriptions'
                   AND column_name='grace_period_days') THEN
        ALTER TABLE public.subscriptions ADD COLUMN grace_period_days INTEGER DEFAULT 3;
    END IF;
END $$;

-- 1f. Backfill profile_id from businesses.claimed_by
UPDATE public.subscriptions s
SET profile_id = b.claimed_by
FROM public.businesses b
WHERE s.business_id = b.id
  AND s.profile_id IS NULL
  AND b.claimed_by IS NOT NULL;

-- 1g. Add UNIQUE constraint on profile_id (if missing)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema='public' AND table_name='subscriptions'
        AND constraint_name='subscriptions_profile_id_unique'
    ) THEN
        ALTER TABLE public.subscriptions
            DROP CONSTRAINT IF EXISTS subscriptions_profile_id_unique;
        -- Only add if we won't get duplicates
        IF (SELECT COUNT(*) FROM (
            SELECT profile_id FROM public.subscriptions
            WHERE profile_id IS NOT NULL
            GROUP BY profile_id HAVING COUNT(*) > 1
        ) dupes) = 0 THEN
            ALTER TABLE public.subscriptions
                ADD CONSTRAINT subscriptions_profile_id_unique UNIQUE (profile_id);
        END IF;
    END IF;
END $$;

-- 1h. Drop restrictive tier CHECK constraint
--     The old constraint blocks new tier names like 'Pro', 'Enterprise', 'Growth', 'Free'
DO $$ BEGIN
    -- Drop ALL check constraints on the 'tier' column
    PERFORM 1 FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu
        ON cc.constraint_name = ccu.constraint_name
    WHERE ccu.table_schema = 'public'
      AND ccu.table_name = 'subscriptions'
      AND ccu.column_name = 'tier';

    IF FOUND THEN
        -- Get and drop the constraint dynamically
        EXECUTE (
            SELECT string_agg('ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS ' || quote_ident(cc.constraint_name), '; ')
            FROM information_schema.check_constraints cc
            JOIN information_schema.constraint_column_usage ccu
                ON cc.constraint_name = ccu.constraint_name
            WHERE ccu.table_schema = 'public'
              AND ccu.table_name = 'subscriptions'
              AND ccu.column_name = 'tier'
        );
    END IF;
END $$;

-- 1i. Drop restrictive status CHECK constraint too (needs 'Suspended', 'Terminated', 'Grace Period')
DO $$ BEGIN
    EXECUTE (
        SELECT COALESCE(
            string_agg('ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS ' || quote_ident(cc.constraint_name), '; '),
            'SELECT 1'
        )
        FROM information_schema.check_constraints cc
        JOIN information_schema.constraint_column_usage ccu
            ON cc.constraint_name = ccu.constraint_name
        WHERE ccu.table_schema = 'public'
          AND ccu.table_name = 'subscriptions'
          AND ccu.column_name = 'status'
    );
END $$;


-- ═══════════════════════════════════════════════════════════
-- 2. EVOLVE TRANSACTIONS TABLE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id),
    business_id UUID REFERENCES public.businesses(id),
    requested_tier TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='currency') THEN
        ALTER TABLE public.transactions ADD COLUMN currency TEXT DEFAULT 'LYD';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='gateway_reference') THEN
        ALTER TABLE public.transactions ADD COLUMN gateway_reference TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='exchange_rate') THEN
        ALTER TABLE public.transactions ADD COLUMN exchange_rate NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='duration') THEN
        ALTER TABLE public.transactions ADD COLUMN duration TEXT DEFAULT 'Month 1';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='screenshot_url') THEN
        ALTER TABLE public.transactions ADD COLUMN screenshot_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='payment_gateway') THEN
        ALTER TABLE public.transactions ADD COLUMN payment_gateway TEXT DEFAULT 'bank_transfer';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='proof_url') THEN
        ALTER TABLE public.transactions ADD COLUMN proof_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='rejection_reason') THEN
        ALTER TABLE public.transactions ADD COLUMN rejection_reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='confirmed_by') THEN
        ALTER TABLE public.transactions ADD COLUMN confirmed_by UUID REFERENCES public.profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='transactions'
                   AND column_name='updated_at') THEN
        ALTER TABLE public.transactions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Drop restrictive requested_tier CHECK constraint
DO $$ BEGIN
    EXECUTE (
        SELECT COALESCE(
            string_agg('ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS ' || quote_ident(cc.constraint_name), '; '),
            'SELECT 1'
        )
        FROM information_schema.check_constraints cc
        JOIN information_schema.constraint_column_usage ccu
            ON cc.constraint_name = ccu.constraint_name
        WHERE ccu.table_schema = 'public'
          AND ccu.table_name = 'transactions'
          AND ccu.column_name = 'requested_tier'
    );
END $$;

-- Drop restrictive status CHECK too (if it only allows old values)
DO $$ BEGIN
    EXECUTE (
        SELECT COALESCE(
            string_agg('ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS ' || quote_ident(cc.constraint_name), '; '),
            'SELECT 1'
        )
        FROM information_schema.check_constraints cc
        JOIN information_schema.constraint_column_usage ccu
            ON cc.constraint_name = ccu.constraint_name
        WHERE ccu.table_schema = 'public'
          AND ccu.table_name = 'transactions'
          AND ccu.column_name = 'status'
    );
END $$;


-- ═══════════════════════════════════════════════════════════
-- 3. RLS POLICIES (idempotent)
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

DROP POLICY IF EXISTS "txn_all_admin" ON public.transactions;
CREATE POLICY "txn_all_admin" ON public.transactions
    FOR ALL USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════
-- 4. PAYMENT AUDIT LOG TABLE
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

-- Evolve payment_audit_log: add missing columns if table already existed
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='payment_audit_log'
                   AND column_name='actor_id') THEN
        ALTER TABLE public.payment_audit_log ADD COLUMN actor_id UUID REFERENCES public.profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='payment_audit_log'
                   AND column_name='metadata') THEN
        ALTER TABLE public.payment_audit_log ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='payment_audit_log'
                   AND column_name='entity_type') THEN
        ALTER TABLE public.payment_audit_log ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'transaction';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='payment_audit_log'
                   AND column_name='entity_id') THEN
        ALTER TABLE public.payment_audit_log ADD COLUMN entity_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='payment_audit_log'
                   AND column_name='action') THEN
        ALTER TABLE public.payment_audit_log ADD COLUMN action TEXT NOT NULL DEFAULT 'unknown';
    END IF;
END $$;

ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pal_admin_all" ON public.payment_audit_log;
CREATE POLICY "pal_admin_all" ON public.payment_audit_log
    FOR ALL USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════
-- 5. DROP ALL EXISTING RPC OVERLOADS
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'admin_confirm_payment'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
    END LOOP;

    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'admin_reject_payment'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
    END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════
-- 6. ADMIN CONFIRM PAYMENT RPC
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
    v_duration_days INTEGER;
    v_duration_text TEXT;
BEGIN
    -- Admin gate
    IF NOT public.is_platform_admin() THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
    END IF;

    -- Fetch pending transaction
    SELECT * INTO v_txn FROM public.transactions WHERE id = p_txn_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_txn.status != 'pending' THEN
        RAISE EXCEPTION 'Transaction is not pending (status: %)', v_txn.status USING ERRCODE = 'P0003';
    END IF;

    -- Look up tier quotas (safe: table may not exist)
    BEGIN
        SELECT allocations INTO v_quotas
        FROM public.subscription_tiers
        WHERE LOWER(name) = LOWER(v_txn.requested_tier)
        LIMIT 1;
    EXCEPTION WHEN undefined_table THEN
        v_quotas := NULL;
    END;
    v_quotas := COALESCE(v_quotas, '{}'::jsonb);

    -- Parse duration: "Month 1" → 30, "Month 3" → 90, "30 Days" → 30
    v_duration_text := COALESCE(v_txn.duration, 'Month 1');
    v_duration_days := CASE
        WHEN v_duration_text ~* '(\d+)' THEN
            (regexp_match(v_duration_text, '(\d+)'))[1]::INTEGER * 30
        ELSE 30
    END;
    -- Clamp: if someone wrote "30 Days", don't multiply by 30
    IF v_duration_text ~* 'day' THEN
        v_duration_days := (regexp_match(v_duration_text, '(\d+)'))[1]::INTEGER;
    END IF;

    -- Mark transaction completed
    UPDATE public.transactions
    SET status = 'completed',
        confirmed_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_txn_id;

    -- Upsert subscription
    -- Uses profile_id if column exists, otherwise business_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='subscriptions' AND column_name='profile_id'
    ) THEN
        -- Profile-centric upsert (newer schema)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='subscriptions' AND column_name='quotas'
        ) THEN
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
        ELSE
            INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at)
            VALUES (v_txn.business_id, v_txn.owner_id, v_txn.requested_tier,
                    'Active', NOW() + (v_duration_days || ' days')::interval)
            ON CONFLICT (profile_id)
            DO UPDATE SET
                tier = EXCLUDED.tier,
                status = 'Active',
                expires_at = EXCLUDED.expires_at,
                business_id = EXCLUDED.business_id;
        END IF;
    ELSE
        -- Business-centric upsert (original schema)
        INSERT INTO public.subscriptions (business_id, tier, status, expires_at)
        VALUES (v_txn.business_id, v_txn.requested_tier,
                'Active', NOW() + (v_duration_days || ' days')::interval)
        ON CONFLICT (business_id)
        DO UPDATE SET
            tier = EXCLUDED.tier,
            status = 'Active',
            expires_at = EXCLUDED.expires_at;
    END IF;

    -- Audit log
    INSERT INTO public.payment_audit_log (entity_type, entity_id, action, actor_id, metadata)
    VALUES ('transaction', p_txn_id, 'confirmed', auth.uid(),
            jsonb_build_object(
                'tier', v_txn.requested_tier,
                'amount', v_txn.amount,
                'duration_days', v_duration_days,
                'merchant_id', v_txn.owner_id
            ));

    -- Notify merchant (safe: table may not exist)
    BEGIN
        INSERT INTO public.notifications (user_id, type, title, body)
        VALUES (v_txn.owner_id, 'payment_confirmed',
                'تمت الموافقة على طلب الترقية ✅',
                'تم تفعيل اشتراك ' || v_txn.requested_tier || ' لمدة ' || v_duration_days || ' يوم. مبروك!');
    EXCEPTION WHEN undefined_table THEN NULL;
              WHEN undefined_column THEN NULL;
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
-- 7. ADMIN REJECT PAYMENT RPC
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
        RAISE EXCEPTION 'Transaction is not pending (status: %)', v_txn.status USING ERRCODE = 'P0003';
    END IF;

    -- Reject the transaction
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
    EXCEPTION WHEN undefined_table THEN NULL;
              WHEN undefined_column THEN NULL;
    END;

    RETURN jsonb_build_object('success', true, 'txn_id', p_txn_id, 'reason', p_reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_payment(UUID, TEXT) TO authenticated;


-- ═══════════════════════════════════════════════════════════
-- 8. SCHEMA RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
