-- ============================================================
-- Anonymous Vote Tracking
-- Enforces vote limits for unauthenticated users using
-- IP address + device fingerprint hashing.
-- ============================================================

CREATE TABLE IF NOT EXISTS anonymous_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint_hash TEXT NOT NULL,
    ip_address INET,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('recommend', 'complain')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fingerprint lookups (primary limit enforcement)
CREATE INDEX IF NOT EXISTS idx_anon_votes_fingerprint ON anonymous_votes(fingerprint_hash);

-- Index for IP lookups (secondary limit enforcement)
CREATE INDEX IF NOT EXISTS idx_anon_votes_ip ON anonymous_votes(ip_address);

-- Enable RLS (deny all by default — only service role should access this)
ALTER TABLE anonymous_votes ENABLE ROW LEVEL SECURITY;

-- RPC: Check if an anonymous user has exceeded the vote limit.
-- Returns TRUE if the vote is allowed, FALSE if rate-limited.
CREATE OR REPLACE FUNCTION check_anonymous_vote_limit(
    p_fingerprint TEXT,
    p_ip TEXT,
    p_max_votes INTEGER DEFAULT 3,
    p_window_days INTEGER DEFAULT 7
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM anonymous_votes
    WHERE (fingerprint_hash = p_fingerprint OR ip_address = p_ip::INET)
      AND created_at > NOW() - (p_window_days || ' days')::INTERVAL;

    RETURN v_count < p_max_votes;
END;
$$;
