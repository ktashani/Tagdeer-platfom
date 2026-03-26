import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/serverAuth';

/**
 * POST /api/merchant/set-password
 * Sets a password for the currently authenticated merchant.
 * Requires a valid Supabase session — the password is set for the session user's email only.
 *
 * Body: { password }
 */
export async function POST(req) {
    try {
        // Auth gate: require a valid Supabase session
        const sessionUser = await getServerUser();
        if (!sessionUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { password } = await req.json();

        if (!password) {
            return NextResponse.json({ error: 'Password is required' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // Update the authenticated user's password via admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            sessionUser.id,
            { password }
        );

        if (updateError) {
            console.error('Admin update password error:', updateError);
            return NextResponse.json({ error: 'Failed to set password' }, { status: 500 });
        }

        // Mark has_password = true in profiles
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ has_password: true })
            .eq('id', sessionUser.id);

        if (profileError) {
            console.error('Profile update error:', profileError);
            // Non-fatal — password was set successfully
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Set password exception:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
