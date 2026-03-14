-- Add status column to businesses table for Admin Management
-- Created: 2026-03-05

-- Allow statuses: published, restricted, hidden
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published' CHECK (status IN ('published', 'restricted', 'hidden'));

-- Backfill existing businesses just in case
UPDATE businesses SET status = 'published' WHERE status IS NULL;
