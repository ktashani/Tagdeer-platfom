-- ==========================================
-- Phase 17.0: Merchant Page Enhancements Schema
-- ==========================================

-- 1. Create Business Interactions Table (Physical Scans)
CREATE TABLE IF NOT EXISTS public.business_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL DEFAULT 'scan' CHECK (interaction_type IN ('scan')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(business_id, profile_id, created_at) -- Prevent duplicate scans in same second
);

-- RLS for interactions
ALTER TABLE public.business_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their business interactions"
    ON public.business_interactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = business_interactions.business_id AND b.claimed_by = auth.uid()
        )
    );

CREATE POLICY "Users can log interactions"
    ON public.business_interactions FOR INSERT
    WITH CHECK (auth.uid() = profile_id);


-- 2. Create Merchant Coupons Table
CREATE TABLE IF NOT EXISTS public.merchant_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    offer_type TEXT NOT NULL CHECK (offer_type IN ('percentage', 'fixed', 'free_item')),
    discount_value NUMERIC(10, 2), -- e.g. 20 for 20%, or 10 for 10 LYD
    item_name TEXT, -- only used if offer_type is 'free_item'
    
    initial_quantity INTEGER NOT NULL CHECK (initial_quantity > 0),
    remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
    
    distribution_rule TEXT NOT NULL CHECK (distribution_rule IN ('quota_pool', 'physical_scan', 'resolution_only')),
    
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'exhausted', 'expired')),
    expiry_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for merchant_coupons
ALTER TABLE public.merchant_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage their own coupons"
    ON public.merchant_coupons FOR ALL
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());
    
CREATE POLICY "Public can view active coupons"
    ON public.merchant_coupons FOR SELECT
    USING (status = 'active');


-- 3. Create Coupon Redemptions Table
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES public.merchant_coupons(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(coupon_id, profile_id) -- A user can only redeem a specific coupon once
);

-- RLS for redemptions
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own redemptions"
    ON public.coupon_redemptions FOR SELECT
    USING (profile_id = auth.uid());

CREATE POLICY "Merchants can view redemptions for their coupons"
    ON public.coupon_redemptions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.merchant_coupons c
            WHERE c.id = coupon_redemptions.coupon_id AND c.created_by = auth.uid()
        )
    );

CREATE POLICY "Merchants can insert redemptions"
    ON public.coupon_redemptions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.merchant_coupons c
            WHERE c.id = coupon_redemptions.coupon_id AND c.created_by = auth.uid()
        )
    );


-- 4. Create Disputes Table (Flagged as Fake)
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id BIGINT NOT NULL REFERENCES public.logs(id) ON DELETE CASCADE, -- Assuming 'interactions' or 'logs' is the reviews table
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_admin_review' CHECK (status IN ('pending_admin_review', 'approved_fake', 'rejected_valid')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- RLS for disputes
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage their own disputes"
    ON public.disputes FOR ALL
    USING (merchant_id = auth.uid())
    WITH CHECK (merchant_id = auth.uid());
    
CREATE POLICY "Admins have full access to disputes"
    ON public.disputes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- 5. Add Shield Level properties to businesses map
ALTER TABLE public.businesses
ADD COLUMN shield_level INTEGER DEFAULT 0 CHECK (shield_level IN (0, 1, 2));
-- Level 0 = None, Level 1 = Trust (SMS only), Level 2 = Fatora (Receipts only)

-- 6. Add triggers for `updated_at` (Reusing existing trigger function if available)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_merchant_coupons_updated_at') THEN
        CREATE TRIGGER update_merchant_coupons_updated_at
            BEFORE UPDATE ON public.merchant_coupons
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
