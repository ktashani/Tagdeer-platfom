-- ==========================================
-- Admin Financials Schemas
-- ==========================================

-- 1. Create Transactions Table (for manual pending upgrades and payments)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    requested_tier TEXT NOT NULL CHECK (requested_tier IN ('Tier 1', 'Tier 2')),
    amount NUMERIC(10,2) NOT NULL,
    duration TEXT NOT NULL DEFAULT '30 Days',
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
    
    screenshot_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their transactions"
    ON public.transactions FOR SELECT
    USING (owner_id = auth.uid());
    
CREATE POLICY "Merchants can insert transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (owner_id = auth.uid());
    
CREATE POLICY "Admins have full access to transactions"
    ON public.transactions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );

-- 2. Create Subscriptions Table (for active subscriptions)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    
    tier TEXT NOT NULL CHECK (tier IN ('Tier 1', 'Tier 2')),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expiring Soon', 'Expired')),
    auto_renew BOOLEAN DEFAULT false,
    
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(business_id) -- One active subscription per business
);

-- RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their subscriptions"
    ON public.subscriptions FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = subscriptions.business_id AND b.claimed_by = auth.uid())
    );
    
CREATE POLICY "Admins have full access to subscriptions"
    ON public.subscriptions FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );

-- 3. Confirm Payment RPC
CREATE OR REPLACE FUNCTION admin_confirm_payment(p_txn_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_tier TEXT;
    v_duration TEXT;
    v_days INTEGER;
BEGIN
    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Get transaction details
    SELECT business_id, requested_tier, duration 
    INTO v_business_id, v_tier, v_duration
    FROM public.transactions 
    WHERE id = p_txn_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending transaction not found';
    END IF;

    -- Map duration to days
    IF v_duration = '30 Days' THEN v_days := 30;
    ELSIF v_duration = '90 Days' THEN v_days := 90;
    ELSE v_days := 30;
    END IF;

    -- Mark transaction as completed
    UPDATE public.transactions SET status = 'completed' WHERE id = p_txn_id;

    -- Upsert Subscription
    INSERT INTO public.subscriptions (business_id, tier, status, expires_at)
    VALUES (v_business_id, v_tier, 'Active', now() + (v_days || ' days')::interval)
    ON CONFLICT (business_id) 
    DO UPDATE SET 
        tier = EXCLUDED.tier,
        status = 'Active',
        expires_at = EXCLUDED.expires_at;

    -- Update business shield_level physically if tying Tier to Shield
    UPDATE public.businesses 
    SET shield_level = CASE WHEN v_tier = 'Tier 2' THEN 2 ELSE 1 END
    WHERE id = v_business_id;

END;
$$;
