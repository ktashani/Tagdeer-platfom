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
    const pathname = request.nextUrl.pathname

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

    // Routing Logic
    // 1. Admin Subdomain
    if (currentHost === 'admin') {
        // Exclude system paths, static files, and api from auth check
        if (!pathname.startsWith('/_next') && !pathname.includes('api')) {
            const authCookie = request.cookies.get('admin_auth');
            const isAuthenticated = authCookie && authCookie.value === 'true';

            // Redirect to login if not authenticated and trying to access protected route
            if (!isAuthenticated && pathname !== '/login') {
                const loginUrl = request.nextUrl.clone();
                loginUrl.pathname = '/login';
                return NextResponse.redirect(loginUrl);
            }

            // Redirect to dashboard if authenticated and trying to access login
            if (isAuthenticated && pathname === '/login') {
                const dashboardUrl = request.nextUrl.clone();
                dashboardUrl.pathname = '/';
                return NextResponse.redirect(dashboardUrl);
            }
        }

        // Ensure we don't double prefix if the path already starts with /admin
        const newPath = pathname.startsWith('/admin') ? pathname : `/admin${pathname}`
        const newUrl = new URL(newPath, request.url)
        return NextResponse.rewrite(newUrl)
    }

    // 2. Merchant Subdomain
    if (currentHost === 'merchant' || currentHost === 'business') {
        const newPath = pathname.startsWith('/merchant') ? pathname : `/merchant${pathname}`
        const newUrl = new URL(newPath, request.url)
        return NextResponse.rewrite(newUrl)
    }

    // 3. Main App (www or root) -> proceeds normally
    return NextResponse.next()
}
