-- Migration: Update User Roles
-- Description: Add super_admin and assistent roles to the user_role enum

DO $$ 
BEGIN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'assistant_admin';
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'support_agent';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
