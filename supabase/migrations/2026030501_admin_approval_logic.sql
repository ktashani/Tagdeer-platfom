-- ==========================================
-- Admin Business Claim Resolution RPC (Updated)
-- ==========================================

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

    -- If approved, perform side effects: 
    -- 1. Bind business to user
    -- 2. Publish the business
    -- 3. Elevate user role to merchant
    IF p_status = 'approved' THEN
        -- 1 & 2. Update business
        UPDATE public.businesses 
        SET 
            claimed_by = v_user_id,
            status = 'published',
            updated_at = now()
        WHERE id = v_business_id;

        -- 3. Update user profile role
        UPDATE public.profiles
        SET 
            role = 'merchant',
            updated_at = now()
        WHERE id = v_user_id;
    END IF;

END;
$$;
