'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import TopNav from '@/components/merchant/TopNav';
import { useTagdeer } from '@/context/TagdeerContext';
import { Toast } from '@/components/Toast';

export default function PortalsLayout({ children }) {
    const pathname = usePathname();
    const { isRTL, toastMessage, setToastMessage, user } = useTagdeer();

    // Hide nav for auth/onboarding pages, admin routes, or when user isn't loaded yet
    // (prevents stale TopNav from flashing before MerchantGuard redirects)
    const isOnboarding = pathname?.includes('/onboarding');
    const isLogin = pathname?.includes('/login');
    const isAdmin = pathname?.startsWith('/admin');
    const hideNav = isOnboarding || isLogin || isAdmin || !user;

    return (
        <div className={`min-h-screen flex flex-col font-sans bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>

            {/* Inject the Merchant Command Center globally for portal routes (except auth/onboarding) */}
            {!hideNav && <TopNav />}

            <main className="flex-grow">
                {children}
            </main>

            <Toast message={toastMessage} onClose={() => setToastMessage('')} />
        </div>
    );
}
