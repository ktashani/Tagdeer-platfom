-- ============================================================
-- Business Contact Details Columns
-- Required by: Discover contact icons, merchant contact editing,
--              admin business detail view
-- ============================================================
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp TEXT,
    ADD COLUMN IF NOT EXISTS instagram TEXT,
    ADD COLUMN IF NOT EXISTS facebook TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

-- Verify:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'businesses' AND column_name IN
-- ('description','phone','whatsapp','instagram','facebook','website','google_maps_url');
