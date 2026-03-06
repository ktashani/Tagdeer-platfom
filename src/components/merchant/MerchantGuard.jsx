'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTagdeer } from '@/context/TagdeerContext'
import { Loader2, Ban, AlertTriangle, Mail } from 'lucide-react'
import LockedFeatureOverlay from './LockedFeatureOverlay'

export default function MerchantGuard({ children }) {
    const { user, loading, supabase } = useTagdeer()
    const router = useRouter()
    const pathname = usePathname()
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [subTier, setSubTier] = useState(null)
    const [checkingSub, setCheckingSub] = useState(true)

    useEffect(() => {
        if (!loading) {
            // Don't guard the login or onboarding page itself
            if (pathname === '/merchant/login' || pathname === '/merchant/onboarding') {
                setIsAuthorized(true)
                return
            }

            if (!user) {
                router.push('/merchant/login?redirect=' + encodeURIComponent(pathname))
                return;
            }

            // If user has a non-merchant role, re-check the DB in case init-role
            // just ran but React state hasn't caught up yet (race condition from callback)
            if (user?.role && user.role !== 'merchant' && !user?.isDevBypass) {
                if (!supabase) {
                    router.push('/merchant/login?reason=merchant_required')
                    return;
                }
                // Fresh DB check to see if role was updated by init-role
                const recheckRole = async () => {
                    try {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('role')
                            .eq('id', user.id)
                            .single();
                        if (profile?.role === 'merchant') {
                            // Role was updated — allow through
                            setIsAuthorized(true)
                        } else {
                            router.push('/merchant/login?reason=merchant_required')
                        }
                    } catch {
                        router.push('/merchant/login?reason=merchant_required')
                    }
                }
                recheckRole()
                return;
            }

            // Allow authenticated merchants through
            if (user?.status === 'Banned' || user?.status === 'Restricted') {
                // Banned/Restricted merchants are blocked — handled in render below
                setIsAuthorized(true)
            } else {
                setIsAuthorized(true)
            }
        }
    }, [user, loading, router, pathname, supabase])

    useEffect(() => {
        if (isAuthorized && user) {
            const checkSub = async () => {
                try {
                    const { data, error } = await supabase
                        .from('subscriptions')
                        .select('tier')
                        .eq('profile_id', user.id)
                        .eq('status', 'Active')
                        .maybeSingle();

                    setSubTier(data?.tier || 'Free');
                } catch (err) {
                    console.error("Subscription check error:", err);
                    setSubTier('Free');
                } finally {
                    setCheckingSub(false);
                }
            }
            checkSub()
        } else if (isAuthorized && !user) {
            // Login/onboarding page with no user — skip subscription check
            setCheckingSub(false)
        } else if (!isAuthorized && !loading) {
            setCheckingSub(false)
        }
    }, [isAuthorized, user, supabase, loading])

    if (loading || checkingSub || !isAuthorized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FB]">
                <Loader2 className="h-8 w-8 animate-spin border-blue-600" />
            </div>
        )
    }

    // Tier Gating Logic
    if (subTier === 'Free' && pathname === '/merchant/coupons') {
        return (
            <div className="flex h-screen w-full relative bg-[#F8F9FB] p-8">
                <LockedFeatureOverlay
                    title="Unlock Campaigns & Coupons"
                    description="Loyalty distribution is only available for Pro and Enterprise merchants."
                />
            </div>
        )
    }

    // Block screen for banned/restricted merchants
    if (user?.status === 'Banned' || user?.status === 'Restricted') {
        const isBanned = user.status === 'Banned'
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FB] p-6">
                <div className="max-w-lg w-full text-center">
                    <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${isBanned ? 'bg-red-100' : 'bg-amber-100'}`}>
                        {isBanned
                            ? <Ban className="w-10 h-10 text-red-500" />
                            : <AlertTriangle className="w-10 h-10 text-amber-500" />
                        }
                    </div>

                    <h1 className={`text-3xl font-bold mb-3 ${isBanned ? 'text-red-700' : 'text-amber-700'}`}>
                        {isBanned ? 'Account Suspended' : 'Account Restricted'}
                    </h1>

                    <p className="text-slate-600 text-lg mb-6 leading-relaxed">
                        {isBanned
                            ? 'Your merchant account has been suspended due to a violation of Tagdeer platform policies. Your business listings have been hidden from the platform.'
                            : 'Your merchant account has been temporarily restricted. Some features may be unavailable until the issue is resolved.'
                        }
                    </p>

                    <div className={`rounded-xl p-5 mb-6 border ${isBanned ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                        <p className={`text-sm font-medium ${isBanned ? 'text-red-700' : 'text-amber-700'}`}>
                            {isBanned
                                ? '🔴 All your businesses are currently hidden from consumers.'
                                : '🟡 Your businesses are currently marked as restricted.'
                            }
                        </p>
                    </div>

                    <a
                        href="mailto:support@tagdeer.com"
                        className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-colors shadow-lg ${isBanned
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-amber-600 hover:bg-amber-700'
                            }`}
                    >
                        <Mail className="w-5 h-5" />
                        Contact Tagdeer Administration
                    </a>

                    <p className="text-sm text-slate-400 mt-4">
                        If you believe this is an error, please reach out and we'll review your case.
                    </p>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
