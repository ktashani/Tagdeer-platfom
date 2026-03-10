-- ============================================================
-- OTP Rate Limiting
-- Prevents brute-force OTP verification and WhatsApp cost attacks.
-- ============================================================

-- Table to track OTP request rates per phone number
CREATE TABLE IF NOT EXISTS otp_rate_limits (
    phone TEXT NOT NULL,
    action TEXT NOT NULL,             -- 'send' or 'verify'
    attempt_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (phone, action)
);

-- Enable RLS (deny all by default — only service role should access this)
ALTER TABLE otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- RPC to check and increment rate limit
-- Returns TRUE if the request is allowed, FALSE if rate-limited.
CREATE OR REPLACE FUNCTION check_otp_rate_limit(
    p_phone TEXT,
    p_action TEXT,
    p_max_attempts INTEGER,
    p_window_minutes INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record otp_rate_limits%ROWTYPE;
BEGIN
    -- Delete expired windows for this phone+action
    DELETE FROM otp_rate_limits
    WHERE phone = p_phone
      AND action = p_action
      AND window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL;

    -- Check current window
    SELECT * INTO v_record
    FROM otp_rate_limits
    WHERE phone = p_phone AND action = p_action;

    IF v_record IS NULL THEN
        -- First attempt in this window — insert and allow
        INSERT INTO otp_rate_limits (phone, action, attempt_count, window_start)
        VALUES (p_phone, p_action, 1, NOW());
        RETURN TRUE;
    END IF;

    IF v_record.attempt_count >= p_max_attempts THEN
        -- Rate limit exceeded
        RETURN FALSE;
    END IF;

    -- Increment counter and allow
    UPDATE otp_rate_limits
    SET attempt_count = attempt_count + 1
    WHERE phone = p_phone AND action = p_action;

    RETURN TRUE;
END;
$$;
