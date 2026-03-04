'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * AdminGuard — Cookie-based auth, fully independent of Supabase/TagdeerContext.
 * Admin identity lives only in the httpOnly `admin_auth` cookie set by the server action.
 * We detect it client-side via a lightweight server check.
 */
export default function AdminGuard({ children }) {
    const router = useRouter()
    const pathname = usePathname()
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [checking, setChecking] = useState(true)

    useEffect(() => {
        // Don't guard the login page itself
        if (pathname === '/admin/login') {
            setIsAuthorized(true)
            setChecking(false)
            return
        }

        // The admin_auth cookie is httpOnly, so we can't read it directly.
        // But the middleware already enforces the redirect for the admin subdomain.
        // For path-based routing (localhost), we check via a lightweight approach:
        // If they reached this component, the middleware already validated the cookie
        // OR they're on the main domain accessing /admin/* directly.
        // For the main domain case, we do a quick check.
        const checkAdminAuth = async () => {
            try {
                const res = await fetch('/api/admin/check-auth', { credentials: 'include' })
                if (res.ok) {
                    const data = await res.json()
                    if (data.authenticated) {
                        setIsAuthorized(true)
                    } else {
                        router.push('/admin/login?redirect=' + encodeURIComponent(pathname))
                    }
                } else {
                    router.push('/admin/login?redirect=' + encodeURIComponent(pathname))
                }
            } catch {
                // If no API exists yet, fall back to cookie detection via document.cookie
                // Note: admin_auth is httpOnly so this won't work — redirect to login
                router.push('/admin/login?redirect=' + encodeURIComponent(pathname))
            } finally {
                setChecking(false)
            }
        }

        checkAdminAuth()
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
