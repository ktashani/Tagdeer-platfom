'use client';

import { usePathname } from 'next/navigation';
import MerchantGuard from '@/components/merchant/MerchantGuard';
import TopNav from '@/components/merchant/TopNav';
import { ActiveBusinessProvider } from '@/context/providers/ActiveBusinessProvider';

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
                            {children}
                        </main>
                    </ActiveBusinessProvider>
                </MerchantGuard>
            </div>
        </>
    );
}
