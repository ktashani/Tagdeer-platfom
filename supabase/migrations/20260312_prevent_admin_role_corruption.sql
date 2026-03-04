-- ==========================================
-- Prevent admin role demotion via profile update
-- Safety net: even if frontend guards are bypassed, the DB blocks
-- any attempt to overwrite an admin's role to merchant/user.
-- ==========================================

CREATE OR REPLACE FUNCTION prevent_admin_role_demotion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role = 'admin' AND NEW.role != 'admin' THEN
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
