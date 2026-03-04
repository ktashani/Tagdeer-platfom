import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
    const cookieStore = await cookies()
    const adminAuth = cookieStore.get('admin_auth')
    const authenticated = adminAuth?.value === 'true'
    return NextResponse.json({ authenticated })
}
