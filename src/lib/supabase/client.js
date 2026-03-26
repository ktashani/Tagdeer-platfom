import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for use in browser (Client Components).
 *
 * Uses @supabase/ssr's createBrowserClient which stores auth sessions
 * in COOKIES instead of localStorage. This makes sessions visible to
 * the Next.js middleware for server-side auth enforcement.
 *
 * This is a singleton — calling it multiple times returns the same instance.
 */
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
}
