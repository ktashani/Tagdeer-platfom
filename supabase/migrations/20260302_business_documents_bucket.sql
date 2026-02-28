-- Set up Storage Bucket for secure business registration documents
-- Requires the "storage" schema

-- 1. Create 'business_documents' bucket (Private, only for system and admins/owners)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('business_documents', 'business_documents', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET 
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- 2. RLS Policies
-- Merchants can upload their own verification documents, prefixing with their auth UID
CREATE POLICY "Merchants can upload business documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'business_documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can read their own documents
CREATE POLICY "Users can read own business documents" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'business_documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Note: Admins can be granted access via a separate admin-only policy if their role is enforced securely in Postgres,
-- but typically the service_role key handles admin reads on the backend if not using an admin role in DB directly.

ALTER TABLE public.business_claims 
ADD COLUMN IF NOT EXISTS document_url TEXT;
