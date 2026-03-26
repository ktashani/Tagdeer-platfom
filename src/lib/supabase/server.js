import { createServerClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for use in Next.js middleware.
 *
 * The middleware needs both getAll (to read cookies from the request)
 * and setAll (to write refreshed tokens to the response).
 *
 * @param {import('next/server').NextRequest} request
 * @param {import('next/server').NextResponse} response
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createMiddlewareClient(request, response) {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    // Set cookies on the request (for downstream server components)
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    // Set cookies on the response (for the browser)
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )
}

/**
 * Creates a Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. Read-only cookie access (no setAll) since Server
 * Components cannot write response headers.
 *
 * Use this when you need to check the user session on the server but
 * don't need to refresh tokens (the middleware handles that).
 *
 * @param {Function} cookieStore - The cookies() function from next/headers
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createServerComponentClient(cookieStore) {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
            },
        }
    )
}
