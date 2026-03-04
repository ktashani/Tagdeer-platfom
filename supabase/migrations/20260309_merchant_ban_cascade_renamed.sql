-- ==========================================
-- Merchant Ban Cascade & Updated User Status RPC
-- When a merchant is banned/restricted, cascade to their businesses
-- ==========================================

-- Replace the existing admin_update_user_status function
-- to cascade status changes to merchant-owned businesses
CREATE OR REPLACE FUNCTION admin_update_user_status(p_user_id UUID, p_role TEXT, p_status TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Update user profile status
    UPDATE public.profiles 
    SET role = p_role::public.user_role,
        status = p_status
    WHERE id = p_user_id;

    -- Cascade to merchant businesses if the user owns any
    IF p_status = 'Banned' THEN
        -- Banned merchants: hide all their businesses
        UPDATE public.businesses
        SET status = 'hidden'
        WHERE claimed_by = p_user_id;
    ELSIF p_status = 'Restricted' THEN
        -- Restricted merchants: restrict all their businesses
        UPDATE public.businesses
        SET status = 'restricted',
            restriction_reason = 'Owner account restricted by admin'
        WHERE claimed_by = p_user_id;
    ELSIF p_status = 'Active' THEN
        -- Reactivated merchants: set businesses to pending_review (not auto-published)
        UPDATE public.businesses
        SET status = 'pending_review',
            restriction_reason = NULL
        WHERE claimed_by = p_user_id
          AND status IN ('hidden', 'restricted');
    END IF;
END;
$$;
