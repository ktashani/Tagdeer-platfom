-- ============================================================
-- Migration: V2 RBAC Foundation
-- Task: W1-1 from Cross-Functional Accountability Matrix
-- Branch: feature/v2-subdomain-portals
--
-- Database State (verified via live Supabase query 2026-03-25):
--   ✅ All 25 tables exist (profiles, businesses, campaigns, etc.)
--   ✅ user_role ENUM exists with: user, merchant, admin, super_admin
--   ❌ assistant_admin and support_agent NOT in ENUM yet
--   ❌ is_platform_admin() does NOT exist
--   ❌ is_merchant() does NOT exist
--   Distinct roles in use: user, merchant, super_admin
--
-- Security Model:
--   Helper functions are SECURITY DEFINER + STABLE:
--   - Execute as function OWNER (bypasses RLS for role lookup)
--   - STABLE = result cached within a single SQL statement
--   - search_path = '' prevents schema injection (CWE-1321)
--
-- ⚠️  DOES NOT TOUCH profiles or logs RLS policies.
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- 1. EXPAND THE ROLE ENUM
--    Add assistant_admin and support_agent.
--    super_admin already exists — guarded by IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'super_admin' AND enumtypid = 'public.user_role'::regtype) THEN
        ALTER TYPE public.user_role ADD VALUE 'super_admin';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'assistant_admin' AND enumtypid = 'public.user_role'::regtype) THEN
        ALTER TYPE public.user_role ADD VALUE 'assistant_admin';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'support_agent' AND enumtypid = 'public.user_role'::regtype) THEN
        ALTER TYPE public.user_role ADD VALUE 'support_agent';
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- 2. HELPER FUNCTION: is_platform_admin()
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('super_admin', 'admin', 'assistant_admin', 'support_agent')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon;

COMMENT ON FUNCTION public.is_platform_admin() IS
    'Central admin gate. Returns TRUE for super_admin, admin, assistant_admin, support_agent.';


-- ═══════════════════════════════════════════════════════════
-- 3. HELPER FUNCTION: is_merchant()
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_merchant()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'merchant'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_merchant() TO authenticated, anon;

COMMENT ON FUNCTION public.is_merchant() IS
    'Merchant portal gate. Returns TRUE if authenticated user has the merchant role.';


-- ═══════════════════════════════════════════════════════════
-- 4. HELPER FUNCTION: is_own_profile(profile_id)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_own_profile(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() = p_profile_id;
$$;

GRANT EXECUTE ON FUNCTION public.is_own_profile(UUID) TO authenticated, anon;


-- ═══════════════════════════════════════════════════════════
-- 5. RE-DRAFT RLS: business_claims
--    Tables confirmed to exist on live Supabase.
-- ═══════════════════════════════════════════════════════════

-- Drop ALL old policies (from both 20260222_schema.sql and 20260227_v2_portals_schema.sql)
DROP POLICY IF EXISTS "Users can view their own claims" ON public.business_claims;
DROP POLICY IF EXISTS "Admins can view all claims" ON public.business_claims;
DROP POLICY IF EXISTS "Allow users to read their own claims" ON public.business_claims;
DROP POLICY IF EXISTS "Allow users to insert their own claims" ON public.business_claims;

-- Merchants: view their own claims
CREATE POLICY "claim_select_own"
    ON public.business_claims FOR SELECT
    USING (auth.uid() = user_id);

-- Merchants: submit new claims
CREATE POLICY "claim_insert_own"
    ON public.business_claims FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins: view all claims (approval queue)
CREATE POLICY "claim_select_admin"
    ON public.business_claims FOR SELECT
    USING (public.is_platform_admin());

-- Admins: approve/reject claims
CREATE POLICY "claim_update_admin"
    ON public.business_claims FOR UPDATE
    USING (public.is_platform_admin());

-- Admins: delete claims (cleanup)
CREATE POLICY "claim_delete_admin"
    ON public.business_claims FOR DELETE
    USING (public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════
-- 6. RE-DRAFT RLS: campaigns
--    Guarded: campaigns table may not exist on all environments.
--    Using EXECUTE inside DO block to avoid 42P01 on missing tables.
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'campaigns'
    ) THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins have full access to campaigns" ON public.campaigns';
        EXECUTE 'DROP POLICY IF EXISTS "Merchants and users can view active campaigns" ON public.campaigns';

        EXECUTE '
            CREATE POLICY "campaign_all_admin"
                ON public.campaigns FOR ALL
                USING (public.is_platform_admin())
        ';

        EXECUTE '
            CREATE POLICY "campaign_select_active"
                ON public.campaigns FOR SELECT
                USING (status = ''active'')
        ';

        RAISE NOTICE 'campaigns RLS policies re-drafted with is_platform_admin()';
    ELSE
        RAISE NOTICE 'campaigns table does not exist — skipping policy draft';
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- 7. ROLE CORRUPTION GUARD TRIGGER
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    caller_role public.user_role;
BEGIN
    IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
        RETURN NEW;
    END IF;

    SELECT role INTO caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF caller_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Only super_admin can change user roles. Current role: %', caller_role;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_role_change ON public.profiles;
CREATE TRIGGER trg_guard_role_change
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_role_change();


-- ═══════════════════════════════════════════════════════════
-- 8. PARTIAL INDEXES FOR ROLE LOOKUPS
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_profiles_admin_roles
    ON public.profiles (id)
    WHERE role IN ('super_admin', 'admin', 'assistant_admin', 'support_agent');

CREATE INDEX IF NOT EXISTS idx_profiles_merchant_role
    ON public.profiles (id)
    WHERE role = 'merchant';


-- ═══════════════════════════════════════════════════════════
-- 9. SCHEMA CACHE RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
