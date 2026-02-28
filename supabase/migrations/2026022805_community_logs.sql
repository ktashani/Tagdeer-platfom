-- ==============================================================
-- PHASE 6: Community Logs & Verification
-- Adds community up/down voting to logs and automated rewards.
-- ==============================================================

-- 1. Add Vote Tracking columns to the `logs` table
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS helpful_votes INT DEFAULT 0;
ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS unhelpful_votes INT DEFAULT 0;

-- 1b. Ensure `gader_points` can handle decimal math
ALTER TABLE public.profiles ALTER COLUMN gader_points TYPE NUMERIC(10,2);

-- 2. Create `log_votes` table to prevent double voting
CREATE TABLE IF NOT EXISTS public.log_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id BIGINT NOT NULL REFERENCES public.logs(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    fingerprint TEXT, -- for anonymous voters
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure a user/fingerprint can only vote once per log
    CONSTRAINT unique_vote_per_profile UNIQUE (log_id, profile_id),
    CONSTRAINT unique_vote_per_fingerprint UNIQUE (log_id, fingerprint)
);

-- Enable RLS on log_votes
ALTER TABLE public.log_votes ENABLE ROW LEVEL SECURITY;

-- Everyone can read log votes
CREATE POLICY "Public Read log_votes" ON public.log_votes FOR SELECT USING (true);

-- Users can insert their own votes (backend handled or RLS checked)
CREATE POLICY "Users can insert log_votes" ON public.log_votes FOR INSERT WITH CHECK (
    auth.uid() = profile_id OR fingerprint IS NOT NULL
);

-- 3. Trigger to Update Log Totals and Award Points
-- When a vote is cast, we update the helpful/unhelpful counts on the 'logs' row.
-- Furthermore, if the vote is successfully placed, the author of the log receives +0.5 Gader points.

CREATE OR REPLACE FUNCTION handle_log_vote_interaction()
RETURNS trigger AS $$
DECLARE
    target_author_id UUID;
    current_gader_points NUMERIC;
BEGIN
    -- Update the counts on the logs table
    IF NEW.vote_type = 'up' THEN
        UPDATE public.logs SET helpful_votes = helpful_votes + 1 WHERE id = NEW.log_id RETURNING profile_id INTO target_author_id;
    ELSIF NEW.vote_type = 'down' THEN
        UPDATE public.logs SET unhelpful_votes = unhelpful_votes + 1 WHERE id = NEW.log_id RETURNING profile_id INTO target_author_id;
    END IF;

    -- Award 0.25 points to the author (if the log was written by a registered user)
    IF target_author_id IS NOT NULL THEN
        -- Fetch current points
        SELECT gader_points INTO current_gader_points FROM public.profiles WHERE id = target_author_id;
        
        -- Update profiles
        UPDATE public.profiles 
        SET gader_points = COALESCE(current_gader_points, 0) + 0.25
        WHERE id = target_author_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_log_vote
AFTER INSERT ON public.log_votes
FOR EACH ROW
EXECUTE FUNCTION handle_log_vote_interaction();
