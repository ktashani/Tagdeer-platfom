-- Migration to add status column to profiles table
-- Created: 2026-03-07

-- 1. Add status column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Restricted', 'Banned'));

-- 2. Update existing profiles to have 'Active' status if they are null
UPDATE public.profiles SET status = 'Active' WHERE status IS NULL;
