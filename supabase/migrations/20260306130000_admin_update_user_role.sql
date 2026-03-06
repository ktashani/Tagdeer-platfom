-- Migration: Admin Update User Role
-- Description: Allows an admin or super_admin to change the role of another user

CREATE OR REPLACE FUNCTION admin_update_user_role(p_user_id UUID, p_new_role TEXT)
RETURNS JSONB AS $$
DECLARE
    v_caller_role TEXT;
BEGIN
    -- Get caller's role
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    
    -- Only admin or super_admin can change roles
    IF v_caller_role NOT IN ('admin', 'super_admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions to modify roles');
    END IF;

    -- Prevent self-demotion
    IF p_user_id = auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot modify your own role from this interface');
    END IF;

    -- Standard admins cannot promote to super_admin
    IF v_caller_role = 'admin' AND p_new_role = 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only Super Admins can promote someone to Super Admin');
    END IF;

    -- Validate role value
    IF p_new_role NOT IN ('user', 'merchant', 'admin', 'super_admin', 'assistant_admin', 'support_agent') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid role: ' || p_new_role);
    END IF;

    -- Update the role
    UPDATE public.profiles SET role = p_new_role WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Role updated to ' || p_new_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
