-- ==========================================
-- Phase 6: Trust Boost (1.2x Log Weight)
-- ==========================================

CREATE OR REPLACE FUNCTION update_business_score()
RETURNS TRIGGER AS $$
DECLARE
    v_business_id UUID;
    v_total_votes BIGINT;
    v_recommends BIGINT;
    v_complains BIGINT;
    
    v_total_weight FLOAT := 0;
    v_recommends_weight FLOAT := 0;
    v_shadow_score INTEGER;
    v_claimed_by UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_business_id := NEW.business_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_business_id := NEW.business_id;
    ELSIF TG_OP = 'DELETE' THEN
        v_business_id := OLD.business_id;
    END IF;

    -- 1. Get raw counts
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE interaction_type = 'recommend'),
        COUNT(*) FILTER (WHERE interaction_type = 'complain')
    INTO v_total_votes, v_recommends, v_complains
    FROM public.logs 
    WHERE business_id = v_business_id;

    -- 2. Calculate weighted score (1.2x weight for redeemed users)
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM public.user_coupons uc
                    JOIN public.merchant_coupons mc ON mc.id = uc.campaign_id
                    WHERE mc.business_id = l.business_id 
                      AND uc.user_id = l.profile_id
                      AND uc.status = 'REDEEMED'
                ) THEN 1.2
                ELSE 1.0
            END
        ), 0),
        COALESCE(SUM(
            CASE 
                WHEN l.interaction_type = 'recommend' THEN 
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 FROM public.user_coupons uc
                            JOIN public.merchant_coupons mc ON mc.id = uc.campaign_id
                            WHERE mc.business_id = l.business_id 
                              AND uc.user_id = l.profile_id
                              AND uc.status = 'REDEEMED'
                        ) THEN 1.2
                        ELSE 1.0
                    END
                ELSE 0
            END
        ), 0)
    INTO v_total_weight, v_recommends_weight
    FROM public.logs l
    WHERE l.business_id = v_business_id;

    -- 3. Calculate the shadow score using weights
    IF v_total_weight = 0 THEN
        v_shadow_score := 50; -- Default neutral
    ELSE
        v_shadow_score := ROUND((v_recommends_weight / v_total_weight) * 100)::INTEGER;
    END IF;

    -- 4. Update the core stats on the business
    UPDATE public.businesses
    SET 
        total_votes = v_total_votes,
        recommends = v_recommends,
        complains = v_complains,
        shadow_score = v_shadow_score
    WHERE id = v_business_id;

    -- 5. Fetch the ownership status to apply the Veil clamp
    SELECT claimed_by INTO v_claimed_by
    FROM public.businesses
    WHERE id = v_business_id;

    IF v_claimed_by IS NULL THEN
        -- Business is Unclaimed (Apply Veil)
        UPDATE public.businesses
        SET display_score = 
            CASE 
                WHEN v_shadow_score > 70 THEN 70
                WHEN v_shadow_score < 30 THEN 30
                ELSE v_shadow_score
            END
        WHERE id = v_business_id;
    ELSE
        -- Business is Claimed (Lift Veil)
        UPDATE public.businesses
        SET display_score = v_shadow_score
        WHERE id = v_business_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
