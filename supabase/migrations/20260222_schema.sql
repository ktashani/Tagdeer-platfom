-- Tagdeer Platform Database Schema
-- Created: 2026-02-22

-- Enable RLS
-- (JWT secret is managed by Supabase cloud, do not set manually)
-- Businesses Table
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    region TEXT NOT NULL CHECK (region IN ('Tripoli', 'Benghazi')),
    category TEXT NOT NULL,
    source TEXT DEFAULT 'Manual',
    external_url TEXT,
    is_shielded BOOLEAN DEFAULT FALSE,
    claimed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interactions/Logs Table
CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('recommend', 'complain')),
    reason_text TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    receipt_url TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-registrations Table
CREATE TABLE IF NOT EXISTS pre_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    business_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verified Users Table
CREATE TABLE IF NOT EXISTS verified_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT UNIQUE NOT NULL,
    verification_date TIMESTAMPTZ DEFAULT NOW(),
    loyalty_points INTEGER DEFAULT 0,
    is_business_owner BOOLEAN DEFAULT FALSE
);

-- Business Claims Table
CREATE TABLE IF NOT EXISTS business_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    claim_status TEXT DEFAULT 'pending' CHECK (claim_status IN ('pending', 'approved', 'rejected')),
    submitted_documents JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_businesses_region ON businesses(region);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_interactions_business_id ON interactions(business_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_pre_registrations_status ON pre_registrations(status);

-- Enable Row Level Security
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Businesses
CREATE POLICY "Allow public read access to businesses"
    ON businesses FOR SELECT
    TO PUBLIC
    USING (true);

CREATE POLICY "Allow authenticated users to insert businesses"
    ON businesses FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow business owners to update their businesses"
    ON businesses FOR UPDATE
    TO authenticated
    USING (claimed_by = auth.uid())
    WITH CHECK (claimed_by = auth.uid());

-- RLS Policies for Interactions
CREATE POLICY "Allow public read access to interactions"
    ON interactions FOR SELECT
    TO PUBLIC
    USING (true);

CREATE POLICY "Allow authenticated users to insert interactions"
    ON interactions FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow users to update their own interactions"
    ON interactions FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- RLS Policies for Pre-registrations
CREATE POLICY "Allow public insert to pre_registrations"
    ON pre_registrations FOR INSERT
    TO PUBLIC
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read pre_registrations"
    ON pre_registrations FOR SELECT
    TO authenticated
    USING (true);

-- RLS Policies for Verified Users
CREATE POLICY "Allow users to read their own verified profile"
    ON verified_users FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Allow users to update their own verified profile"
    ON verified_users FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- RLS Policies for Business Claims
CREATE POLICY "Allow users to read their own claims"
    ON business_claims FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Allow users to insert their own claims"
    ON business_claims FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for businesses updated_at
CREATE TRIGGER update_businesses_updated_at
    BEFORE UPDATE ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate business health score
CREATE OR REPLACE FUNCTION get_business_health_score(business_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    total_interactions INTEGER;
    recommends INTEGER;
    score INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_interactions
    FROM interactions
    WHERE business_id = business_uuid;
    
    SELECT COUNT(*) INTO recommends
    FROM interactions
    WHERE business_id = business_uuid AND interaction_type = 'recommend';
    
    IF total_interactions = 0 THEN
        RETURN 0;
    END IF;
    
    score := ROUND((recommends::FLOAT / total_interactions::FLOAT) * 100);
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Function to get business stats
CREATE OR REPLACE FUNCTION get_business_stats(business_uuid UUID)
RETURNS TABLE (
    total_votes BIGINT,
    recommends BIGINT,
    complains BIGINT,
    health_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_votes,
        COUNT(*) FILTER (WHERE interaction_type = 'recommend')::BIGINT as recommends,
        COUNT(*) FILTER (WHERE interaction_type = 'complain')::BIGINT as complains,
        CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND((COUNT(*) FILTER (WHERE interaction_type = 'recommend')::FLOAT / COUNT(*)::FLOAT) * 100)::INTEGER
        END as health_score
    FROM interactions
    WHERE business_id = business_uuid;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data
INSERT INTO businesses (name, region, category, source, is_shielded) VALUES
    ('Al-Madina Tech', 'Tripoli', 'Electronics', 'Google', true),
    ('Benghazi Builders Co.', 'Benghazi', 'Construction', 'Facebook', false),
    ('Tripoli Central Clinic', 'Tripoli', 'Healthcare', 'Google', true),
    ('Omar''s Auto Repair', 'Benghazi', 'Automotive', 'Manual', false),
    ('Sahara Logistics', 'Tripoli', 'Services', 'Google', true)
ON CONFLICT DO NOTHING;
