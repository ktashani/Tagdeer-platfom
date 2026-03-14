-- =========================================================================
-- Migration: 20260315_subscription_tiers_table.sql
-- Purpose: Create a proper relational table for subscription tiers,
--          migrate data from platform_config JSON, and enforce uniqueness.
-- Branch: feat/dynamic-pricing-sync
-- =========================================================================

-- 1. Create the subscription_tiers table
CREATE TABLE IF NOT EXISTS public.subscription_tiers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    name_ar     TEXT,
    description TEXT,
    description_ar TEXT,
    price       INTEGER NOT NULL DEFAULT 0,
    duration    TEXT NOT NULL DEFAULT 'monthly',
    features    JSONB NOT NULL DEFAULT '[]'::jsonb,
    features_ar JSONB NOT NULL DEFAULT '[]'::jsonb,
    allocations JSONB NOT NULL DEFAULT '{"max_locations":1,"max_shields":0,"max_campaigns":0,"max_storefronts":0,"gader_points":5}'::jsonb,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    is_popular  BOOLEAN NOT NULL DEFAULT false,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Migrate existing data from platform_config JSON blob
-- Uses DISTINCT ON to automatically deduplicate by id (fixes the 'free' duplication)
INSERT INTO public.subscription_tiers (
    id, name, name_ar, description, description_ar,
    price, duration, features, features_ar, allocations,
    is_active, is_popular, sort_order
)
SELECT
    elem->>'id',
    elem->>'name',
    elem->>'name_ar',
    elem->>'description',
    elem->>'description_ar',
    COALESCE((elem->>'price')::integer, 0),
    COALESCE(elem->>'duration', 'monthly'),
    COALESCE(elem->'features', '[]'::jsonb),
    COALESCE(elem->'features_ar', '[]'::jsonb),
    COALESCE(elem->'allocations', '{"max_locations":1,"max_shields":0,"max_campaigns":0,"max_storefronts":0,"gader_points":5}'::jsonb),
    COALESCE((elem->>'isActive')::boolean, true),
    COALESCE((elem->>'isPopular')::boolean, false),
    rn
FROM (
    SELECT DISTINCT ON (elem->>'id') elem, ROW_NUMBER() OVER () as rn
    FROM platform_config,
    jsonb_array_elements(value) AS elem
    WHERE key = 'tier_pricing'
    ORDER BY elem->>'id' ASC
) deduped
ON CONFLICT (id) DO NOTHING;

-- 3. RLS Policies
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can read tiers (needed for pricing page, onboarding, merchant settings)
DROP POLICY IF EXISTS "Public read access to tiers" ON public.subscription_tiers;
CREATE POLICY "Public read access to tiers"
    ON public.subscription_tiers FOR SELECT
    USING (true);

-- Only admins can modify tiers
DROP POLICY IF EXISTS "Admins can manage tiers" ON public.subscription_tiers;
CREATE POLICY "Admins can manage tiers"
    ON public.subscription_tiers FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'admin')
        )
    );

-- 4. Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_tier_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tier_updated_at ON public.subscription_tiers;
CREATE TRIGGER trg_tier_updated_at
    BEFORE UPDATE ON public.subscription_tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_tier_timestamp();
