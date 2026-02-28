-- ==========================================
-- Admin Business Claim Resolution RPC
-- ==========================================

DO $$
BEGIN
    ALTER TABLE public.business_claims DROP CONSTRAINT IF EXISTS business_claims_status_check;
    ALTER TABLE public.business_claims ADD CONSTRAINT business_claims_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'missing_docs'));
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

CREATE OR REPLACE FUNCTION admin_resolve_claim(p_claim_id UUID, p_status TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_user_id UUID;
BEGIN
    -- Ensure the caller is an admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can resolve claims';
    END IF;

    -- Update the claim status
    UPDATE public.business_claims 
    SET status = p_status, updated_at = now() 
    WHERE id = p_claim_id
    RETURNING business_id, user_id INTO v_business_id, v_user_id;

    -- If approved, bind the business to the user
    IF p_status = 'approved' THEN
        UPDATE public.businesses 
        SET claimed_by = v_user_id 
        WHERE id = v_business_id;
    END IF;

END;
$$;
