-- Migration: Merchant-Centric Architecture (Phase 1)
-- Description: Decouple subscriptions from businesses, link to profiles, add feature allocations.

-- 1. Create feature_allocations table
CREATE TABLE IF NOT EXISTS public.feature_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    feature_type TEXT NOT NULL, -- e.g., 'shield', 'analytics', 'priority_support'
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    allocated_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    UNIQUE(profile_id, business_id, feature_type) -- Prevent double allocation of same feature to same business
);

-- Enable RLS on feature_allocations
ALTER TABLE public.feature_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their own feature allocations"
ON public.feature_allocations FOR SELECT
USING (auth.uid() = profile_id);

CREATE POLICY "Admins can view all feature allocations"
ON public.feature_allocations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')
    )
);

-- 2. Modify subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS quotas JSONB DEFAULT '{"max_locations": 1, "max_shields": 0}'::jsonb;

-- 3. Data Migration: Link existing subscriptions to the profile that claimed the business
DO $$ 
DECLARE
    sub_record RECORD;
    owner_uuid UUID;
BEGIN
    FOR sub_record IN SELECT id, business_id FROM public.subscriptions WHERE profile_id IS NULL AND business_id IS NOT NULL
    LOOP
        -- Find the user who claimed this business
        SELECT claimed_by INTO owner_uuid FROM public.businesses WHERE id = sub_record.business_id;
        
        IF owner_uuid IS NOT NULL THEN
            UPDATE public.subscriptions SET profile_id = owner_uuid WHERE id = sub_record.id;
        END IF;
    END LOOP;
END $$;

-- 4. Set default quotas based on tier for existing migrated subscriptions
UPDATE public.subscriptions
SET quotas = 
    CASE 
        WHEN tier = 'Pro' THEN '{"max_locations": 3, "max_shields": 1}'::jsonb
        WHEN tier = 'Enterprise' THEN '{"max_locations": 10, "max_shields": 3}'::jsonb
        ELSE '{"max_locations": 1, "max_shields": 0}'::jsonb
    END
WHERE profile_id IS NOT NULL;

-- 5. Migrate existing shields to the feature_allocations table
DO $$ 
DECLARE
    biz_record RECORD;
BEGIN
    -- For any business that is currently shielded, create an allocation record for its owner
    FOR biz_record IN SELECT id, claimed_by FROM public.businesses WHERE is_shielded = true AND claimed_by IS NOT NULL
    LOOP
        INSERT INTO public.feature_allocations (profile_id, business_id, feature_type, status)
        VALUES (biz_record.claimed_by, biz_record.id, 'shield', 'active')
        ON CONFLICT (profile_id, business_id, feature_type) DO NOTHING;
    END LOOP;
END $$;

-- 6. Make business_id nullable to fully decouple
ALTER TABLE public.subscriptions 
ALTER COLUMN business_id DROP NOT NULL;
