-- Phase 2: Database Reactivity & Logic
-- 1. Add aggregation columns to businesses table for Business Health Score
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS total_votes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS recommends BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS complains BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 0;

-- 2. Backfill existing data from the logs table (if it has records)
-- This assumes logs table has `interaction_type` ('recommend', 'complain') and `business_id`.
DO $$
BEGIN
    UPDATE public.businesses b
    SET 
        total_votes = COALESCE(l.total, 0),
        recommends = COALESCE(l.rec_count, 0),
        complains = COALESCE(l.comp_count, 0)
    FROM (
        SELECT 
            business_id,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE interaction_type = 'recommend') as rec_count,
            COUNT(*) FILTER (WHERE interaction_type = 'complain') as comp_count
        FROM public.logs
        GROUP BY business_id
    ) l
    WHERE b.id = l.business_id;

    -- Calculate the health_score for backfilled data
    UPDATE public.businesses
    SET health_score = 
        CASE 
            WHEN total_votes = 0 THEN 50 -- default neutral
            ELSE ROUND((recommends::FLOAT / total_votes::FLOAT) * 100)::INTEGER
        END;
EXCEPTION WHEN OTHERS THEN
    -- If logs table doesn't exist or has different schema, ignore backfill
    RAISE NOTICE 'Skipping backfill: %', SQLERRM;
END $$;

-- 3. Create the trigger function
CREATE OR REPLACE FUNCTION update_business_score()
RETURNS TRIGGER AS $$
DECLARE
    v_business_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_business_id := NEW.business_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_business_id := NEW.business_id;
    ELSIF TG_OP = 'DELETE' THEN
        v_business_id := OLD.business_id;
    END IF;

    -- Recalculate everything for that business_id to ensure consistency
    -- Even simpler than incrementing/decrementing, and safer against edge cases
    UPDATE public.businesses
    SET 
        total_votes = (SELECT COUNT(*) FROM public.logs WHERE business_id = v_business_id),
        recommends = (SELECT COUNT(*) FROM public.logs WHERE business_id = v_business_id AND interaction_type = 'recommend'),
        complains = (SELECT COUNT(*) FROM public.logs WHERE business_id = v_business_id AND interaction_type = 'complain')
    WHERE id = v_business_id;

    -- Update health score calculation
    UPDATE public.businesses
    SET health_score = 
        CASE 
            WHEN total_votes = 0 THEN 50
            ELSE ROUND((recommends::FLOAT / total_votes::FLOAT) * 100)::INTEGER
        END
    WHERE id = v_business_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply the trigger to the logs table
DROP TRIGGER IF EXISTS trg_update_business_score ON public.logs;

CREATE TRIGGER trg_update_business_score
AFTER INSERT OR UPDATE OR DELETE ON public.logs
FOR EACH ROW
EXECUTE FUNCTION update_business_score();

-- 5. Enable Supabase Realtime for the businesses table
-- This allows clients to listen to updates (e.g., claiming a business)
ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;
