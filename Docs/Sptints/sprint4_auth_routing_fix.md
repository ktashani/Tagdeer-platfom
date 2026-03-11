# Sprint 4 — Authentication Flow Stabilization Specification

**Author:** Lead Systems & Frontend Architect
**Date:** 2026-03-11
**Severity:** 🔴 P0 — Production-Blocking Regressions
**Target Branch:** `refactor-nextjs-phase2`

---

## Executive Summary

The staging environment has two critical authentication regressions:

| Issue | Symptom | Subdomain |
|---|---|---|
| **Merchant Login Hang** | Login page flashes, spinner hangs indefinitely. Console logs `SIGNED_IN` but redirect fails. | `merchant.staging.tagdeer.app` |
| **Admin Portal Instability** | Dashboard doesn't load after login. Requires 2-3 manual browser refreshes. | `admin.staging.tagdeer.app` |

Both issues stem from a **session storage mismatch**: the Supabase JS client stores sessions in `localStorage` while the middleware checks for auth **cookies** that never exist. The fix replaces the ad-hoc Supabase client with the official `@supabase/ssr` package (already installed at v0.9.0) which stores sessions in **cookies** — making them visible to both the middleware and the server.

---

## Part 1: Root Cause Analysis

### 1.1 The Core Architectural Mismatch

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER                                    │
│                                                                    │
│  ┌─────────────────┐    ┌───────────────────────────┐            │
│  │ Supabase JS SDK │    │ admin_auth httpOnly Cookie │            │
│  │ (localStorage)  │    │ (set by Server Action)     │            │
│  │                 │    │                             │            │
│  │ Key:            │    │ Domain: .staging.tagdeer.app│            │
│  │ tagdeer-auth-v1 │    │ Path: /                     │            │
│  └────────┬────────┘    └──────────────┬──────────────┘            │
│       CLIENT ONLY                  SERVER VISIBLE                  │
│           │                            │                           │
└───────────┼────────────────────────────┼───────────────────────────┘
            │                            │
            ▼                            ▼
┌───────────────────────┐  ┌────────────────────────────┐
│ AuthProvider.jsx      │  │ middleware.js               │
│ checkInitialSession() │  │                              │
│ → supabase.auth       │  │ Merchant: checks for sb-*   │
│   .getSession()       │  │   -auth-token COOKIE         │
│ → reads from          │  │   ❌ NEVER EXISTS            │
│   localStorage        │  │                              │
│                       │  │ Admin: checks for            │
│ MerchantGuard:        │  │   admin_auth COOKIE           │
│ → waits for           │  │   ✅ EXISTS (server action)   │
│   context.user        │  │                              │
└───────────────────────┘  └────────────────────────────┘
```

**The smoking gun:** `supabaseClient.js` (line 17-25) uses `createClient` from `@supabase/supabase-js` with `persistSession: true`. This stores tokens in **localStorage** (key: `tagdeer-auth-v1`). It does NOT set any cookies.

Meanwhile, `middleware.js` (line 80) checks for auth by looking for cookies matching `sb-*-auth-token`. **This cookie never exists**, so the middleware always considers the merchant unauthenticated.

### 1.2 Issue 1 — Merchant Login Hang (Infinite Redirect Loop)

```
T0: User clicks "Sign In"
    └─ supabase.auth.signInWithPassword() → session in localStorage ✅
    └─ onAuthStateChange SIGNED_IN → syncUserProfile → user.role = 'merchant'

T1: useEffect fires → window.location.href = '/dashboard' (FULL PAGE RELOAD)
    └─ React tree destroyed. All in-memory state gone.

