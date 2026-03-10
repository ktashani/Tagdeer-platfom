import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file.'
    );
}

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
