'use server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/**
 * Admin login — validates credentials against Supabase Auth,
 * then verifies the user has role='admin' in the profiles table.
 */
export async function loginAdmin(email, password) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
        return { success: false, error: 'Server configuration error. Missing SUPABASE_SERVICE_ROLE_KEY.' }
    }

    // Use the anon client for signin (so it goes through normal auth)
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })

    // Admin client for profile role check
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })

    try {
        // 1. Authenticate with Supabase Auth
        const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
            email,
            password,
        })

        if (authError) {
            return { success: false, error: 'Invalid email or password.' }
        }

        const userId = authData.user?.id
        if (!userId) {
            return { success: false, error: 'Authentication failed.' }
        }

        // 2. Verify role is 'admin' in profiles table
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single()

        if (profileError || !profile) {
            return { success: false, error: 'Profile not found. Contact support.' }
        }

        const ADMIN_ROLES = ['super_admin', 'admin', 'assistant_admin', 'support_agent'];
        if (!ADMIN_ROLES.includes(profile.role)) {
            return { success: false, error: 'Access denied. This account does not have admin privileges.' }
        }

        // 3. Set secure admin cookie with the user ID (not just 'true')
        const cookieStore = await cookies()
        cookieStore.set('admin_auth', userId, {
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        })

        return { success: true }
    } catch (err) {
        console.error('Admin login error:', err)
        return { success: false, error: 'An unexpected error occurred.' }
    }
}

export async function logoutAdmin() {
    const cookieStore = await cookies()
    cookieStore.delete('admin_auth')
    return { success: true }
}
