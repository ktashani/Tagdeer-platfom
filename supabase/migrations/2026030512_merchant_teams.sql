-- ===================================================================
-- Phase 3.6: Merchant Team Management
-- Creates business_team_members table for Pro/Enterprise merchants
-- ===================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.business_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('manager', 'cashier')),
    invited_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, profile_id)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_team_business ON public.business_team_members(business_id);
CREATE INDEX IF NOT EXISTS idx_team_profile ON public.business_team_members(profile_id);

-- 3. RLS
ALTER TABLE public.business_team_members ENABLE ROW LEVEL SECURITY;

-- Business owners can see and manage their team
DROP POLICY IF EXISTS "Owners manage team" ON public.business_team_members;
CREATE POLICY "Owners manage team"
    ON public.business_team_members
    FOR ALL
    TO authenticated
    USING (
        business_id IN (
            SELECT id FROM public.businesses WHERE claimed_by = auth.uid()
        )
    )
    WITH CHECK (
        business_id IN (
            SELECT id FROM public.businesses WHERE claimed_by = auth.uid()
        )
    );

-- Team members can view their own membership
DROP POLICY IF EXISTS "Members see own membership" ON public.business_team_members;
CREATE POLICY "Members see own membership"
    ON public.business_team_members
    FOR SELECT
    TO authenticated
    USING (profile_id = auth.uid());

-- 4. Helper function: check if user is owner or team member of a business
CREATE OR REPLACE FUNCTION public.is_business_team_member(p_user_id UUID, p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.businesses
        WHERE id = p_business_id AND claimed_by = p_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.business_team_members
        WHERE business_id = p_business_id AND profile_id = p_user_id
    );
END;
$$;
