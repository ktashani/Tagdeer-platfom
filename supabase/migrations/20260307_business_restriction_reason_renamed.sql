-- Add restriction reason and pending_review status
-- Created: 2026-03-06

-- 0. Ensure status column exists (fallback)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';

-- 1. Drop existing check constraint and add the new one allowing 'pending_review'
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_status_check;
ALTER TABLE businesses ADD CONSTRAINT businesses_status_check CHECK (status IN ('published', 'restricted', 'hidden', 'pending_review'));

-- 2. Add the restriction_reason column
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS restriction_reason TEXT;
