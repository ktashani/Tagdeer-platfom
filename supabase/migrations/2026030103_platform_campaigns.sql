-- ==========================================
-- Admin Platform Campaigns Schema
-- ==========================================

-- 1. Create Platform Campaigns Table
CREATE TABLE IF NOT EXISTS public.platform_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Active', 'Draft', 'Ended')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    participants INTEGER DEFAULT 0,
    coupons_pledged INTEGER DEFAULT 0,
    coupons_claimed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.platform_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage platform campaigns"
    ON public.platform_campaigns FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
    
CREATE POLICY "Public can view active campaigns"
    ON public.platform_campaigns FOR SELECT
    USING (status = 'Active');


-- 2. Create Platform Coupon Pools Table
CREATE TABLE IF NOT EXISTS public.platform_coupon_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Code List',
    amount INTEGER NOT NULL CHECK (amount > 0),
    remaining INTEGER NOT NULL CHECK (remaining >= 0),
    drop_logic TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.platform_coupon_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage platform pools"
    ON public.platform_coupon_pools FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
