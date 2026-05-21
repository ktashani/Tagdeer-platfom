-- ============================================================
-- Migration: Align Local RLS Policies
-- Branch: refactor-nextjs-phase2
--
-- Enables RLS on coupon_audit_log and otp_verifications for
-- alignment with production, and adds the Admin read policy.
-- ============================================================

-- Enable Row Level Security on both tables
ALTER TABLE public.coupon_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Drop the policy if it already exists
DROP POLICY IF EXISTS "Admins can read coupon audit" ON public.coupon_audit_log;

-- Recreate the "Admins can read coupon audit" policy to match production
CREATE POLICY "Admins can read coupon audit" ON public.coupon_audit_log
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['super_admin'::user_role, 'admin'::user_role])
        )
    );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
