import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file.'
    );
}

/**
 * Supabase browser client — powered by @supabase/ssr.
 *
 * SESSION PERSISTENCE: Stores auth tokens in COOKIES (not localStorage).
 * This makes sessions visible to the Next.js middleware for server-side
 * auth enforcement. The cookie name follows the Supabase convention:
 * sb-<project-ref>-auth-token
 *
 * SINGLETON: createBrowserClient returns the same instance on repeat calls.
 * The window.tagdeer_supabase guard is kept for backward compatibility with
 * any code that references it directly.
 *
 * COOKIE DOMAIN: On staging/production with subdomains, the cookies are
 * automatically scoped by the browser. Since merchant.staging.tagdeer.app
 * and admin.staging.tagdeer.app are different origins, the browser isolates
 * their cookies naturally.
 *
 * IMPORTANT: The admin portal uses a SEPARATE auth mechanism (admin_auth
 * httpOnly cookie set by the loginAdmin server action). This Supabase SSR
 * client is primarily for the merchant and consumer portals.
 */
let supabaseInstance;

if (typeof window !== 'undefined') {
    if (!window.tagdeer_supabase) {
        window.tagdeer_supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    }
    supabaseInstance = window.tagdeer_supabase;
} else {
    // Server-side fallback — should NOT be used for auth operations.
    // For server-side auth, use createMiddlewareClient or createServerComponentClient
    // from '@/lib/supabase/server'.
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseInstance;
