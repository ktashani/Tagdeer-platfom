-- Migration: Microsite Engine & Storefronts
-- Description: Creates the 1:1 storefronts extension table, the catalog_items table, and sets their respective RLS policies and trigger functions.

-- 1. Storefronts Table
CREATE TABLE public.storefronts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    theme_config JSONB DEFAULT '{"primaryColor": "#10b981", "secondaryColor": "#0f172a"}'::jsonb,
    seo_metadata JSONB DEFAULT '{"title": "", "description": ""}'::jsonb,
    contact_overrides JSONB DEFAULT '{"phone": "", "email": "", "facebook": "", "instagram": "", "website": ""}'::jsonb,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'suspended')),
    logo_url TEXT,
    banner_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Catalog Items Table
CREATE TABLE public.catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storefront_id UUID NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
    category TEXT DEFAULT 'General',
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2),
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_storefronts_slug ON public.storefronts(slug);
CREATE INDEX idx_storefronts_status ON public.storefronts(status);
CREATE INDEX idx_catalog_items_storefront_id ON public.catalog_items(storefront_id);

-- Enable RLS
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at trigger for storefronts
CREATE TRIGGER update_storefronts_updated_at
    BEFORE UPDATE ON public.storefronts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at trigger for catalog_items
CREATE TRIGGER update_catalog_items_updated_at
    BEFORE UPDATE ON public.catalog_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- RLS Policies: Storefronts
-- ===============================================
-- Public can read Published storefronts
CREATE POLICY "Allow public read of published storefronts"
    ON public.storefronts FOR SELECT
    TO PUBLIC
    USING (status = 'published');

-- Admins can read all storefronts
CREATE POLICY "Allow admins full read to storefronts"
    ON public.storefronts FOR SELECT
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'admin', 'assistant_admin', 'support_agent')));

-- Merchants can read their own storefronts
CREATE POLICY "Allow merchants to read their own storefronts"
    ON public.storefronts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM businesses 
            WHERE businesses.id = storefronts.business_id AND businesses.claimed_by = auth.uid()
        )
    );

-- Merchants can insert their own storefronts
CREATE POLICY "Allow merchants to insert their own storefronts"
    ON public.storefronts FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM businesses 
            WHERE businesses.id = business_id AND businesses.claimed_by = auth.uid()
        )
    );

-- Merchants can update their own storefronts
CREATE POLICY "Allow merchants to update their own storefronts"
    ON public.storefronts FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM businesses 
            WHERE businesses.id = storefronts.business_id AND businesses.claimed_by = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM businesses 
            WHERE businesses.id = storefronts.business_id AND businesses.claimed_by = auth.uid()
        )
    );

-- ===============================================
-- RLS Policies: Catalog Items
-- ===============================================
-- Public can read active items on published storefronts
CREATE POLICY "Allow public read of active catalog items"
    ON public.catalog_items FOR SELECT
    TO PUBLIC
    USING (
        is_active = true AND
        EXISTS (SELECT 1 FROM storefronts WHERE storefronts.id = catalog_items.storefront_id AND storefronts.status = 'published')
    );

-- Merchants can manage their catalog items
CREATE POLICY "Allow merchants to manage their catalog items"
    ON public.catalog_items FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM storefronts
            JOIN businesses ON businesses.id = storefronts.business_id
            WHERE storefronts.id = catalog_items.storefront_id AND businesses.claimed_by = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM storefronts
            JOIN businesses ON businesses.id = storefronts.business_id
            WHERE storefronts.id = catalog_items.storefront_id AND businesses.claimed_by = auth.uid()
        )
    );


-- System Allocations Injection (max_storefronts) into existing Tiers
-- Note: Requires running after 20260312150000_dynamic_tier_quotas.sql

UPDATE public.platform_config 
SET value = '[
    {
        "id": "free", 
        "name": "Free", 
        "price": 0, 
        "duration": "monthly", 
        "allocations": {
            "max_locations": 1,
            "max_shields": 0,
            "max_campaigns": 0,
            "max_storefronts": 0,
            "gader_points": 5
        },
        "features": ["1 Business Location", "Accept Reviews", "Basic Dashboard"],
        "isActive": true,
        "isPopular": false
    },
    {
        "id": "pro", 
        "name": "Pro", 
        "price": 99, 
        "duration": "monthly", 
        "allocations": {
            "max_locations": -1,
            "max_shields": 0,
            "max_campaigns": 1,
            "max_storefronts": 3,
            "gader_points": 15
        },
        "features": ["Unlimited Locations", "Team Management", "Priority Support", "Early Access"],
        "isActive": true,
        "isPopular": true
    },
    {
        "id": "enterprise", 
        "name": "Enterprise", 
        "price": 299, 
        "duration": "monthly", 
        "allocations": {
            "max_locations": -1,
            "max_shields": -1,
            "max_campaigns": -1,
            "max_storefronts": -1,
            "gader_points": 30
        },
        "features": ["White-label Reports", "API Access", "Custom Integrations", "Dedicated Account Manager"],
        "isActive": true,
        "isPopular": false
    }
]'::jsonb
WHERE key = 'tier_pricing';

