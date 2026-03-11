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
