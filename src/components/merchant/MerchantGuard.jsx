'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTagdeer } from '@/context/TagdeerContext'
import { Loader2 } from 'lucide-react'

export default function MerchantGuard({ children }) {
    const { user, profile, loading } = useTagdeer()
    const router = useRouter()
    const pathname = usePathname()
    const [isAuthorized, setIsAuthorized] = useState(false)

    useEffect(() => {
        if (!loading) {
            // Don't guard the login page itself
            if (pathname === '/merchant/login') {
                setIsAuthorized(true)
                return
            }

            if (!user) {
                router.push('/merchant/login?redirect=' + encodeURIComponent(pathname))
            } else if (user?.role !== 'merchant' && user?.role !== 'admin') {
                router.push('/discover') // Redirect unauthorized users to consumer app
            } else {
                setIsAuthorized(true)
            }
        }
    }, [user, profile, loading, router, pathname])

    if (loading || !isAuthorized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FB]">
                <Loader2 className="h-8 w-8 animate-spin border-blue-600" />
            </div>
        )
    }

    return <>{children}</>
}
