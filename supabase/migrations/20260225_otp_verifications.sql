-- Phase 9.1: OTP Verifications table for Meta WhatsApp Cloud API
-- This table stores pending and completed OTP codes

CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Only one active OTP per phone number
    CONSTRAINT uq_otp_phone UNIQUE (phone)
);

-- Index for efficient cleanup of expired OTPs
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_verifications (expires_at);

-- Comment
COMMENT ON TABLE otp_verifications IS 'Stores 6-digit OTP codes sent via Meta WhatsApp Cloud API for phone verification';
