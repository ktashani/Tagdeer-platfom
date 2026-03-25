'use client';

import NotificationBanner from '@/components/NotificationBanner';

export default function MerchantLayout({ children }) {
    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
            <nav className="border-b border-neutral-200 bg-white p-4 shadow-sm flex justify-between items-center">
                <div className="font-bold text-xl tracking-tight text-blue-600">Tagdeer <span className="text-neutral-800">For Business</span></div>
                <div className="flex items-center gap-4 text-sm font-medium text-neutral-600">
                    <a href="/merchant" className="hover:text-blue-600 transition-colors">Dashboard</a>
                    <a href="#" className="hover:text-blue-600 transition-colors">My Stores</a>
                    <a href="/merchant/billing" className="hover:text-blue-600 transition-colors">Billing</a>
                    <a href="#" className="hover:text-blue-600 transition-colors">Analytics</a>
                    <NotificationBanner variant="bell" />
                </div>
            </nav>
            <main className="p-8 max-w-7xl mx-auto">
                <NotificationBanner variant="banner" />
                {children}
            </main>
        </div>
    )
}
