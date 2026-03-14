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
    console.log('[check-auth] admin_auth cookie:', adminAuth ? `value="${adminAuth.value.substring(0, 8)}..."` : 'NOT FOUND')

    if (!adminAuth?.value || adminAuth.value === 'true') {
        console.warn('[check-auth] REJECTED — cookie missing or old format')
        return NextResponse.json({ authenticated: false })
    }

    const userId = adminAuth.value
    console.log('[check-auth] Looking up profile for userId:', userId.substring(0, 8) + '...')

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

        console.log('[check-auth] Profile lookup result:', { role: profile?.role, error: error?.message })

        const ADMIN_ROLES = ['super_admin', 'admin', 'assistant_admin', 'support_agent'];
        if (error || !profile || !ADMIN_ROLES.includes(profile.role)) {
            console.warn('[check-auth] REJECTED — role:', profile?.role, 'not in ADMIN_ROLES')
            return NextResponse.json({ authenticated: false })
        }

        return NextResponse.json({ authenticated: true, user: { id: userId, role: profile.role } })
    } catch {
        return NextResponse.json({ authenticated: false })
    }
}
