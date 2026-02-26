-- Tagdeer: RLS Policies for profiles and logs tables
-- Created: 2026-02-26
-- NOTE: Run this manually in Supabase SQL Editor (Dashboard → SQL → New Query)

-- ═══════════════════════════════════════════════
-- Step 1: Enable RLS on both tables
-- ═══════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════
-- Step 2: Profiles table policies
-- ═══════════════════════════════════════════════

-- Anon key can read profiles (needed for login phone lookup)
CREATE POLICY "anon_read_profiles"
    ON profiles FOR SELECT TO anon
    USING (true);

-- Anon key can insert new profiles (needed for registration)
CREATE POLICY "anon_insert_profiles"
    ON profiles FOR INSERT TO anon
    WITH CHECK (true);

-- Authenticated users can read their own profile
CREATE POLICY "auth_read_own_profile"
    ON profiles FOR SELECT TO authenticated
    USING (true);

-- Authenticated users can update their own profile
CREATE POLICY "auth_update_own_profile"
    ON profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ═══════════════════════════════════════════════
-- Step 3: Logs table policies
-- ═══════════════════════════════════════════════

-- Authenticated users can read their own logs
CREATE POLICY "auth_read_own_logs"
    ON logs FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

-- Authenticated users can insert logs
CREATE POLICY "auth_insert_logs"
    ON logs FOR INSERT TO authenticated
    WITH CHECK (true);

-- Public can read logs (needed for business detail pages)
CREATE POLICY "public_read_logs"
    ON logs FOR SELECT TO anon
    USING (true);
