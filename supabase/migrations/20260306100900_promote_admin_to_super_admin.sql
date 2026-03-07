-- This updates all users currently with role 'admin' (the original platform admins)
-- to 'super_admin', giving them full platform control including role management.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- The UPDATE statement is commented out because Postgres restricts using a newly added enum 
-- value in the SAME transaction. Since this is a fresh production DB with zero users, 
-- there are no existing 'admin' users to promote anyway.

-- UPDATE public.profiles
-- SET role = 'super_admin'
-- WHERE role = 'admin';
