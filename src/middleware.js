import { NextResponse } from 'next/server'

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}

export async function middleware(request) {
    const url = request.nextUrl
    const hostname = request.headers.get('host') || ''

    // Define the main app domain (handle both localhost and production)
    const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1')

    // You might want to get this from env variables in a real app, e.g. process.env.NEXT_PUBLIC_ROOT_DOMAIN
    const rootDomain = isLocalhost ? 'localhost:3000' : (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'tagdeer.com')

    // Check if we are on a subdomain
    let currentHost = hostname.replace(`.${rootDomain}`, '')

    // For localhost, simple parsing
    if (isLocalhost) {
        if (hostname.startsWith('admin.')) {
            currentHost = 'admin'
        } else if (hostname.startsWith('merchant.') || hostname.startsWith('business.')) {
            currentHost = 'merchant'
        } else {
            currentHost = 'www' // default / main app
        }
    }

    const res = NextResponse.next()

    // Routing Logic
    // 1. Admin Subdomain
    if (currentHost === 'admin') {
        const newUrl = new URL(`/admin${url.pathname}`, request.url)
        return NextResponse.rewrite(newUrl)
    }

    // 2. Merchant Subdomain
    if (currentHost === 'merchant' || currentHost === 'business') {
        const newUrl = new URL(`/merchant${url.pathname}`, request.url)
        return NextResponse.rewrite(newUrl)
    }

    // 3. Main App (www or root) -> proceeds normally
    return res
}
