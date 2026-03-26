'use server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getCookieDomain } from '@/lib/cookieDomain'

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
        const domain = getCookieDomain()
        const cookieOptions = {
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        }
        // Only attach domain when deployed (undefined = browser defaults to exact hostname)
        if (domain) cookieOptions.domain = domain

        cookieStore.set('admin_auth', userId, cookieOptions)

        return { success: true }
    } catch (err) {
        console.error('Admin login error:', err)
        return { success: false, error: 'An unexpected error occurred.' }
    }
}

export async function logoutAdmin() {
    const cookieStore = await cookies()
    const domain = getCookieDomain()
    const deleteOptions = { path: '/' }
    if (domain) deleteOptions.domain = domain

    cookieStore.delete({ name: 'admin_auth', ...deleteOptions })
    // Important: The admin login page also signs in via Supabase client-side (supabase.auth.signInWithPassword).
    // The caller must also call supabase.auth.signOut() on the client to clear the Supabase session cookie.
    return { success: true }
}

