-- Migration: Update Transactions and Admin RPC to support Addons
-- Description: Drops check constraint on requested_tier and updates admin_confirm_payment

-- 1. Drop the check constraint on transactions.requested_tier
DO $$ 
DECLARE
    const_name text;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%requested_tier%';
      
    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.transactions DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- 2. Update the Admin Conform Payment RPC
CREATE OR REPLACE FUNCTION admin_confirm_payment(p_txn_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_tier TEXT;
    v_duration TEXT;
    v_owner_id UUID;
    v_days INTEGER;
    v_addon_type TEXT;
BEGIN
    -- Ensure caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Get transaction details
    SELECT business_id, requested_tier, duration, owner_id 
    INTO v_business_id, v_tier, v_duration, v_owner_id
    FROM public.transactions 
    WHERE id = p_txn_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pending transaction not found';
    END IF;

    -- Map duration to days
    IF v_duration = '30 Days' OR v_duration = '1 Month' THEN v_days := 30;
    ELSIF v_duration = '90 Days' THEN v_days := 90;
    ELSIF v_duration = '365 Days' OR v_duration = '1 Year' THEN v_days := 365;
    ELSE v_days := 30;
    END IF;

    -- Mark transaction as completed
    UPDATE public.transactions SET status = 'completed' WHERE id = p_txn_id;

    -- Check if it is an Addon Purchase
    IF v_tier LIKE '%Addon%' THEN
        -- Extract addon type (e.g., 'Shield Addon' -> 'shield')
        v_addon_type := lower(split_part(v_tier, ' ', 1));
        
        -- Insert or Update merchant_addons
        -- Assuming we simply increase the quantity if active, or insert new
        INSERT INTO public.merchant_addons (profile_id, addon_type, quantity, status, expires_at)
        VALUES (v_owner_id, v_addon_type, 1, 'active', now() + (v_days || ' days')::interval);
        
        -- Need to allocate the feature essentially allowing usage
        INSERT INTO public.feature_allocations (profile_id, business_id, feature_type, status)
        VALUES (v_owner_id, v_business_id, v_addon_type, 'active')
        ON CONFLICT (profile_id, business_id, feature_type) 
        DO UPDATE SET status = 'active';

    ELSE
        -- It is a Tier Upgrade
        -- Upsert Subscription
        INSERT INTO public.subscriptions (business_id, profile_id, tier, status, expires_at)
        VALUES (v_business_id, v_owner_id, v_tier, 'Active', now() + (v_days || ' days')::interval)
        ON CONFLICT (business_id) 
        DO UPDATE SET 
            tier = EXCLUDED.tier,
            status = 'Active',
            expires_at = EXCLUDED.expires_at,
            profile_id = EXCLUDED.profile_id;

        -- Update business shield_level physically if tying Tier to Shield
        UPDATE public.businesses 
        SET shield_level = CASE WHEN v_tier = 'Tier 2' THEN 2 ELSE 1 END
        WHERE id = v_business_id;
    END IF;

END;
$$;
