-- ============================================================
-- Migration: Fix Subscription RLS & Admin Confirm Target
-- Addresses GAP 1 and GAP 3 of Tier Upgrade Workflow Specs
-- ============================================================

-- ------------------------------------------------------------
-- GAP 1: Subscription RLS Policy (Critical)
-- The system uses profile-centric subscriptions (profile_id).
-- ------------------------------------------------------------

-- 1. Drop the old business-centric SELECT policy
DROP POLICY IF EXISTS "Merchants can view their subscriptions" ON public.subscriptions;

-- 2. Create a profile-centric SELECT policy
CREATE POLICY "Merchants can view their subscriptions"
    ON public.subscriptions FOR SELECT
    USING (profile_id = auth.uid());

-- 3. Add UPDATE policy so merchants can update their own subscription
--    (needed for client-side expiry fallback)
DROP POLICY IF EXISTS "Merchants can update their subscriptions" ON public.subscriptions;
CREATE POLICY "Merchants can update their subscriptions"
    ON public.subscriptions FOR UPDATE
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- 4. Add INSERT policy so the freebie tier upsert works
DROP POLICY IF EXISTS "Merchants can insert their subscriptions" ON public.subscriptions;
CREATE POLICY "Merchants can insert their subscriptions"
    ON public.subscriptions FOR INSERT
    WITH CHECK (profile_id = auth.uid());

-- 5. Ensure admin full access also includes super_admin
DROP POLICY IF EXISTS "Admins have full access to subscriptions" ON public.subscriptions;
CREATE POLICY "Admins have full access to subscriptions"
    ON public.subscriptions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );


-- ------------------------------------------------------------
-- GAP 3: admin_confirm_payment RPC Conflict Target (Critical)
-- Uses ON CONFLICT (profile_id) instead of (business_id)
-- ------------------------------------------------------------

-- Drop the old UNIQUE(business_id) constraint on subscriptions if it exists.
-- The system is now profile-centric: UNIQUE(profile_id) is the canonical key.
ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_business_id_key;

-- Re-create admin_confirm_payment with correct conflict target
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

    UPDATE public.transactions
    SET status = 'completed',
        confirmed_by = v_admin_id,
        confirmed_at = NOW()
    WHERE id = p_txn_id;

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
        -- FIXED: ON CONFLICT (profile_id) instead of (business_id)
        INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at)
        VALUES (v_business_id, v_owner_id, v_tier, 'Active', now() + (v_days || ' days')::interval)
        ON CONFLICT (profile_id)
        DO UPDATE SET
            tier = EXCLUDED.tier,
            status = 'Active',
            expires_at = EXCLUDED.expires_at,
            business_id = EXCLUDED.business_id;

        INSERT INTO public.payment_audit_log (entity_type, entity_id, action, new_status, performed_by, metadata)
        VALUES (
            'subscription', v_business_id, 'activated', 'Active', v_admin_id,
            jsonb_build_object('tier', v_tier, 'days', v_days, 'source_txn', p_txn_id)
        );
    END IF;
END;
$$;
