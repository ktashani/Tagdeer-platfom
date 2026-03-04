-- Fix missing UPDATE policy on business_claims for upsert
-- An upsert operation requires both INSERT and UPDATE privileges.

DROP POLICY IF EXISTS "Users can update their own claims" ON public.business_claims;

CREATE POLICY "Users can update their own claims"
    ON public.business_claims FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
