'use server'
import { cookies } from 'next/headers'

export async function loginAdmin(username, password) {
    if (username === 'admin' && password === 'admin') {
        const cookieStore = await cookies()
        cookieStore.set('admin_auth', 'true', {
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
        })
        return { success: true }
    }
    return { success: false, error: 'Invalid credentials. Use admin/admin.' }
}

export async function logoutAdmin() {
    const cookieStore = await cookies()
    cookieStore.delete('admin_auth')
    return { success: true }
}
