-- ==========================================
-- Admin User Management RPCs
-- ==========================================

-- 1. Adjust User Gader (Trust Points)
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
    SET gader = GREATEST(gader + p_amount, 0)
    WHERE id = p_user_id;

    -- Note: In a production system, we would also insert an audit log here to record p_reason.
    -- INSERT INTO admin_audit_logs (admin_id, target_user, amount, reason) VALUES (...)
END;
$$;


-- 2. Purge User Data (Anti-Cheat Action)
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
    DELETE FROM public.interactions WHERE profile_id = p_user_id;

    -- Delete all votes
    DELETE FROM public.log_votes WHERE user_id = p_user_id;

    -- Reset Trust Points to 0
    UPDATE public.profiles 
    SET gader = 0 
    WHERE id = p_user_id;
END;
$$;
