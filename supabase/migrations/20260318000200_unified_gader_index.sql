-- ============================================================
-- Phase 2c: Unified Gader Index — is_flagged exclusion
-- Updates the recalculate_business_scores trigger to exclude
-- flagged logs from score calculation, ensuring the display_score
-- (used by Discover) and the storefront view always match.
-- ============================================================

CREATE OR REPLACE FUNCTION recalculate_business_scores()
RETURNS TRIGGER AS $$
DECLARE
    v_recommends INT;
    v_complains INT;
    v_total INT;
    v_display_score NUMERIC;
    v_target_business_id UUID;
BEGIN
    v_target_business_id := COALESCE(NEW.business_id, OLD.business_id);

    -- Count weighted votes — EXCLUDING flagged logs
    SELECT
        COALESCE(SUM(CASE WHEN interaction_type = 'recommend' THEN COALESCE(weight, 1) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN interaction_type = 'complain'  THEN COALESCE(weight, 1) ELSE 0 END), 0)
    INTO v_recommends, v_complains
    FROM logs
    WHERE business_id = v_target_business_id
      AND (is_flagged IS NULL OR is_flagged = false);

    v_total := v_recommends + v_complains;

    -- Display score: percentage of positive weighted votes (0-100)
    IF v_total > 0 THEN
        v_display_score := ROUND((v_recommends::NUMERIC / v_total) * 100, 1);
    ELSE
        v_display_score := NULL;
    END IF;

    -- Update the business row (fires real-time subscription)
    UPDATE businesses SET
        recommends = (SELECT COUNT(*) FROM logs WHERE business_id = v_target_business_id AND interaction_type = 'recommend' AND (is_flagged IS NULL OR is_flagged = false)),
        complains = (SELECT COUNT(*) FROM logs WHERE business_id = v_target_business_id AND interaction_type = 'complain' AND (is_flagged IS NULL OR is_flagged = false)),
        shadow_score = v_recommends - v_complains,
        display_score = v_display_score
    WHERE id = v_target_business_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger fires on INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS trg_recalculate_scores ON logs;
CREATE TRIGGER trg_recalculate_scores
    AFTER INSERT OR UPDATE OR DELETE ON logs
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_business_scores();
