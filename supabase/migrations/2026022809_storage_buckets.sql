-- Set up Storage Buckets for Images and Receipts
-- Requires the "storage" schema to be available in Supabase

-- 1. Create 'receipts' bucket (Private, only for users and admins)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET 
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- 2. Create 'avatars' bucket (Public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 3. Create 'businesses' bucket (Public logos/headers)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('businesses', 'businesses', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];


-- ==========================================
-- RLS Policies for receipts
-- ==========================================
-- Users can upload their own receipts
CREATE POLICY "Users can upload receipts" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can read their own receipts
CREATE POLICY "Users can read own receipts" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Specific Admins or specific merchants can read receipts (simplified for MVP: allow merchants to view receipts linked to their business disputes)
-- In a real setup, this would join with the disputes table to check access.

-- ==========================================
-- RLS Policies for avatars
-- ==========================================
CREATE POLICY "Public avatars are viewable by everyone" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ==========================================
-- RLS Policies for businesses
-- ==========================================
CREATE POLICY "Public businesses images are viewable by everyone" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'businesses');

CREATE POLICY "Merchants can upload their business images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'businesses' AND 
  EXISTS (
    SELECT 1 FROM public.businesses b 
    WHERE b.id::text = (storage.foldername(name))[1] AND b.claimed_by = auth.uid()
  )
);
