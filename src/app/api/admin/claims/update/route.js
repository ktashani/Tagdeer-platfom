import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/claims/update
 * Updates a business claim status using the service role key (bypasses RLS).
 * Required because the admin portal uses cookie-based auth, preventing
 * client-side Supabase RPCs from passing the `auth.uid()` check inside Postgres.
 */
export async function POST(req) {
    try {
        // Verify admin cookie (stores admin's UUID)
        const cookieStore = await cookies();
        const adminCookie = cookieStore.get('admin_auth');
        if (!adminCookie?.value || adminCookie.value === 'true') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { claimId, status } = body;

        if (!claimId || !status) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        console.log(`[Admin] Updating claim ${claimId} to status: ${status}`);

        // Try the RPC first (which handles business publishing & role elevation for 'approved')
        const { error: rpcError } = await supabaseAdmin.rpc('admin_resolve_claim', {
            p_claim_id: claimId,
            p_status: status
        });

        if (rpcError) {
            // If the RPC throws because `auth.uid()` is null (since we are using service role without user session),
            // or if the RPC doesn't exist, fallback to manual direct updates

            console.warn("[Admin] RPC failed/skipped, falling back to manual update:", rpcError);

            // 1. Update the claim itself
            const { data: claim, error: claimError } = await supabaseAdmin
                .from('business_claims')
                .update({ status: status })
                .eq('id', claimId)
                .select('business_id, user_id')
                .single();

            if (claimError) throw claimError;

            // 2. If approved, process side-effects manually
            if (status === 'approved' && claim) {
                // Publish business
                await supabaseAdmin
                    .from('businesses')
                    .update({
                        claimed_by: claim.user_id,
                        status: 'published',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', claim.business_id);

                // Re-attempt to elevate role using the init-role RPC or direct update
                // The init_merchant_role handles the type casting issues with user_role
                await supabaseAdmin.rpc('init_merchant_role', {
                    p_user_id: claim.user_id
                });
            }
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error('Admin update claim exception:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
