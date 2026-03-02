'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTagdeer } from '@/context/TagdeerContext'
import { Loader2 } from 'lucide-react'

export default function AdminGuard({ children }) {
    const { user, loading } = useTagdeer()
    const router = useRouter()
    const pathname = usePathname()
    const [isAuthorized, setIsAuthorized] = useState(false)

    useEffect(() => {
        if (!loading) {
            // Don't guard the login page itself
            if (pathname === '/admin/login') {
                setIsAuthorized(true)
                return
            }

            if (!user) {
                router.push('/admin/login?redirect=' + encodeURIComponent(pathname))
            } else if (user?.role !== 'admin') {
                router.push('/') // Redirect unauthorized users to consumer app
            } else {
                setIsAuthorized(true)
            }
        }
    }, [user, loading, router, pathname])

    if (loading || !isAuthorized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        )
    }

    return <>{children}</>
}
