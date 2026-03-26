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
        let attempts = 0
        const MAX_ATTEMPTS = 3

        const checkAdminAuth = async () => {
            while (isMounted && attempts < MAX_ATTEMPTS) {
                attempts++
                try {
                    console.log(`[AdminGuard] Attempt ${attempts}/${MAX_ATTEMPTS} for pathname:`, pathname)
                    const res = await fetch('/api/admin/check-auth', {
                        credentials: 'include',
                        headers: { 'Cache-Control': 'no-cache' }
                    })

                    if (!isMounted) return

                    console.log('[AdminGuard] check-auth response status:', res.status)

                    if (res.ok) {
                        const data = await res.json()
                        console.log('[AdminGuard] check-auth data:', JSON.stringify(data))

                        if (data.authenticated) {
                            setIsAuthorized(true)
                            setChecking(false)
                            return // success — stop retrying
                        }

                        // authenticated: false means cookie is missing/invalid.
                        // Don't retry — redirect is appropriate.
                        console.warn('[AdminGuard] REJECTED — authenticated:false')
                        if (isMounted) {
                            setChecking(false)
                            router.replace('/login?redirect=' + encodeURIComponent(pathname))
                        }
                        return
                    }

                    // Non-OK (e.g. 500, network hiccup) — retry after a short wait
                    console.warn('[AdminGuard] Non-OK status:', res.status, `— retrying (attempt ${attempts})`)
                    if (attempts < MAX_ATTEMPTS) {
                        await new Promise(r => setTimeout(r, 1000 * attempts)) // 1s, 2s back-off
                    }

                } catch (err) {
                    console.error(`[AdminGuard] Fetch error (attempt ${attempts}):`, err)
                    if (attempts < MAX_ATTEMPTS) {
                        await new Promise(r => setTimeout(r, 1000 * attempts)) // back-off
                    }
                }
            }

            // All retries exhausted — redirect to login
            if (isMounted) {
                console.warn('[AdminGuard] All retries exhausted — redirecting to login')
                setChecking(false)
                router.replace('/login?redirect=' + encodeURIComponent(pathname))
            }
        }

        checkAdminAuth()

        return () => {
            isMounted = false
        }
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

