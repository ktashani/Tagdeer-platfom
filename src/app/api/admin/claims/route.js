import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPresignedViewUrl } from '@/app/actions/storage';

/**
 * GET /api/admin/claims
 * Fetches all business claims using the service role key (bypasses RLS).
 * The admin portal uses cookie-based auth, so the regular Supabase client
 * can't access claims due to RLS policies that require auth.uid().
 */
export async function GET() {
    try {
        // Verify admin cookie (stores admin's UUID, not 'true')
        const cookieStore = await cookies();
        const adminCookie = cookieStore.get('admin_auth');
        if (!adminCookie?.value || adminCookie.value === 'true') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // Fetch all claims
        const { data: claims, error: claimsError } = await supabaseAdmin
            .from('business_claims')
            .select('*')
            .order('created_at', { ascending: false });

        if (claimsError) {
            console.error('Error fetching claims:', claimsError);
            return NextResponse.json({ error: claimsError.message }, { status: 500 });
        }

        // Add secure presigned URLs to claims
        const claimsWithUrls = await Promise.all((claims || []).map(async (c) => {
            let documentUrl = c.document_url;
            if (documentUrl && !documentUrl.startsWith('http')) {
                try {
                    const { viewUrl } = await getPresignedViewUrl({ objectKey: documentUrl });
                    documentUrl = viewUrl;
                } catch (e) {
                    console.error('Failed to presign URL for', documentUrl, e);
                }
            }
            return { ...c, document_url: documentUrl };
        }));

        // Fetch associated profiles
        const userIds = [...new Set((claimsWithUrls || []).map(c => c.user_id).filter(Boolean))];
        let profiles = [];
        if (userIds.length > 0) {
            const { data } = await supabaseAdmin
                .from('profiles')
                .select('id, phone, email, full_name')
                .in('id', userIds);
            profiles = data || [];
        }

        return NextResponse.json({ claims: claimsWithUrls || [], profiles });
    } catch (err) {
        console.error('Admin claims exception:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
