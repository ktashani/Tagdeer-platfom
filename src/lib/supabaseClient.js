import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ipjvgbxkouadovjqwncx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwanZnYnhrb3VhZG92anF3bmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTEwODgsImV4cCI6MjA4NzE4NzA4OH0._t52YKSYIjnqFmBycXEkmq3nJnXnVrKB0H3ZD8ju14s';

let supabaseInstance;

if (typeof window !== 'undefined') {
    if (!window.tagdeer_supabase) {
        window.tagdeer_supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storageKey: 'tagdeer-auth-v1', // Unique key to avoid conflicts with other local projects
                broadcast: false,              // Disable tab sync to prevent locking deadlocks
            }
        });
    }
    supabaseInstance = window.tagdeer_supabase;
} else {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseInstance;
