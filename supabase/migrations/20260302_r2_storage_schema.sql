-- ==========================================
-- Phase: Migrate from Supabase Storage to Cloudflare R2
-- 
-- The business_claims table currently has a document_url (TEXT) column
-- which previously pointed to a Supabase Storage path. 
-- We will now use this same column to store full R2 public URLs.
-- 
-- If any other tables (like users, businesses) adopt R2 uploads for
-- images, we can add tracking metadata here. This migration adds
-- standard media tracking columns to support R2 files effectively.
-- ==========================================

ALTER TABLE public.business_claims
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- In the future, if businesses gain public images (logos, covers), add them:
-- ALTER TABLE public.businesses
-- ADD COLUMN IF NOT EXISTS logo_url TEXT,
-- ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Same for user profile pictures:
-- ALTER TABLE public.profiles
-- ADD COLUMN IF NOT EXISTS avatar_url TEXT;
