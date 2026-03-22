-- ============================================================
-- Production Readiness: Weekly Counter Reset + Configurable Limits
--
-- 1. pg_cron job to reset weekly_log_count, coupons_earned_this_week
-- 2. Configurable anon_weekly_vote_limit in platform_config
-- 3. Update submit_vote RPC to read limit from config
-- ============================================================

-- ─── 1. Insert default anon_weekly_vote_limit config ──────────
INSERT INTO platform_config (key, value)
VALUES ('anon_weekly_vote_limit', '7')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. Weekly counter reset function ─────────────────────────
-- Resets weekly_log_count and coupons_earned_this_week every Monday 00:00 UTC.
-- This can be invoked via pg_cron, Supabase Edge Function cron, or manual call.
CREATE OR REPLACE FUNCTION reset_weekly_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE profiles
    SET weekly_log_count = 0,
        coupons_earned_this_week = 0
    WHERE weekly_log_count > 0
       OR coupons_earned_this_week > 0;

    RAISE NOTICE 'Weekly counters reset at %', NOW();
END;
$$;

-- ─── 3. Schedule via pg_cron (if extension available) ─────────
-- Supabase projects have pg_cron enabled by default.
-- This schedules the reset for every Monday at 00:00 UTC.
DO $$
BEGIN
    -- Check if pg_cron extension is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Unschedule if previously existed (idempotent)
        PERFORM cron.unschedule('weekly_counter_reset');
        -- Schedule: every Monday at 00:00 UTC
        PERFORM cron.schedule(
            'weekly_counter_reset',
            '0 0 * * 1',
            'SELECT reset_weekly_counters()'
        );
        RAISE NOTICE 'pg_cron job scheduled: weekly_counter_reset (every Monday 00:00 UTC)';
    ELSE
        RAISE NOTICE 'pg_cron not available. Use Supabase Edge Function cron or external scheduler to call reset_weekly_counters() weekly.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron scheduling failed: %. Set up external cron.', SQLERRM;
END $$;

