import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceKey) {
    console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY not configured for check-password API');
}

/**
 * In-memory sliding-window rate limiter.
 * Max 5 requests per IP per 60-second window.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map(); // Map<ip, number[]>

function isRateLimited(ip) {
    const now = Date.now();
    const timestamps = rateLimitMap.get(ip) || [];
    // Evict entries outside the window
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
        rateLimitMap.set(ip, recent);
        return true;
    }
    recent.push(now);
    rateLimitMap.set(ip, recent);
    return false;
}

// Periodic cleanup to prevent memory leaks (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of rateLimitMap) {
        const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        if (recent.length === 0) {
            rateLimitMap.delete(ip);
        } else {
            rateLimitMap.set(ip, recent);
        }
    }
}, 5 * 60_000);

/**
 * POST /api/merchant/check-password
 * Body: { email: string }
 * Returns: { hasPassword: boolean, userExists: boolean }
 *
 * Checks both the profiles.has_password flag and the Supabase auth identities
 * to determine if the user has a password set and whether the user exists.
 */
export async function POST(request) {
    try {
        // Rate limiting by IP
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
            || headersList.get('x-real-ip')
            || 'unknown';

        if (isRateLimited(ip)) {
            return Response.json(
                { hasPassword: false, userExists: false },
                { status: 429 }
            );
        }

        const { email } = await request.json();

        if (!email || typeof email !== 'string') {
            return Response.json({ hasPassword: false, userExists: false }, { status: 200 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 1. Check profile's has_password flag first (fast path)
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, has_password')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();

        // User doesn't exist in profiles at all
        if (!profile) {
            return Response.json({ hasPassword: false, userExists: false }, { status: 200 });
        }

        if (profile.has_password) {
            return Response.json({ hasPassword: true, userExists: true }, { status: 200 });
        }

        // 2. If flag is false/missing, check Supabase Auth identities (authoritative source)
        // This handles cases where password was set via Supabase directly but flag wasn't updated
        if (profile.id) {
            try {
                const { data: { user: authUser } } = await supabase.auth.admin.getUserById(profile.id);
                if (authUser?.identities) {
                    const hasEmailIdentity = authUser.identities.some(
                        i => i.provider === 'email' && i.identity_data?.sub
                    );
                    // If they have an email identity AND their encrypted_password is set
                    // (Supabase sets encrypted_password when user completes password flow)
                    if (hasEmailIdentity && authUser.encrypted_password && authUser.encrypted_password !== '') {
                        // Sync the flag for future fast lookups
                        await supabase.from('profiles').update({ has_password: true }).eq('id', profile.id);
                        return Response.json({ hasPassword: true, userExists: true }, { status: 200 });
                    }
                }
            } catch (adminErr) {
                console.error('Admin API check failed:', adminErr);
                // CRITICAL: If admin API fails, default to showing password step
                // rather than auto-sending magic link. The user can always click
                // "Send verification code" if they don't have a password.
                return Response.json({ hasPassword: true, userExists: true }, { status: 200 });
            }
        }

        return Response.json({ hasPassword: false, userExists: true }, { status: 200 });
    } catch (err) {
        console.error('check-password error:', err);
        return Response.json({ hasPassword: false, userExists: false }, { status: 200 });
    }
}
