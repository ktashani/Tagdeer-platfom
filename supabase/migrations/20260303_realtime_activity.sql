-- Enable Supabase Realtime for community activity
-- This allows clients to listen to live "likes" and new logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.log_votes;
