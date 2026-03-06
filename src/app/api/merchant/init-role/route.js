import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * POST /api/merchant/init-role
 * Elevates a newly verified user's role to 'merchant' if they logged in
 * via the merchant portal flow.
 * 
 * Uses a SECURITY DEFINER PostgreSQL function (init_merchant_role) to properly
 * cast text → user_role enum, which the Supabase JS client cannot do via PostgREST.
 */
export async function POST(req) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // Use the auth token from the incoming request's header
        const authHeader = req.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized payload' }, { status: 401 });
        }

        // Call the PostgreSQL function that properly handles enum casting
        const { data, error: rpcError } = await supabaseAdmin.rpc('init_merchant_role', {
            p_user_id: user.id,
            p_email: user.email || null,
            p_phone: user.phone || null
        });

        if (rpcError) {
            console.error('init_merchant_role RPC failed:', rpcError);
            return NextResponse.json({
                error: `RPC Error: ${rpcError.message || JSON.stringify(rpcError)}`
            }, { status: 500 });
        }

        console.log('init_merchant_role result:', data);
        return NextResponse.json({ success: true, role: 'merchant', detail: data });
    } catch (err) {
        console.error('Init role exception:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
