-- ==========================================
-- Phase 4: Threat Model & Security Fixes
-- ==========================================

-- 1. Receipt Replay Protection
-- Add a file_hash column to prevent the exact same receipt image from being reused
ALTER TABLE public.logs
ADD COLUMN IF NOT EXISTS file_hash TEXT UNIQUE;

-- 2. Strict RLS Enforcement for Logs (IDOR Prevention)
-- We previously allowed any authenticated user to insert logs with any profile_id
-- We must enforce that they can only insert logs for their own profile_id

DROP POLICY IF EXISTS "auth_insert_logs" ON public.logs;

CREATE POLICY "auth_insert_logs"
    ON public.logs FOR INSERT TO authenticated
    WITH CHECK (profile_id = auth.uid());

-- Also ensure updates are restricted (though updates might not be allowed anyway)
DROP POLICY IF EXISTS "auth_update_own_logs" ON public.logs;

CREATE POLICY "auth_update_own_logs"
    ON public.logs FOR UPDATE TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- Ensure the same for verified_users and business_claims if missing
DROP POLICY IF EXISTS "Allow authenticated users to insert interactions" ON public.interactions;
CREATE POLICY "Allow authenticated users to insert own interactions"
    ON public.interactions FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());
