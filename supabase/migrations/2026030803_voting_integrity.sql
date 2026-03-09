-- ============================================================
-- Phase 2D: log_votes duplicate prevention constraints
-- Phase 2E: Score recalculation trigger on log insert
-- ============================================================
-- Run this in Supabase SQL Editor BEFORE deploying Phase 2 code.
-- These are safe to run multiple times (IF NOT EXISTS clauses).
-- ============================================================

-- ─── 2D: Unique constraints on log_votes ───────────────────
-- Prevents same user from voting twice on the same log entry.
-- NULLS NOT DISTINCT treats NULL profile_id/fingerprint as equal
-- (Postgres 15+). If on Postgres 14, omit NULLS NOT DISTINCT.

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'log_votes_unique_user'
    ) THEN
        ALTER TABLE log_votes
            ADD CONSTRAINT log_votes_unique_user
            UNIQUE NULLS NOT DISTINCT (log_id, profile_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'log_votes_unique_anon'
    ) THEN
        ALTER TABLE log_votes
            ADD CONSTRAINT log_votes_unique_anon
            UNIQUE NULLS NOT DISTINCT (log_id, fingerprint);
    END IF;
END $$;


-- ─── 2E: Score recalculation trigger ───────────────────────
-- When a new log is inserted, recalculate the business's
-- recommends/complains counts. This fires the real-time
-- subscription on the businesses table automatically.

CREATE OR REPLACE FUNCTION recalculate_business_scores()
RETURNS TRIGGER AS $$
DECLARE
    v_recommends INT;
    v_complains INT;
    v_total INT;
    v_display_score NUMERIC;
BEGIN
    -- Count weighted votes
    SELECT
        COALESCE(SUM(CASE WHEN interaction_type = 'recommend' THEN COALESCE(weight, 1) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN interaction_type = 'complain'  THEN COALESCE(weight, 1) ELSE 0 END), 0)
    INTO v_recommends, v_complains
    FROM logs
    WHERE business_id = COALESCE(NEW.business_id, OLD.business_id);

    v_total := v_recommends + v_complains;

    -- Display score: percentage of positive weighted votes (0-100)
    IF v_total > 0 THEN
        v_display_score := ROUND((v_recommends::NUMERIC / v_total) * 100, 1);
    ELSE
        v_display_score := NULL;
    END IF;

    -- Update the business row (this fires real-time subscription)
    UPDATE businesses SET
        recommends = (SELECT COUNT(*) FROM logs WHERE business_id = COALESCE(NEW.business_id, OLD.business_id) AND interaction_type = 'recommend'),
        complains = (SELECT COUNT(*) FROM logs WHERE business_id = COALESCE(NEW.business_id, OLD.business_id) AND interaction_type = 'complain'),
        shadow_score = v_recommends - v_complains,
        display_score = v_display_score
    WHERE id = COALESCE(NEW.business_id, OLD.business_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_recalculate_scores ON logs;

CREATE TRIGGER trg_recalculate_scores
    AFTER INSERT OR DELETE ON logs
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_business_scores();


-- ─── Verify ────────────────────────────────────────────────
-- Run these to confirm everything was created:
SELECT conname FROM pg_constraint WHERE conname LIKE 'log_votes%';
SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'logs';
