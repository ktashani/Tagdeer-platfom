-- Migration: Promote current admin to super_admin
-- This updates all users currently with role 'admin' (the original platform admins)
-- to 'super_admin', giving them full platform control including role management.

UPDATE public.profiles
SET role = 'super_admin'
WHERE role = 'admin';
