-- ============================================================
-- Atomic Gader Points Operations
-- Prevents race conditions when multiple concurrent votes
-- try to award points to the same user simultaneously.
-- ============================================================

-- RPC: Atomically increment (or decrement) a user's gader_points.
-- Returns the new gader_points value after the update.
CREATE OR REPLACE FUNCTION increment_gader_points(
    p_profile_id UUID,
    p_amount INTEGER DEFAULT 10
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_points INTEGER;
BEGIN
    UPDATE profiles
    SET gader_points = GREATEST(COALESCE(gader_points, 0) + p_amount, 0)
    WHERE id = p_profile_id
    RETURNING gader_points INTO v_new_points;

    IF NOT FOUND THEN
        -- Profile doesn't exist — return 0 silently.
        RETURN 0;
    END IF;

    RETURN v_new_points;
END;
$$;

-- RPC: Atomically increment a business stat column (recommends or complains).
-- Used by the business-stats API route to prevent read-modify-write races.
CREATE OR REPLACE FUNCTION increment_business_stat(
    p_business_id UUID,
    p_column TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_column = 'recommends' THEN
        UPDATE businesses SET recommends = COALESCE(recommends, 0) + 1
        WHERE id = p_business_id;
    ELSIF p_column = 'complains' THEN
        UPDATE businesses SET complains = COALESCE(complains, 0) + 1
        WHERE id = p_business_id;
    ELSE
        RAISE EXCEPTION 'Invalid column: %. Expected recommends or complains.', p_column;
    END IF;
END;
$$;
