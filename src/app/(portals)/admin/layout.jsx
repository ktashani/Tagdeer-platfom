'use client';

import NotificationBanner from '@/components/NotificationBanner';

export default function AdminLayout({ children }) {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <nav className="border-b border-slate-800 bg-slate-950 p-4 shadow-sm flex justify-between items-center">
                <div className="font-bold text-xl tracking-tight text-emerald-400">Tagdeer <span className="text-white">Admin</span></div>
                <div className="flex items-center gap-4 text-sm font-medium">
                    <a href="#" className="hover:text-emerald-400 transition-colors">Dashboard</a>
                    <a href="#" className="hover:text-emerald-400 transition-colors">Users</a>
                    <a href="#" className="hover:text-emerald-400 transition-colors">Campaigns</a>
                    <NotificationBanner variant="bell" />
                </div>
            </nav>
            <main className="p-8 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    )
}
