'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import MerchantGuard from '@/components/merchant/MerchantGuard';
import TopNav from '@/components/merchant/TopNav';
import { ActiveBusinessProvider, useActiveBusiness } from '@/context/providers/ActiveBusinessProvider';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Route-level gate: blocks business-dependent pages (inbox, coupons)
 * when the active business is pending or missing_docs.
 *
 * Allowed through regardless of business status:
 *   - /dashboard  (renders its own pending-approval UI)
 *   - /settings   (merchant-level, not business-level)
 *   - /onboarding, /login, /reset-password
 */
function BusinessRouteGate({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const { activeBusiness, claimStatuses } = useActiveBusiness();

    const isBusinessLocked = useMemo(() => {
        if (!activeBusiness) return true;
        const status = claimStatuses[activeBusiness.id];
        return status === 'pending' || status === 'missing_docs';
    }, [activeBusiness, claimStatuses]);

    // Routes that are always accessible regardless of business status
    const isExemptRoute = useMemo(() => {
        if (!pathname) return true;
        const exempt = ['/dashboard', '/settings', '/billing', '/onboarding', '/login', '/reset-password'];
        return exempt.some(route => pathname.includes(route));
    }, [pathname]);

    if (isBusinessLocked && !isExemptRoute) {
        return (
            <div className="h-[75vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center mb-6">
                    <Lock className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-3">Feature Locked</h2>
                <p className="text-slate-500 max-w-md mx-auto text-base mb-8">
                    This feature requires an approved business. Your business is currently under review — once approved, all features will unlock automatically.
                </p>
                <Button
                    onClick={() => router.push('/merchant/dashboard')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-11 px-8 font-medium shadow-sm"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    return <>{children}</>;
}

export default function MerchantLayout({ children }) {
    const pathname = usePathname();

    // Hide nav for auth/onboarding pages, or when not yet authenticated
    const isOnboarding = pathname?.includes('/onboarding');
    const isLogin = pathname?.includes('/login');
    const isResetPassword = pathname?.includes('/reset-password');
    const hideNav = isOnboarding || isLogin || isResetPassword;

    return (
        <>
            <title>Tagdeer Merchant Portal</title>
            <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans">
                <MerchantGuard>
                    <ActiveBusinessProvider>
                        {!hideNav && <TopNav />}
                        <main className="p-4 md:p-8 max-w-[1400px] mx-auto">
                            <BusinessRouteGate>
                                {children}
                            </BusinessRouteGate>
                        </main>
                    </ActiveBusinessProvider>
                </MerchantGuard>
            </div>
        </>
    );
}

