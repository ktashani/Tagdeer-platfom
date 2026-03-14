-- ============================================================
-- Batch Coupon Expiry Processing
-- Replaces the N+1 loop in the coupon-expiry-cron edge function
-- with a single SQL transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION expire_coupons_batch()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expired_count INTEGER;
    v_returned_count INTEGER;
BEGIN
    -- Step 1: Batch-update all expired user_coupons to EXPIRED status
    WITH expired AS (
        UPDATE user_coupons
        SET status = 'EXPIRED'
        WHERE status = 'ACTIVE'
          AND valid_until IS NOT NULL
          AND valid_until < NOW()
        RETURNING id, campaign_id, source
    )
    SELECT COUNT(*) INTO v_expired_count FROM expired;

    -- Step 2: Decrement claimed_count for all affected campaigns in one pass.
    -- Groups by campaign_id to batch the decrements.
    WITH recently_expired AS (
        SELECT campaign_id, COUNT(*) AS cnt
        FROM user_coupons
        WHERE status = 'EXPIRED'
          AND valid_until IS NOT NULL
          AND valid_until < NOW() + INTERVAL '1 minute'
          AND valid_until >= NOW() - INTERVAL '1 minute'
        GROUP BY campaign_id
    )
    UPDATE merchant_coupons mc
    SET claimed_count = GREATEST(0, mc.claimed_count - re.cnt)
    FROM recently_expired re
    WHERE mc.id = re.campaign_id;

    GET DIAGNOSTICS v_returned_count = ROW_COUNT;

    RETURN json_build_object(
        'expired_count', v_expired_count,
        'campaigns_adjusted', v_returned_count
    );
END;
$$;
