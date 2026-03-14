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
        // Safety timeout: if check-auth takes longer than 8s, force render
        const safetyTimer = setTimeout(() => {
            console.warn('[AdminGuard] Safety timeout: forcing guard open after 8s');
            setIsAuthorized(true);
            setChecking(false);
        }, 8000);

        // Don't guard the login page itself.
        // On subdomain: usePathname() returns '/login'
        // On path-based (localhost): returns '/admin/login'
        if (pathname === '/admin/login' || pathname === '/login') {
            setIsAuthorized(true)
            setChecking(false)
            clearTimeout(safetyTimer)
            return
        }

        let isMounted = true

        const checkAdminAuth = async () => {
            try {
                console.log('[AdminGuard] Checking auth for pathname:', pathname)
                const res = await fetch('/api/admin/check-auth', {
                    credentials: 'include',
                    // Cache-bust to avoid stale 401s after a fresh login
                    headers: { 'Cache-Control': 'no-cache' }
                })
                if (!isMounted) return
                console.log('[AdminGuard] check-auth response status:', res.status)

                if (res.ok) {
                    const data = await res.json()
                    console.log('[AdminGuard] check-auth response data:', JSON.stringify(data))
                    if (data.authenticated) {
                        setIsAuthorized(true)
                    } else {
                        console.warn('[AdminGuard] REJECTED — check-auth returned authenticated:false')
                        router.replace('/login?redirect=' + encodeURIComponent(pathname))
                    }
                } else {
                    console.warn('[AdminGuard] REJECTED — check-auth returned non-OK status:', res.status)
                    router.replace('/login?redirect=' + encodeURIComponent(pathname))
                }
            } catch (err) {
                console.error('[AdminGuard] REJECTED — fetch error:', err)
                if (isMounted) {
                    router.replace('/login?redirect=' + encodeURIComponent(pathname))
                }
            } finally {
                if (isMounted) {
                    setChecking(false)
                    clearTimeout(safetyTimer)
                }
            }
        }

        checkAdminAuth()

        return () => {
            isMounted = false
            clearTimeout(safetyTimer)
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
