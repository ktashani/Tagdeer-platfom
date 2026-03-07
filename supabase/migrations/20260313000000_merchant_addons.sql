-- Migration: Merchant Addons Table
-- Description: Adds a table to track modular feature allocations (like extra shields or storefronts) independent of the base subscription tier.

CREATE TABLE IF NOT EXISTS public.merchant_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    addon_type TEXT NOT NULL, -- e.g., 'shield', 'storefront', 'location', 'campaign'
    quantity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    expires_at TIMESTAMP WITH TIME ZONE, -- Null means permanent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.merchant_addons ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own addons
CREATE POLICY "Merchants can view own addons" ON public.merchant_addons
    FOR SELECT
    USING (auth.uid() = profile_id);

-- Admins can do everything (handled by service_role bypass usually, but adding explicit policy if they use dashboard)
CREATE POLICY "Admins full access to merchant_addons" ON public.merchant_addons
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Function for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
CREATE TRIGGER update_merchant_addons_updated_at
    BEFORE UPDATE ON public.merchant_addons
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Add index for fast aggregation per user
CREATE INDEX idx_merchant_addons_profile ON public.merchant_addons(profile_id, status);

-- Optional: Create a database cron function to expire them daily, 
-- but we can just handle it in the application layer logic by checking expires_at.
-- Let's add a helper View to easily get ACTIVE addons that haven't expired.
CREATE OR REPLACE VIEW public.active_merchant_addons AS
SELECT * FROM public.merchant_addons
WHERE status = 'active'
  AND (expires_at IS NULL OR expires_at > now());
