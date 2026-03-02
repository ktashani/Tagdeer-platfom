import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * POST /api/merchant/check-password
 * Body: { email: string }
 * Returns: { hasPassword: boolean }
 *
 * Security: Only returns true/false — never confirms if email exists.
 * If email not found, returns { hasPassword: false } to prevent enumeration.
 */
export async function POST(request) {
    try {
        const { email } = await request.json();

        if (!email || typeof email !== 'string') {
            return Response.json({ hasPassword: false }, { status: 200 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Look up the profile by matching the email from auth.users → profiles
        // We query profiles joined with the email from the request
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('has_password')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();

        if (error || !profile) {
            // Don't reveal whether account exists
            return Response.json({ hasPassword: false }, { status: 200 });
        }

        return Response.json({ hasPassword: !!profile.has_password }, { status: 200 });
    } catch (err) {
        console.error('check-password error:', err);
        return Response.json({ hasPassword: false }, { status: 200 });
    }
}
