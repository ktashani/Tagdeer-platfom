-- Migration: Storefront Overhaul v3
-- Extends catalog_items with SKU, ordering, reaction counts
-- Creates catalog_reactions table for fingerprint-based like/dislike

-- 1. Extend catalog_items
ALTER TABLE public.catalog_items
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0;

-- 2. Catalog reaction tracking (1 reaction per device per product)
CREATE TABLE IF NOT EXISTS public.catalog_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
    fingerprint TEXT NOT NULL,
    reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(item_id, fingerprint)
);

-- 3. RLS
ALTER TABLE public.catalog_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert reactions"
    ON public.catalog_reactions FOR INSERT
    TO PUBLIC
    WITH CHECK (true);

CREATE POLICY "Allow public read reactions"
    ON public.catalog_reactions FOR SELECT
    TO PUBLIC
    USING (true);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_catalog_reactions_item ON public.catalog_reactions(item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_display_order ON public.catalog_items(display_order);

-- 5. Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload_schema';
