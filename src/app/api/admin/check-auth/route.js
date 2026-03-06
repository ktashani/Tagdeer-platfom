import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/check-auth
 * Validates the admin_auth cookie contains a valid admin user ID
 * and cross-references against the profiles table.
 */
export async function GET() {
    const cookieStore = await cookies()
    const adminAuth = cookieStore.get('admin_auth')

    if (!adminAuth?.value || adminAuth.value === 'true') {
        // 'true' is the old format — force re-login
        return NextResponse.json({ authenticated: false })
    }

    const userId = adminAuth.value
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ authenticated: false })
    }

    try {
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single()

        const ADMIN_ROLES = ['super_admin', 'admin', 'assistant_admin', 'support_agent'];
        if (error || !profile || !ADMIN_ROLES.includes(profile.role)) {
            return NextResponse.json({ authenticated: false })
        }

        return NextResponse.json({ authenticated: true, user: { id: userId, role: profile.role } })
    } catch {
        return NextResponse.json({ authenticated: false })
    }
}
