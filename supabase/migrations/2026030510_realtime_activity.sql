-- Enable Supabase Realtime for community activity
-- This allows clients to listen to live "likes" and new logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'log_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.log_votes;
  END IF;
END $$;
