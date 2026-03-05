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

-- 3. Insert default configuration (mirroring current hardcoded data)
INSERT INTO public.platform_config (key, value) VALUES
('categories', '["Supermarket","Pharmacy","Café & Restaurants","Bakery","Healthcare","Electronics","Tech & Telecommunication","Construction","Home Maintenance","Automotive","Beauty & Salon","Real Estate","Education","Travel","Fashion & Retail","Services","Food & Beverage","Delivery & Shipping"]'::jsonb),
('regions', '["Tripoli", "Benghazi"]'::jsonb),
('shield_pricing', '{"trust": 20, "fatora": 50}'::jsonb),
('tier_pricing', '[{"id":"tier1","name":"Pro","price":150,"features":["Unlimited Locations","1 Active Campaign (5 Coupons)","Team Management","Discovery Ribbon Ad"]},{"id":"tier2","name":"Enterprise","price":350,"features":["Unlimited Campaigns & Coupons","30 Scan Points (Highest)","Trust Shields Included","Resolution & Disputes Included"]}]'::jsonb),
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
