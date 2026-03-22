-- ============================================================
-- Hotfix: Transactions RLS — include super_admin
-- Root cause: admin user has role 'super_admin' but the
-- transactions RLS policy only checks role = 'admin'.
-- This silently hides ALL pending upgrade requests from the
-- Admin Financials Transfer Queue.
-- ============================================================

-- 1. Drop and recreate the admin policy on transactions
DROP POLICY IF EXISTS "Admins have full access to transactions" ON public.transactions;
CREATE POLICY "Admins have full access to transactions"
    ON public.transactions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

-- 2. Also fix the requested_tier CHECK constraint.
--    The original constraint only allows ('Tier 1', 'Tier 2')
--    but merchants now submit dynamic tier names like 'Pro', 'Enterprise', etc.
--    Drop old constraint and add a permissive one.
DO $$
DECLARE
    const_name text;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%requested_tier%';

    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.transactions DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- No constraint needed — tier names are now dynamic from subscription_tiers table.

-- 3. Audit: Also fix payment_audit_log admin policy if it only checks 'admin'
DROP POLICY IF EXISTS "Admins can read audit log" ON public.payment_audit_log;
CREATE POLICY "Admins can read audit log"
    ON public.payment_audit_log FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );

DROP POLICY IF EXISTS "Admins can insert audit log" ON public.payment_audit_log;
CREATE POLICY "Admins can insert audit log"
    ON public.payment_audit_log FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
    );
