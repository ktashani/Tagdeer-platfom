-- Migration: Feature Allocations Write Access
-- Description: Adds missing INSERT and UPDATE RLS policies for merchants to manage their quotas.

-- Merchants can insert allocations for themselves
CREATE POLICY "Merchants can insert own feature allocations"
ON public.feature_allocations FOR INSERT
WITH CHECK (auth.uid() = profile_id);

-- Merchants can update their own allocations (e.g., set status to 'revoked')
CREATE POLICY "Merchants can update own feature allocations"
ON public.feature_allocations FOR UPDATE
USING (auth.uid() = profile_id)
WITH CHECK (auth.uid() = profile_id);
