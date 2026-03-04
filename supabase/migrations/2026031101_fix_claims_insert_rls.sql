-- Fix missing INSERT policy on business_claims
-- The v2_portals_schema migration recreated the table/policies but missed the INSERT policy.

DROP POLICY IF EXISTS "Users can insert their own claims" ON public.business_claims;
CREATE POLICY "Users can insert their own claims"
    ON public.business_claims FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Also ensure admins can view all claims (in case it was missing)
DROP POLICY IF EXISTS "Admins can view all claims" ON public.business_claims;
CREATE POLICY "Admins can view all claims"
    ON public.business_claims FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );
