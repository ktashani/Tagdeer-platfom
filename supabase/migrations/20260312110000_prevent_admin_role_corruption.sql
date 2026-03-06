-- ==========================================
-- Prevent admin role demotion via profile update
-- Safety net: even if frontend guards are bypassed, the DB blocks
-- any attempt to demote an admin-level role to a non-admin role.
-- Allows lateral moves between admin roles (e.g. admin -> super_admin).
-- ==========================================

CREATE OR REPLACE FUNCTION prevent_admin_role_demotion()
RETURNS TRIGGER AS $$
DECLARE
    admin_roles TEXT[] := ARRAY['super_admin', 'admin', 'assistant_admin', 'support_agent'];
BEGIN
    -- Block demotion: if old role was admin-level and new role is NOT admin-level
    IF OLD.role = ANY(admin_roles) AND NOT (NEW.role = ANY(admin_roles)) THEN
        RAISE EXCEPTION 'Cannot demote admin role via profile update';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guard_admin_role ON public.profiles;
CREATE TRIGGER guard_admin_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_admin_role_demotion();