-- ─── 4. Update submit_vote to read configurable anon limit ────
CREATE OR REPLACE FUNCTION submit_vote(
    p_business_id UUID,
    p_interaction_type TEXT,
    p_reason_text TEXT DEFAULT NULL,
    p_profile_id UUID DEFAULT NULL,
    p_fingerprint TEXT DEFAULT NULL,
    p_is_flagged BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tier_multiplier NUMERIC;
    v_diminishing NUMERIC;
    v_weight NUMERIC;
    v_past_count INT;
    v_gader_points INT;
    v_vip_tier TEXT;
    v_points_from_tier NUMERIC;
    v_inserted_id UUID;
    v_inserted_at TIMESTAMPTZ;
    v_earned_points INT;
    v_new_points INT;
    v_cooldown_count INT;
    v_anon_count INT;
    v_anon_limit INT;
    v_role TEXT;
    v_coupon_awarded JSONB := NULL;
BEGIN
    -- ── Validate inputs ──────────────────────────────────
    IF p_interaction_type NOT IN ('recommend', 'complain') THEN
        RETURN jsonb_build_object('error', 'Invalid interaction_type');
    END IF;

    IF p_business_id IS NULL THEN
        RETURN jsonb_build_object('error', 'business_id is required');
    END IF;

    -- ── Block merchant accounts ──────────────────────────
    IF p_profile_id IS NOT NULL THEN
        SELECT role INTO v_role FROM profiles WHERE id = p_profile_id;
        IF v_role = 'merchant' THEN
            RETURN jsonb_build_object('error', 'Merchant accounts cannot vote');
        END IF;
    END IF;

    -- ── Anonymous global limit: configurable per week ─────
    IF p_profile_id IS NULL AND p_fingerprint IS NOT NULL THEN
        -- Read configurable limit from platform_config (default 7)
        SELECT COALESCE(value::INT, 7) INTO v_anon_limit
        FROM platform_config WHERE key = 'anon_weekly_vote_limit';
        IF v_anon_limit IS NULL THEN v_anon_limit := 7; END IF;

        SELECT COUNT(*) INTO v_anon_count
        FROM logs
        WHERE fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '7 days';

        IF v_anon_count >= v_anon_limit THEN
            RETURN jsonb_build_object('error', 'anonymous_weekly_limit', 'limit', v_anon_limit);
        END IF;
    END IF;

    -- ── 24-Hour same-business cooldown ────────────────────
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_cooldown_count
        FROM logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at >= NOW() - INTERVAL '24 hours';
    ELSE
        SELECT COUNT(*) INTO v_cooldown_count
        FROM logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '24 hours';
    END IF;

    IF v_cooldown_count > 0 THEN
        RETURN jsonb_build_object('error', 'cooldown_active');
    END IF;

    -- ── Tier multiplier ──────────────────────────────────
    IF p_profile_id IS NULL THEN
        v_tier_multiplier := 0.2;  -- Anonymous
    ELSE
        SELECT gader_points, vip_tier
        INTO v_gader_points, v_vip_tier
        FROM profiles WHERE id = p_profile_id;

        -- From VIP tier string
        v_tier_multiplier := 1.0;  -- Bronze default
        IF LOWER(COALESCE(v_vip_tier, '')) LIKE '%vip%'
           OR LOWER(COALESCE(v_vip_tier, '')) LIKE '%diamond%' THEN
            v_tier_multiplier := 2.5;
        ELSIF LOWER(COALESCE(v_vip_tier, '')) LIKE '%gold%' THEN
            v_tier_multiplier := 2.0;
        ELSIF LOWER(COALESCE(v_vip_tier, '')) LIKE '%silver%' THEN
            v_tier_multiplier := 1.5;
        END IF;

        -- From Gader points (take the higher)
        v_points_from_tier := 1.0;
        IF COALESCE(v_gader_points, 0) >= 20000 THEN
            v_points_from_tier := 2.5;
        ELSIF COALESCE(v_gader_points, 0) >= 5000 THEN
            v_points_from_tier := 2.0;
        ELSIF COALESCE(v_gader_points, 0) >= 1000 THEN
            v_points_from_tier := 1.5;
        END IF;

        v_tier_multiplier := GREATEST(v_tier_multiplier, v_points_from_tier);
    END IF;

    -- ── Diminishing returns (30-day same-business count) ──
    IF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_past_count
        FROM logs
        WHERE business_id = p_business_id
          AND profile_id = p_profile_id
          AND created_at >= NOW() - INTERVAL '30 days';
    ELSE
        SELECT COUNT(*) INTO v_past_count
        FROM logs
        WHERE business_id = p_business_id
          AND fingerprint = p_fingerprint
          AND created_at >= NOW() - INTERVAL '30 days';
    END IF;

    IF v_past_count <= 0 THEN
        v_diminishing := 1.0;
    ELSIF v_past_count = 1 THEN
        v_diminishing := 0.5;
    ELSE
        v_diminishing := 0.25;
    END IF;

    -- ── Calculate final weight ───────────────────────────
    v_weight := ROUND(v_tier_multiplier * v_diminishing * 100) / 100;

    -- ── Insert log ───────────────────────────────────────
    INSERT INTO logs (
        business_id, interaction_type, reason_text,
        profile_id, fingerprint, weight, is_flagged
    )
    VALUES (
        p_business_id, p_interaction_type,
        CASE WHEN p_reason_text IS NOT NULL AND TRIM(p_reason_text) <> ''
             THEN TRIM(p_reason_text) ELSE NULL END,
        p_profile_id, p_fingerprint, v_weight, p_is_flagged
    )
    RETURNING id, created_at INTO v_inserted_id, v_inserted_at;

    -- ── Award Gader points (verified users only) ─────────
    v_earned_points := GREATEST(5, LEAST(25, ROUND(v_weight * 10)));
    v_new_points := NULL;

    IF p_profile_id IS NOT NULL THEN
        UPDATE profiles
        SET gader_points = GREATEST(COALESCE(gader_points, 0) + v_earned_points, 0)
        WHERE id = p_profile_id
        RETURNING gader_points INTO v_new_points;

        -- ── Phase 4: Coupon Engine Logic ───────────────────
        IF v_new_points >= 50 THEN
            DECLARE
                v_weekly_logs INT;
                v_difficulty INT;
                v_coupons_this_week INT;
                v_threshold INT;
                v_selected_campaign_id UUID;
                v_business_name TEXT;
                v_discount_val NUMERIC;
                v_offer_type TEXT;
                v_serial TEXT;
            BEGIN
                SELECT weekly_log_count, coupon_difficulty_level, coupons_earned_this_week
                INTO v_weekly_logs, v_difficulty, v_coupons_this_week
                FROM profiles WHERE id = p_profile_id;

                -- Cap at 2 per week (Phase 4b)
                IF COALESCE(v_coupons_this_week, 0) < 2 THEN
                    v_threshold := 3 + COALESCE(v_difficulty, 1);

                    IF COALESCE(v_weekly_logs, 0) + 1 >= v_threshold THEN
                        -- Phase 4c & 4d: Find campaign with tier logic and prefer unvoted
                        SELECT mc.id, b.name, mc.discount_value, mc.offer_type
                        INTO v_selected_campaign_id, v_business_name, v_discount_val, v_offer_type
                        FROM merchant_coupons mc
                        JOIN businesses b ON b.id = mc.business_id
                        WHERE mc.status = 'active'
                          AND mc.remaining_quantity > 0
                          AND mc.distribution_rule = 'PUBLIC_POOL'
                          AND (
                              mc.target_tier = 'ALL' OR
                              (mc.target_tier = 'VIP_ONLY' AND v_new_points >= 20000) OR
                              (mc.target_tier = 'GOLD_ONLY' AND v_new_points >= 5000) OR
                              (mc.target_tier = 'SILVER_ONLY' AND v_new_points >= 1000) OR
                              (mc.target_tier = 'BRONZE_ONLY' AND v_new_points < 1000)
                          )
                        ORDER BY 
                          (EXISTS (SELECT 1 FROM logs l WHERE l.business_id = mc.business_id AND l.profile_id = p_profile_id)) ASC,
                          (EXISTS (SELECT 1 FROM user_coupons uc JOIN merchant_coupons mc2 ON uc.campaign_id = mc2.id WHERE mc2.business_id = mc.business_id AND uc.user_id = p_profile_id AND uc.status = 'REDEEMED')) ASC,
                          RANDOM()
                        LIMIT 1;

                        IF v_selected_campaign_id IS NOT NULL THEN
                            v_serial := generate_coupon_serial(v_business_name);
                            
                            INSERT INTO user_coupons (campaign_id, user_id, serial_code, source, status, valid_until)
                            VALUES (v_selected_campaign_id, p_profile_id, v_serial, 'POOL', 'ACTIVE', NOW() + INTERVAL '30 days');

                            UPDATE merchant_coupons 
                            SET remaining_quantity = remaining_quantity - 1,
                                claimed_count = COALESCE(claimed_count, 0) + 1
                            WHERE id = v_selected_campaign_id;

                            INSERT INTO coupon_audit_log (coupon_id, profile_id, business_id, serial_code, trigger_type, difficulty_level, weight_at_creation)
                            VALUES (v_selected_campaign_id, p_profile_id, p_business_id, v_serial, 'vote_reward', v_difficulty, v_weight);

                            UPDATE profiles SET
                                weekly_log_count = 0,
                                coupon_difficulty_level = COALESCE(coupon_difficulty_level, 1) + 1,
                                coupons_earned_this_week = COALESCE(coupons_earned_this_week, 0) + 1
                            WHERE id = p_profile_id;
                            
                            v_coupon_awarded := jsonb_build_object(
                                'campaign_id', v_selected_campaign_id, 
                                'serial', v_serial, 
                                'business', v_business_name,
                                'discount_value', v_discount_val,
                                'offer_type', v_offer_type
                            );
                        ELSE
                            UPDATE profiles SET weekly_log_count = COALESCE(weekly_log_count, 0) + 1 WHERE id = p_profile_id;
                        END IF;
                    ELSE
                        UPDATE profiles SET weekly_log_count = COALESCE(weekly_log_count, 0) + 1 WHERE id = p_profile_id;
                    END IF;
                ELSE
                    UPDATE profiles SET weekly_log_count = COALESCE(weekly_log_count, 0) + 1 WHERE id = p_profile_id;
                END IF;
            END;
        END IF;

    END IF;

    -- ── Return result ────────────────────────────────────
    RETURN jsonb_build_object(
        'success', true,
        'log_id', v_inserted_id,
        'created_at', v_inserted_at,
        'interaction_type', p_interaction_type,
        'reason_text', p_reason_text,
        'profile_id', p_profile_id,
        'fingerprint', p_fingerprint,
        'weight', v_weight,
        'is_flagged', p_is_flagged,
        'earned_points', v_earned_points,
        'new_gader_total', v_new_points,
        'past_vote_count', v_past_count,
        'coupon_awarded', v_coupon_awarded
    );
END;
$$;
