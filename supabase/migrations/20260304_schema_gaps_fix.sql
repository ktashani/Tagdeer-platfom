-- Migration to fix gaps in schema where changes were manually added to older files
-- This ensures that remote databases get these updates via 'supabase db push'

-- Fix businesses table gaps
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Manual';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_shielded BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES auth.users(id);

-- Fix interactions table gaps
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Fix verified_users table gaps
ALTER TABLE verified_users ADD COLUMN IF NOT EXISTS is_business_owner BOOLEAN DEFAULT FALSE;
