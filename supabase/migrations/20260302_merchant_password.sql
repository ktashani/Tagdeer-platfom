-- ==========================================
-- Phase: Merchant Password Auth
-- Adds has_password flag to profiles so the
-- login UI knows whether to show password or OTP form.
-- Actual password hashing is handled by Supabase Auth.
-- ==========================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_password BOOLEAN DEFAULT false;
