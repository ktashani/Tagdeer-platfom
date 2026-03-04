-- ==========================================
-- CONSOLIDATED ADMIN RPCs & PERMISSIONS FIX
-- Created: 2026-03-09
-- Purpose: Fix "Could not find function" errors by adding explicit grants
-- ==========================================

-- 1. admin_update_user_status (Consolidated with Ban Cascade logic)
DROP FUNCTION IF EXISTS admin_update_user_status(UUID, TEXT, TEXT);
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
GRANT EXECUTE ON FUNCTION admin_update_user_status(UUID, TEXT, TEXT) TO authenticated, service_role;


-- 2. admin_manage_user_gader
DROP FUNCTION IF EXISTS admin_manage_user_gader(UUID, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION admin_manage_user_gader(p_user_id UUID, p_amount NUMERIC, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Update User Profile
    UPDATE public.profiles 
    SET gader_points = GREATEST(gader_points + p_amount, 0)
    WHERE id = p_user_id;

    -- Audit log placeholder (can be expanded)
END;
$$;
GRANT EXECUTE ON FUNCTION admin_manage_user_gader(UUID, NUMERIC, TEXT) TO authenticated, service_role;


-- 3. admin_purge_user
DROP FUNCTION IF EXISTS admin_purge_user(UUID);
CREATE OR REPLACE FUNCTION admin_purge_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Delete all community interactions (logs)
    DELETE FROM public.interactions WHERE created_by = p_user_id;
    DELETE FROM public.logs WHERE profile_id = p_user_id;

    -- Delete all votes
    DELETE FROM public.log_votes WHERE profile_id = p_user_id;

    -- Reset Trust Points to 0
    UPDATE public.profiles 
    SET gader_points = 0 
    WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_purge_user(UUID) TO authenticated, service_role;


-- 4. admin_update_user_info
DROP FUNCTION IF EXISTS admin_update_user_info(UUID, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION admin_update_user_info(p_user_id UUID, p_full_name TEXT, p_email TEXT, p_phone TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    UPDATE public.profiles 
    SET full_name = p_full_name,
        email = p_email,
        phone = p_phone
    WHERE id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_update_user_info(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
