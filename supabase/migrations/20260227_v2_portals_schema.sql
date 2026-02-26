-- ==========================================
-- Phase 16.0: V2 Portals Elevation Schema
-- ==========================================

-- 1. Create User Roles Enum
CREATE TYPE public.user_role AS ENUM ('user', 'merchant', 'admin');

-- 2. Update profiles table to include role (defaults to 'user')
ALTER TABLE public.profiles 
ADD COLUMN role public.user_role DEFAULT 'user'::public.user_role NOT NULL;

-- 3. Create Business Claims Table
-- For merchants claiming their stores from the Tagdeer directory
CREATE TABLE public.business_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL, -- references businesses.id assuming it exists or will exist
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: add foreign key to businesses table when ready
-- ALTER TABLE public.business_claims 
-- ADD CONSTRAINT fk_business_id FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;

-- Add RLS for business claims
ALTER TABLE public.business_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own claims"
    ON public.business_claims FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all claims"
    ON public.business_claims FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- 4. Create Campaigns Table
-- For admins to manage coupon allocations
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    allocated_coupons INTEGER NOT NULL DEFAULT 0,
    used_coupons INTEGER NOT NULL DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id)
);

-- Add RLS for campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to campaigns"
    ON public.campaigns FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Merchants and users can view active campaigns"
    ON public.campaigns FOR SELECT
    USING (status = 'active');
