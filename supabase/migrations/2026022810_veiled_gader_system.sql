-- ==========================================
-- Phase 5: The Veiled Gader System
-- Bounded Reputation (Clamp Logic)
-- ==========================================

-- 1. Rename existing health_score to shadow_score, preserving the actual absolute truth
ALTER TABLE public.businesses
RENAME COLUMN health_score TO shadow_score;

-- 2. Add the new display_score column which will contain the clamped/veiled value
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS display_score INTEGER DEFAULT 0;

ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Initially sync display_score with shadow_score, then apply clamps for unclaimed businesses
UPDATE public.businesses
SET display_score = 
    CASE 
        WHEN claimed_by IS NOT NULL THEN shadow_score
        WHEN shadow_score > 70 THEN 70
        WHEN shadow_score < 30 THEN 30
        ELSE shadow_score
    END;

-- 4. Update the trigger function to automatically calculate the veil
CREATE OR REPLACE FUNCTION update_business_score()
RETURNS TRIGGER AS $$
DECLARE
    v_business_id UUID;
    v_total_votes BIGINT;
    v_recommends BIGINT;
    v_complains BIGINT;
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

    -- Recalculate everything for that business_id to ensure consistency
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE interaction_type = 'recommend'),
        COUNT(*) FILTER (WHERE interaction_type = 'complain')
    INTO v_total_votes, v_recommends, v_complains
    FROM public.logs 
    WHERE business_id = v_business_id;

    -- Calculate the shadow score (Absolute Truth)
    IF v_total_votes = 0 THEN
        v_shadow_score := 50; -- Default neutral
    ELSE
        v_shadow_score := ROUND((v_recommends::FLOAT / v_total_votes::FLOAT) * 100)::INTEGER;
    END IF;

    -- Update the core stats
    UPDATE public.businesses
    SET 
        total_votes = v_total_votes,
        recommends = v_recommends,
        complains = v_complains,
        shadow_score = v_shadow_score
    WHERE id = v_business_id;

    -- Fetch the ownership status to apply the Veil
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

-- 5. Trigger to handle when a business is claimed (to lift the veil instantly)
CREATE OR REPLACE FUNCTION handle_business_claim_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If ownership changes (e.g. gets claimed or unclaimed)
    IF NEW.claimed_by IS DISTINCT FROM OLD.claimed_by THEN
        IF NEW.claimed_by IS NULL THEN
            -- Re-apply the veil if unclaimed
            NEW.display_score = 
                CASE 
                    WHEN NEW.shadow_score > 70 THEN 70
                    WHEN NEW.shadow_score < 30 THEN 30
                    ELSE NEW.shadow_score
                END;
        ELSE
            -- Lift the veil if claimed
            NEW.display_score = NEW.shadow_score;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_handle_business_claim_update ON public.businesses;

CREATE TRIGGER trg_handle_business_claim_update
BEFORE UPDATE ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION handle_business_claim_update();
