import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * POST /api/merchant/check-password
 * Body: { email: string }
 * Returns: { hasPassword: boolean }
 *
 * Checks both the profiles.has_password flag and the Supabase auth identities
 * to determine if the user has a password set.
 */
export async function POST(request) {
    try {
        const { email } = await request.json();

        if (!email || typeof email !== 'string') {
            return Response.json({ hasPassword: false }, { status: 200 });
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

        if (profile?.has_password) {
            return Response.json({ hasPassword: true }, { status: 200 });
        }

        // 2. If flag is false/missing, check Supabase Auth identities (authoritative source)
        // This handles cases where password was set via Supabase directly but flag wasn't updated
        if (profile?.id) {
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
                        return Response.json({ hasPassword: true }, { status: 200 });
                    }
                }
            } catch (adminErr) {
                console.error('Admin API check failed:', adminErr);
                // Fall through to return false
            }
        }

        return Response.json({ hasPassword: false }, { status: 200 });
    } catch (err) {
        console.error('check-password error:', err);
        return Response.json({ hasPassword: false }, { status: 200 });
    }
}
