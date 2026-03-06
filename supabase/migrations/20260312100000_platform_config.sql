-- Migration: Create Platform Config
-- Description: Centralized key-value store for platform configuration (categories, regions, pricing, etc.)

-- 1. Create the Config Table
CREATE TABLE IF NOT EXISTS public.platform_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. Drop the restrictive Region CHECK constraint on businesses
-- This is critical to allow dynamic cities.
-- First we must check if the constraint exists and get its exact name, though we assume businesses_region_check
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'businesses_region_check' 
        AND table_name = 'businesses'
    ) THEN
        ALTER TABLE public.businesses DROP CONSTRAINT businesses_region_check;
    END IF;
END $$;

-- 3. Seed Initial Configuration Data
-- We use JSONB to store arrays and objects flexibly.
-- The following keys correspond to the hardcoded values being replaced.
INSERT INTO public.platform_config (key, value) VALUES
('categories', '[
    {"name": "Supermarket", "isActive": true, "requiresReceipt": true, "basePoints": 5},
    {"name": "Pharmacy", "isActive": true, "requiresReceipt": true, "basePoints": 3},
    {"name": "Café & Restaurants", "isActive": true, "requiresReceipt": false, "basePoints": 2},
    {"name": "Bakery", "isActive": true, "requiresReceipt": false, "basePoints": 2},
    {"name": "Healthcare", "isActive": true, "requiresReceipt": true, "basePoints": 5},
    {"name": "Electronics", "isActive": true, "requiresReceipt": true, "basePoints": 10},
    {"name": "Tech & Telecommunication", "isActive": true, "requiresReceipt": true, "basePoints": 5},
    {"name": "Construction", "isActive": true, "requiresReceipt": true, "basePoints": 20},
    {"name": "Home Maintenance", "isActive": true, "requiresReceipt": false, "basePoints": 5},
    {"name": "Automotive", "isActive": true, "requiresReceipt": true, "basePoints": 15},
    {"name": "Beauty & Salon", "isActive": true, "requiresReceipt": false, "basePoints": 3},
    {"name": "Real Estate", "isActive": true, "requiresReceipt": true, "basePoints": 50},
    {"name": "Education", "isActive": true, "requiresReceipt": true, "basePoints": 10},
    {"name": "Travel", "isActive": true, "requiresReceipt": true, "basePoints": 25},
    {"name": "Fashion & Retail", "isActive": true, "requiresReceipt": false, "basePoints": 5},
    {"name": "Services", "isActive": true, "requiresReceipt": false, "basePoints": 5},
    {"name": "Food & Beverage", "isActive": true, "requiresReceipt": false, "basePoints": 2},
    {"name": "Delivery & Shipping", "isActive": true, "requiresReceipt": false, "basePoints": 3}
]'::jsonb),
('regions', '[
    {"name": "Tripoli", "isActive": true},
    {"name": "Benghazi", "isActive": true}
]'::jsonb),
('shield_pricing', '{"trust": 20, "fatora": 50}'::jsonb),
('tier_pricing', '[
    {"id": "tier1", "name": "Tier 1 (Base)", "price": 49, "duration": "monthly", "features": ["1 Business Location", "Accept Reviews", "Performance Dashboard"]},
    {"id": "tier2", "name": "Tier 2 (Pro)", "price": 99, "duration": "monthly", "features": ["Unlimited Locations", "Team Management", "Priority Support", "Early Access"]}
]'::jsonb),
('vip_thresholds', '{"guest": 0, "bronze": 20, "silver": 1000, "gold": 5000, "vip": 20000}'::jsonb),
('admin_roles', '["super_admin", "admin", "assistant_admin", "support_agent"]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Enable RLS
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- Public can read (needed for pricing pages, onboarding, consumer discover)
DROP POLICY IF EXISTS "Public read access to config" ON public.platform_config;
CREATE POLICY "Public read access to config" 
    ON public.platform_config FOR SELECT 
    USING (true);

-- Only Super Admins and Admins can update config
DROP POLICY IF EXISTS "Admins can update config" ON public.platform_config;
CREATE POLICY "Admins can update config" 
    ON public.platform_config FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('super_admin', 'admin')
        )
    );

DROP POLICY IF EXISTS "Admins can insert config" ON public.platform_config;
CREATE POLICY "Admins can insert config" 
    ON public.platform_config FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('super_admin', 'admin')
        )
    );

DROP POLICY IF EXISTS "Admins can delete config" ON public.platform_config;
CREATE POLICY "Admins can delete config" 
    ON public.platform_config FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('super_admin', 'admin')
        )
    );
