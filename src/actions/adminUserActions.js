'use server'

import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase admin client using the service role key.
 * This bypasses RLS and auth.uid() — ONLY for verified admin actions.
 */
function getAdminSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
    }

    return createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    })
}

/**
 * Verifies the admin cookie before executing any admin action.
 */
async function verifyAdmin() {
    const cookieStore = await cookies()
    const adminCookie = cookieStore.get('admin_auth')
    if (!adminCookie || adminCookie.value !== 'true') {
        throw new Error('Unauthorized: Admin session invalid')
    }
}

/**
 * Update user status (Active/Restricted/Banned) with merchant business cascade
 */
export async function adminUpdateUserStatus(userId, role, newStatus) {
    await verifyAdmin()
    const supabase = getAdminSupabase()

    // Update the user profile status
    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            role: role,
            status: newStatus
        })
        .eq('id', userId)

    if (profileError) {
        return { error: profileError.message || 'Failed to update profile status' }
    }

    // Cascade to merchant businesses
    if (newStatus === 'Banned') {
        await supabase
            .from('businesses')
            .update({ status: 'hidden' })
            .eq('claimed_by', userId)
    } else if (newStatus === 'Restricted') {
        await supabase
            .from('businesses')
            .update({ status: 'restricted', restriction_reason: 'Owner account restricted by admin' })
            .eq('claimed_by', userId)
    } else if (newStatus === 'Active') {
        // Reactivated: set to pending_review where currently hidden/restricted
        await supabase
            .from('businesses')
            .update({ status: 'pending_review', restriction_reason: null })
            .eq('claimed_by', userId)
            .in('status', ['hidden', 'restricted'])
    }

    return { success: true }
}

/**
 * Adjust user gader (trust) points
 */
export async function adminManageUserGader(userId, amount, reason) {
    await verifyAdmin()
    const supabase = getAdminSupabase()

    // First get current points
    const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('gader_points')
        .eq('id', userId)
        .single()

    if (fetchError) {
        return { error: fetchError.message || 'Failed to fetch user profile' }
    }

    const newPoints = Math.max((profile.gader_points || 0) + amount, 0)

    const { error: updateError } = await supabase
        .from('profiles')
        .update({ gader_points: newPoints })
        .eq('id', userId)

    if (updateError) {
        return { error: updateError.message || 'Failed to update points' }
    }

    return { success: true, newPoints }
}

/**
 * Purge user data (anti-cheat action)
 */
export async function adminPurgeUser(userId) {
    await verifyAdmin()
    const supabase = getAdminSupabase()

    // Delete interactions
    await supabase.from('interactions').delete().eq('created_by', userId)
    // Delete logs
    await supabase.from('logs').delete().eq('profile_id', userId)
    // Delete votes
    await supabase.from('log_votes').delete().eq('profile_id', userId)
    // Reset trust points
    await supabase.from('profiles').update({ gader_points: 0 }).eq('id', userId)

    return { success: true }
}

/**
 * Update user profile info (name, email, phone)
 */
export async function adminUpdateUserInfo(userId, fullName, email, phone) {
    await verifyAdmin()
    const supabase = getAdminSupabase()

    const { error } = await supabase
        .from('profiles')
        .update({
            full_name: fullName,
            email: email,
            phone: phone
        })
        .eq('id', userId)

    if (error) {
        return { error: error.message || 'Failed to update user info' }
    }

    return { success: true }
}