T2: middleware.js runs on NEW request to /dashboard
    └─ Checks cookies for sb-*-auth-token → ❌ NONE (localStorage isn't cookies)
    └─ isAuthenticated = false → REDIRECT to /login

T3: /login loads → AuthProvider reads localStorage → session found ✅
    └─ user.role = 'merchant' → window.location.href = '/dashboard'
    └─ 🔁 BACK TO T2 — INFINITE LOOP

Result: Flash + spinner hang
```

### 1.3 Issue 2 — Admin Portal Instability (Stale Session Race)

```
T0: User clicks "Authenticate"
    └─ Step 1: loginAdmin() server action → sets admin_auth cookie ✅
    └─ Step 2: supabase.auth.signInWithPassword() STARTS (async, ~200-500ms)
    └─ Step 3: window.location.href fires IMMEDIATELY after Step 1 returns
    └─ ❌ Step 2 may not have persisted session to localStorage yet

T1: New page loads
    └─ middleware: admin_auth cookie present → ✅ page allowed
    └─ AdminGuard: /api/admin/check-auth → ✅ cookie valid
    └─ AuthProvider: supabase.auth.getSession() → ❓ 50/50 localStorage has session
    └─ Components using useTagdeer().user → may get null → broken UI

T2-T3: Manual refreshes → eventually localStorage populates → works
```

### 1.4 Contributing Factor: Context Mount Waterfall

```
RootLayout → TagdeerProvider → AuthProvider (async getSession)
  → BusinessDataProvider (async DB, waits for user)
    → UIProvider → TagdeerBridge → PortalsLayout → Guard → Page
```

3+ sequential async operations = 1-2 seconds of loading before content appears.

---

## Part 2: Solution Architecture

### The Fix: Migrate to `@supabase/ssr` Cookie-Based Sessions

The already-installed `@supabase/ssr` v0.9.0 package provides:
- `createBrowserClient` — replaces `createClient` from `@supabase/supabase-js`, stores sessions in **cookies** instead of localStorage
- `createServerClient` — creates a Supabase client in middleware/server contexts that reads session cookies from the request

After this migration:
1. The browser client writes session tokens to **cookies** (domain-scoped, visible to the server)
2. The middleware creates a server client that reads those same cookies — **real** authentication checks
3. The middleware also refreshes expired tokens and writes updated cookies back to the response
4. No more localStorage ↔ cookie mismatch

```
AFTER FIX:
┌──────────────────────────────────────────────────────┐
│  Browser: createBrowserClient (@supabase/ssr)        │
│  └─ Sessions stored in COOKIES (sb-*-auth-token)     │
│     └─ Domain: .staging.tagdeer.app (shared)         │
│                                                       │
│  + admin_auth cookie (unchanged, for admin portal)    │
└───────────────────────────┬──────────────────────────┘
                            │  BOTH visible to server
                            ▼
┌──────────────────────────────────────────────────────┐
│  middleware.js: createServerClient (@supabase/ssr)    │
│  └─ Reads sb-* cookies → validates session           │
│  └─ Refreshes expired tokens → writes updated cookie │
│  └─ Admin: also checks admin_auth cookie (unchanged) │
└──────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Coexistence with admin_auth:** The admin portal continues to use its own `admin_auth` httpOnly cookie set by the `loginAdmin` server action. The `@supabase/ssr` cookies coexist alongside it. The admin middleware block checks `admin_auth` first (unchanged). The merchant middleware block checks the Supabase SSR session cookies.

---

## Part 3: Execution Specification

> [!CAUTION]
> **STRICT EXECUTION RULES FOR WORKER AGENT**
>
> 1. **No Deviation:** Follow this specification exactly. Do not invent alternative solutions, "optimize" the approach, or skip steps.
> 2. **No Backend Auth Changes:** Do NOT modify `src/lib/adminAuth.js`, `src/actions/adminAuth.js`, `src/app/api/admin/check-auth/route.js`, or `src/lib/cookieDomain.js`. The admin auth security logic is CORRECT and must remain UNTOUCHED.
> 3. **No Context Refactor:** Do NOT split `TagdeerProvider`, create new providers, or restructure the context architecture.
> 4. **No New Dependencies:** `@supabase/ssr` v0.9.0 and `@supabase/supabase-js` v2.49.1 are already installed. Do NOT install anything new.
> 5. **Code Quality:** Production-grade code. Explicit checks, not loose truthiness. Comments explaining WHY, not WHAT.
> 6. **Test Before Declaring Done:** Run `npx vitest run` and `npm run build`. Both must succeed with zero errors.
> 7. **Branch:** All work on branch `refactor-nextjs-phase2`.

---

### TASK 1: Create Supabase SSR Utility Files

Create two new utility files that wrap `@supabase/ssr` for browser and middleware use.

#### [NEW] `src/lib/supabase/client.js`

This replaces the direct use of `createClient` from `@supabase/supabase-js` with the SSR-aware `createBrowserClient`.

```javascript
import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for use in browser (Client Components).
 *
 * Uses @supabase/ssr's createBrowserClient which stores auth sessions
 * in COOKIES instead of localStorage. This makes sessions visible to
 * the Next.js middleware for server-side auth enforcement.
 *
 * This is a singleton — calling it multiple times returns the same instance.
 */
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
}
```

> [!NOTE]
> `createBrowserClient` from `@supabase/ssr` is a singleton by default — multiple calls return the same instance. It automatically stores auth tokens in cookies with the proper `sb-<project-ref>-auth-token` naming convention. No localStorage usage.

#### [NEW] `src/lib/supabase/server.js`

This creates a Supabase client for use in middleware, server components, server actions, and route handlers.

```javascript
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
```

---

### TASK 2: Rewrite Middleware with SSR Session Validation

Replace the broken cookie-name check with a real Supabase session validation using `createMiddlewareClient`. The admin auth block remains completely unchanged.

#### [MODIFY] [middleware.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/middleware.js)

**Replace the ENTIRE file with:**

```javascript
import { NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase/server'

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

    // Define the main app domain (handle localhost, staging, and production)
    const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1')
    const isStaging = hostname.includes('staging.tagdeer.app')

    // Auto-detect environment: localhost → staging → production
    const rootDomain = isLocalhost
        ? 'localhost:3000'
        : isStaging
            ? 'staging.tagdeer.app'
            : (process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'tagdeer.app')

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
    // 1. Admin Subdomain — uses custom admin_auth cookie (NOT Supabase SSR)
    if (currentHost === 'admin') {
        // Exclude system paths, static files, and api from auth check
        if (!pathname.startsWith('/_next') && !pathname.includes('api')) {
            const authCookie = request.cookies.get('admin_auth');
            const isAuthenticated = !!authCookie?.value;

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

    // 2. Merchant Subdomain — uses Supabase SSR cookie-based session
    if (currentHost === 'merchant' || currentHost === 'business') {
        // Exclude system paths, static files, and api from auth check
        if (!pathname.startsWith('/_next') && !pathname.includes('api')) {
            // Create a response object that createMiddlewareClient can write cookies to
            const newPath = pathname.startsWith('/merchant') ? pathname : `/merchant${pathname}`
            const newUrl = new URL(newPath, request.url)
            let response = NextResponse.rewrite(newUrl)

            // Create an SSR-aware Supabase client that reads/writes cookies
            const supabase = createMiddlewareClient(request, response)

            // getUser() validates the session with the Supabase Auth server.
            // This also refreshes expired tokens and writes updated cookies
            // to the response via the setAll handler.
            const { data: { user }, error } = await supabase.auth.getUser()

            const isAuthenticated = !!user && !error

            // Allow unauthenticated access to public pages
            if (!isAuthenticated && pathname !== '/login' && pathname !== '/onboarding' && pathname !== '/reset-password') {
                const loginUrl = request.nextUrl.clone();
                loginUrl.pathname = '/login';
                return NextResponse.redirect(loginUrl);
            }

            // Redirect authenticated users away from login page
            if (isAuthenticated && pathname === '/login') {
                const dashboardUrl = request.nextUrl.clone();
                dashboardUrl.pathname = '/dashboard';
                return NextResponse.redirect(dashboardUrl);
            }

            // Return the response with the rewrite AND the refreshed auth cookies
            return response
        }

        // For system paths (_next, api), just rewrite without auth check
        const newPath = pathname.startsWith('/merchant') ? pathname : `/merchant${pathname}`
        const newUrl = new URL(newPath, request.url)
        return NextResponse.rewrite(newUrl)
    }

    // 3. Main App (www or root) → proceeds normally
    return NextResponse.next()
}
```

**Key changes from original:**
1. Admin block: **UNCHANGED** (still uses `admin_auth` cookie as before)
2. Merchant block: Replaced the dead `sb-*-auth-token` cookie name check with a real `supabase.auth.getUser()` call via `createMiddlewareClient`
3. The `getUser()` call validates the token with the Supabase Auth server AND refreshes expired tokens, writing new cookies to the response
4. The response object is created BEFORE the auth check so `createMiddlewareClient` can attach refreshed cookies to it

---

### TASK 3: Migrate Browser Supabase Client to `@supabase/ssr`

Replace the current `supabaseClient.js` (which uses `createClient` from `@supabase/supabase-js` with localStorage) with the new SSR-aware browser client.

#### [MODIFY] [supabaseClient.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/lib/supabaseClient.js)

**Replace the ENTIRE file with:**

```javascript
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file.'
    );
}

/**
 * Supabase browser client — powered by @supabase/ssr.
 *
 * SESSION PERSISTENCE: Stores auth tokens in COOKIES (not localStorage).
 * This makes sessions visible to the Next.js middleware for server-side
 * auth enforcement. The cookie name follows the Supabase convention:
 * sb-<project-ref>-auth-token
 *
 * SINGLETON: createBrowserClient returns the same instance on repeat calls.
 * The window.tagdeer_supabase guard is kept for backward compatibility with
 * any code that references it directly.
 *
 * COOKIE DOMAIN: On staging/production with subdomains, the cookies are
 * automatically scoped by the browser. Since merchant.staging.tagdeer.app
 * and admin.staging.tagdeer.app are different origins, the browser isolates
 * their cookies naturally.
 *
 * IMPORTANT: The admin portal uses a SEPARATE auth mechanism (admin_auth
 * httpOnly cookie set by the loginAdmin server action). This Supabase SSR
 * client is primarily for the merchant and consumer portals.
 */
let supabaseInstance;

if (typeof window !== 'undefined') {
    if (!window.tagdeer_supabase) {
        window.tagdeer_supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    }
    supabaseInstance = window.tagdeer_supabase;
} else {
    // Server-side fallback — should NOT be used for auth operations.
    // For server-side auth, use createMiddlewareClient or createServerComponentClient
    // from '@/lib/supabase/server'.
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseInstance;
```

**Key changes:**
1. Replaced `createClient` from `@supabase/supabase-js` with `createBrowserClient` from `@supabase/ssr`
2. Removed the manual `auth` options (`persistSession`, `autoRefreshToken`, `detectSessionInUrl`, `storageKey`, `broadcast`) — `createBrowserClient` handles all of this internally using cookies
3. The `window.tagdeer_supabase` singleton pattern is preserved for backward compatibility

> [!WARNING]
> **Migration impact on AuthProvider:** The `AuthProvider` at `src/context/providers/AuthProvider.jsx` reads/writes `localStorage` for user profile caching (key: `tagdeer-user`). This is SEPARATE from the Supabase session storage and should continue to work. The Supabase session itself moves from localStorage to cookies, but the app's user profile cache in localStorage is unaffected.

---

### TASK 4: Fix Merchant Login Post-Auth Redirect

The merchant login `useEffect` fires `window.location.href` which can trigger multiple times during auth state transitions. Add a guard flag and a loading UI.

#### [MODIFY] [page.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/merchant/login/page.jsx)

**Step 4a — Add a redirect guard state. After line 21 (`const router = useRouter();`), add:**

```javascript
const [isRedirecting, setIsRedirecting] = useState(false);
```

**Step 4b — Replace the auto-redirect useEffect (lines 43-50) with:**

```javascript
// Auto-redirect if already logged in as merchant.
// Uses window.location.href (not router.push) so middleware rewrites
// /dashboard → /merchant/dashboard on the subdomain.
// The isRedirecting guard prevents the useEffect from firing multiple times
// during the auth state machine's SIGNED_IN → syncUserProfile transition.
useEffect(() => {
    if (isRedirecting) return;
    if (!loading && user && user.role === 'merchant') {
        if (step === 'set-password') return;
        setIsRedirecting(true);
        const dashPath = trialCampaign ? `/dashboard?trial_campaign=${trialCampaign}` : '/dashboard';
        window.location.href = dashPath;
    }
}, [user, loading, step, trialCampaign, isRedirecting]);
```

**Step 4c — Add a full-screen loader for the redirect state. Insert BEFORE the set-password check at line 230 (before `if (step === 'set-password')`):**

```javascript
// Show a clean loading state during the redirect to prevent UI flashing
if (isRedirecting) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
            <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Redirecting to dashboard...</p>
            </div>
        </div>
    );
}
```

---

### TASK 5: Fix Admin Login Timing Race

The admin login fires `window.location.href` after the server action completes but the Supabase client-side sign-in (which now writes cookies via `@supabase/ssr`) may not have completed. Ensure the await properly gates the redirect.

#### [MODIFY] [page.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/admin/login/page.jsx)

**Replace the `handleLogin` function (lines 19-44) with:**

```javascript
const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
        // Step 1: Server-side — validates credentials + role, sets httpOnly admin_auth cookie
        const result = await loginAdmin(email, password)
        if (!result.success) {
            setError(result.error || 'Authentication failed')
            setIsLoading(false)
            return
        }

        // Step 2: Client-side — sign in via Supabase so AuthProvider sees the session.
        // With @supabase/ssr, this writes session tokens to cookies (not localStorage),
        // making them available to the middleware on the next request.
        // We MUST await this before redirecting.
        if (supabase) {
            try {
                await supabase.auth.signInWithPassword({ email, password })
            } catch (supabaseErr) {
                // Non-fatal: admin_auth cookie is the primary auth mechanism.
                // Supabase session is optional for admin — it only powers TagdeerContext.
                console.warn('Client-side Supabase sign-in failed (non-fatal):', supabaseErr.message)
            }
        }

        // Step 3: Hard redirect. Use bare path (no /admin prefix) because the
        // middleware rewrites / → /admin on the admin subdomain.
        const rawRedirect = searchParams.get('redirect') || '/'
        // Strip /admin prefix if present to prevent double-prefixing on subdomain
        const redirectPath = rawRedirect.startsWith('/admin')
            ? rawRedirect.replace(/^\/admin/, '') || '/'
            : rawRedirect
        window.location.href = redirectPath
    } catch (err) {
        setError('An error occurred. Please try again.')
        setIsLoading(false)
    }
}
```

---

### TASK 6: Harden AdminGuard Transition Handling

Add unmount safety, cache-busting, and `router.replace` (not `.push`) for auth failures.

#### [MODIFY] [AdminGuard.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/components/admin/AdminGuard.jsx)

**Replace the ENTIRE component (lines 1-69) with:**

```javascript
'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * AdminGuard — Cookie-based auth, fully independent of Supabase/TagdeerContext.
 * Admin identity lives only in the httpOnly `admin_auth` cookie set by the server action.
 * We verify it via a lightweight API check on mount.
 *
 * The middleware already enforces redirect-to-login for the admin subdomain,
 * so this guard is a defense-in-depth layer for client-side rendering.
 */
export default function AdminGuard({ children }) {
    const router = useRouter()
    const pathname = usePathname()
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [checking, setChecking] = useState(true)

    useEffect(() => {
        // Don't guard the login page itself.
        // On subdomain: usePathname() returns '/login'
        // On path-based (localhost): returns '/admin/login'
        if (pathname === '/admin/login' || pathname === '/login') {
            setIsAuthorized(true)
            setChecking(false)
            return
        }

        let isMounted = true

        const checkAdminAuth = async () => {
            try {
                const res = await fetch('/api/admin/check-auth', {
                    credentials: 'include',
                    // Cache-bust to avoid stale 401s after a fresh login
                    headers: { 'Cache-Control': 'no-cache' }
                })
                if (!isMounted) return

                if (res.ok) {
                    const data = await res.json()
                    if (data.authenticated) {
                        setIsAuthorized(true)
                    } else {
                        router.replace('/login?redirect=' + encodeURIComponent(pathname))
                    }
                } else {
                    router.replace('/login?redirect=' + encodeURIComponent(pathname))
                }
            } catch {
                if (isMounted) {
                    router.replace('/login?redirect=' + encodeURIComponent(pathname))
                }
            } finally {
                if (isMounted) setChecking(false)
            }
        }

        checkAdminAuth()

        return () => { isMounted = false }
    }, [pathname, router])

    if (checking || !isAuthorized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    return <>{children}</>
}
```

**Changes:** Added `isMounted` cleanup, `router.replace` instead of `.push`, `Cache-Control: no-cache` on fetch.

---

### TASK 7: Dynamic AdminTopNav Path Computation

Replace hardcoded `/admin/*` nav links with dynamic paths that adapt to subdomain vs. path-based routing.

#### [MODIFY] [AdminTopNav.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/components/admin/AdminTopNav.jsx)

**Step 7a — Replace the `NAV_ITEMS` constant (lines 10-20) with bare paths:**

```javascript
// Bare paths — the middleware rewrites these to /admin/* on the subdomain.
// For path-based routing (localhost), we prepend /admin at render time.
const NAV_PATHS = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Requests', path: '/requests', icon: ClipboardList },
    { name: 'Businesses', path: '/businesses', icon: Building2 },
    { name: 'Users', path: '/users', icon: Users },
    { name: 'Disputes', path: '/disputes', icon: AlertTriangle },
    { name: 'Financials', path: '/financials', icon: DollarSign },
    { name: 'Campaigns', path: '/campaigns', icon: Megaphone },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: Settings },
]
```

**Step 7b — Inside the component body, after `const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)` (line 25), add the dynamic path logic:**

```javascript
// Detect if we're on a subdomain (pathname doesn't start with /admin)
// vs path-based routing (pathname starts with /admin, e.g. localhost:3000/admin/settings)
const isSubdomain = !pathname?.startsWith('/admin')
const basePath = isSubdomain ? '' : '/admin'

// Compute full nav items with correct hrefs for the current environment
const NAV_ITEMS = NAV_PATHS.map(item => ({
    ...item,
    href: item.path === '/'
        ? (basePath || '/')
        : `${basePath}${item.path}`
}))
```

**Step 7c — Update the logo Link (line 48). Replace:**
```jsx
<Link href="/admin" className="font-bold text-lg md:text-xl tracking-tight text-emerald-400">
```
**With:**
```jsx
<Link href={basePath || '/'} className="font-bold text-lg md:text-xl tracking-tight text-emerald-400">
```

**Step 7d — Update the desktop active link detection (line 55). Replace:**
```javascript
const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
```
**With:**
```javascript
const dashHref = basePath || '/'
const isActive = item.href === dashHref
    ? (pathname === dashHref || pathname === '/admin' || pathname === '/')
    : pathname.startsWith(item.href)
```

**Step 7e — Apply the same active detection fix in the mobile nav (line 113). Replace:**
```javascript
const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
```
**With:**
```javascript
const dashHref = basePath || '/'
const isActive = item.href === dashHref
    ? (pathname === dashHref || pathname === '/admin' || pathname === '/')
    : pathname.startsWith(item.href)
```

---

### TASK 8: Fix MerchantGuard Redirect Path Normalization

Ensure the redirect parameter strips the `/merchant` prefix for consistency across subdomain and path-based routing.

#### [MODIFY] [MerchantGuard.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/components/merchant/MerchantGuard.jsx)

**Step 8a — After line 15 (`const [checkingSub, setCheckingSub] = useState(true)`) add:**

```javascript
// Normalize pathname for redirect params:
// - Subdomain: usePathname() returns '/dashboard' (bare)
// - Path-based: usePathname() returns '/merchant/dashboard'
// The redirect param should always use bare paths since
// the middleware handles the /merchant prefix.
const barePathname = pathname?.startsWith('/merchant')
    ? pathname.replace(/^\/merchant/, '') || '/'
    : pathname
```

**Step 8b — Replace ALL 3 instances of:**
```javascript
router.push('/login?redirect=' + encodeURIComponent(pathname))
```
**With:**
```javascript
router.push('/login?redirect=' + encodeURIComponent(barePathname))
```

There are 3 occurrences at lines 28, 36, and 51.

---

### TASK 9: Update AuthProvider for Cookie-Based Session Compatibility

The `AuthProvider` at `src/context/providers/AuthProvider.jsx` has a fallback that reads from `localStorage('tagdeer-user')` when no Supabase session exists. With the cookie-based client, `getSession()` should always find the session if the user is authenticated. Clean up the fallback to prevent stale state from the old localStorage sessions.

#### [MODIFY] [AuthProvider.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/context/providers/AuthProvider.jsx)

**Step 9a — In the `checkInitialSession` function (lines 43-57), replace the localStorage fallback block:**

Current (lines 47-54):
```javascript
} else {
    try {
        const stored = localStorage.getItem('tagdeer-user');
        if (stored) setUser(JSON.parse(stored));
        else setUser(null);
    } catch {
        setUser(null);
    }
}
```

Replace with:
```javascript
} else {
    // No active Supabase session. With @supabase/ssr cookie-based auth,
    // the session cookie may have expired or been cleared.
    // Clear any stale profile cache from localStorage.
    try {
        localStorage.removeItem('tagdeer-user');
    } catch {
        // localStorage may not be available (SSR, etc.)
    }
    setUser(null);
}
```

**Why:** With cookie-based sessions, if `getSession()` returns null, the user is genuinely not authenticated. Reading a stale `tagdeer-user` from localStorage would make the UI think the user is logged in, but the middleware would redirect them — causing the same flash/loop issue we're fixing.

**Step 9b — Leave everything else in AuthProvider unchanged.** The `syncUserProfile`, `onAuthStateChange`, and all login methods continue to work because they use the `supabase` instance from `useSupabase()`, which now uses the cookie-based `createBrowserClient` via the updated `supabaseClient.js`.

---

## Part 4: Files Changed Summary

| # | File | Action | Description |
|---|---|---|---|
| 1 | `src/lib/supabase/client.js` | **NEW** | Browser SSR client factory using `createBrowserClient` |
| 2 | `src/lib/supabase/server.js` | **NEW** | Middleware + server component SSR client factory using `createServerClient` |
| 3 | `src/middleware.js` | **MODIFY** | Replace dead merchant cookie check with real `supabase.auth.getUser()` via SSR client. Admin block unchanged. |
| 4 | `src/lib/supabaseClient.js` | **MODIFY** | Replace `createClient` with `createBrowserClient` from `@supabase/ssr` for cookie-based sessions |
| 5 | `src/app/(portals)/merchant/login/page.jsx` | **MODIFY** | Add redirect guard + loading UI to prevent flash/re-entry |
| 6 | `src/app/(portals)/admin/login/page.jsx` | **MODIFY** | Fix redirect path stripping; improve Supabase sign-in error handling |
| 7 | `src/components/admin/AdminGuard.jsx` | **MODIFY** | Add isMounted cleanup; router.replace; cache-bust header |
| 8 | `src/components/admin/AdminTopNav.jsx` | **MODIFY** | Dynamic path computation for subdomain vs path-based routing |
| 9 | `src/components/merchant/MerchantGuard.jsx` | **MODIFY** | Normalize redirect parameter paths |
| 10 | `src/context/providers/AuthProvider.jsx` | **MODIFY** | Remove stale localStorage fallback; clean up on no-session |

**Total: 2 new files. 8 modified files. Zero deleted files.**

---

## Part 5: Verification Plan

### 5.1 Automated Tests

**Step 1:** Run the existing test suite:
```bash
npx vitest run
```
All existing tests must pass. The `TagdeerContext.test.jsx` may need minor updates if it mocks the Supabase client — if so, update the mock to match `createBrowserClient` behavior.

**Step 2:** Run the production build:
```bash
npm run build
```
Must complete with exit code 0. Verify no import resolution errors for the new `src/lib/supabase/` files.

### 5.2 Manual Verification (Staging)

> [!IMPORTANT]
> All tests must be in **Incognito/Private Browsing** to avoid cached sessions.

**Test A — Merchant Login (Primary Fix):**
1. Open `merchant.staging.tagdeer.app/login` in incognito
2. Enter valid merchant email + password → Click "Sign In"
3. ✅ "Redirecting to dashboard..." loading screen appears briefly
4. ✅ Dashboard loads fully with TopNav, store selector, data — **no hang, no flash, no loop**
5. Open DevTools → Application → Cookies → Look for `sb-ipjvgbxkouadovjqwncx-auth-token` cookie
6. ✅ Cookie exists with `path=/` and proper value

**Test B — Merchant OTP Login:**
1. Open `merchant.staging.tagdeer.app/login` in incognito
2. Enter email → "Send verification code" → Enter 6-digit OTP
3. ✅ Set-password prompt appears (new users) OR dashboard redirect works
4. ✅ No infinite loops

**Test C — Admin Login (Primary Fix):**
1. Open `admin.staging.tagdeer.app/login` in incognito
2. Enter admin email + password → Click "Authenticate"
3. ✅ Dashboard loads on **FIRST attempt** — no manual refreshes needed
4. ✅ AdminTopNav visible with all navigation links (no double-prefixed URLs)
5. Click each nav link — verify URL bar shows clean paths (not `/admin/admin/settings`)
6. Click "Logout" → ✅ Redirected to `/login`, nav disappears

**Test D — Admin Redirect Param:**
1. Visit `admin.staging.tagdeer.app/settings` without being logged in
2. ✅ Redirected to `/login?redirect=%2Fsettings`
3. Log in → ✅ Redirected to `/settings` (not root dashboard)

**Test E — Localhost Regression:**
1. `localhost:3000/merchant/login` → merchant login flow works
2. `localhost:3000/admin/login` → admin login flow works
3. ✅ Both work identically to pre-change behavior

**Test F — Cross-Portal Session Isolation:**
1. Log into `merchant.staging.tagdeer.app`
2. In same browser, open `admin.staging.tagdeer.app`
3. ✅ Admin login page appears (merchant session doesn't grant admin access)
4. Log into admin → ✅ Both portals work independently in separate tabs

**Test G — Unauthenticated Access Protection:**
1. In incognito (no session), visit `merchant.staging.tagdeer.app/dashboard`
2. ✅ Immediately redirected to `/login` — no flash of dashboard content
3. In incognito, visit `admin.staging.tagdeer.app/settings`
4. ✅ Immediately redirected to `/login` — no flash of admin content

---

## Part 6: Architecture Notes (NOT In Scope)

> [!NOTE]
> **For future sprints, not this one.**

1. **Context Isolation:** `TagdeerProvider` still wraps the entire app. A future refactor should split it per the [Portal Split-Brain Investigation](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/Docs/portal_split_brain_investigation.md).

2. **Server Components:** With `@supabase/ssr` in place, future pages can use `createServerComponentClient` for server-side data fetching with auth, eliminating the client-side loading waterfall.

3. **Old localStorage cleanup:** After deployment, users with existing `tagdeer-auth-v1` localStorage entries will have them ignored (the Supabase SSR client uses cookies). The old keys can be cleaned up in a future pass, but they cause no harm.
