-- ==========================================
-- Admin Business Merge RPC
-- ==========================================

CREATE OR REPLACE FUNCTION admin_merge_businesses(master_uuid UUID, duplicate_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure the caller is an admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can merge businesses';
    END IF;

    -- Transfer all interactions (logs, reviews, complaints)
    UPDATE public.interactions 
    SET business_id = master_uuid 
    WHERE business_id = duplicate_uuid;

    -- Transfer any business claims
    UPDATE public.business_claims 
    SET business_id = master_uuid 
    WHERE business_id = duplicate_uuid;

    -- Finally, delete the duplicate business profile
    DELETE FROM public.businesses 
    WHERE id = duplicate_uuid;

END;
$$;

-- Grant permissions for RPC calls
GRANT EXECUTE ON FUNCTION public.admin_merge_businesses(UUID, UUID) TO anon, authenticated;
