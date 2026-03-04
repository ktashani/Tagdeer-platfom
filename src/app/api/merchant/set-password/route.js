import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * POST /api/merchant/set-password
 * Sets a password for a merchant using the admin API.
 * This works even without an active Supabase Auth session (e.g. after WhatsApp OTP login).
 * 
 * Body: { email, password }
 */
export async function POST(req) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
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

        // 1. Find the user by email
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) {
            console.error('Admin list users error:', listError);
            return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 });
        }

        const authUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (!authUser) {
            // User doesn't exist in Auth yet — create them
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: email.toLowerCase(),
                password,
                email_confirm: true, // Auto-confirm since they're already verified via OTP
            });

            if (createError) {
                console.error('Create user error:', createError);
                return NextResponse.json({ error: createError.message }, { status: 500 });
            }

            // Link the new auth user to the existing profile
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({ has_password: true })
                .eq('email', email.toLowerCase());

            if (profileError) {
                console.error('Profile update error:', profileError);
            }

            return NextResponse.json({ success: true, created: true });
        }

        // 2. User exists — update their password via admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            authUser.id,
            { password }
        );

        if (updateError) {
            console.error('Admin update password error:', updateError);
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // 3. Mark has_password = true in profiles
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ has_password: true })
            .eq('id', authUser.id);

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
