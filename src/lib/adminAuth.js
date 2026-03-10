import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * List of profile roles that grant admin access.
 * Must be kept in sync with the check-auth route and the admin middleware.
 */
const ADMIN_ROLES = ['super_admin', 'admin', 'assistant_admin', 'support_agent'];

/**
 * Verifies the admin_auth cookie and returns the admin's user ID and role.
 *
 * The admin_auth cookie stores the admin's profile UUID (not a boolean).
 * This function cross-references the UUID against the profiles table
 * to confirm the role is in the allowed ADMIN_ROLES list.
 *
 * Usage:
 *   import { verifyAdmin } from '@/lib/adminAuth';
 *   const admin = await verifyAdmin();
 *   if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *
 * @returns {Promise<{ id: string, role: string } | null>}
 */
export async function verifyAdmin() {
    try {
        const cookieStore = await cookies();
        const adminCookie = cookieStore.get('admin_auth');

        // Reject missing cookie or legacy 'true' format
        if (!adminCookie?.value || adminCookie.value === 'true') {
            return null;
        }

        const userId = adminCookie.value;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return null;
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (error || !profile || !ADMIN_ROLES.includes(profile.role)) {
            return null;
        }

        return { id: userId, role: profile.role };
    } catch {
        return null;
    }
}
