'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAdmin } from '@/actions/adminAuth'

const NAV_ITEMS = [
    { name: 'Dashboard', href: '/admin' },
    { name: 'Requests', href: '/admin/requests' },
    { name: 'Businesses', href: '/admin/businesses' },
    { name: 'Users', href: '/admin/users' },
    { name: 'Disputes', href: '/admin/disputes' },
    { name: 'Financials', href: '/admin/financials' },
    { name: 'Campaigns', href: '/admin/campaigns' },
    { name: 'Reports', href: '/admin/reports' },
    { name: 'Settings', href: '/admin/settings' },
]

export default function AdminTopNav() {
    const pathname = usePathname()

    const handleLogout = async () => {
        await logoutAdmin()
        window.location.href = '/login'
    }

    // Don't render navigation on the login page
    if (pathname === '/login') return null;

    return (
        <nav className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
            <div className="flex items-center gap-8">
                <Link href="/" className="font-bold text-xl tracking-tight text-emerald-400">
                    Tagdeer <span className="text-white">Admin</span>
                </Link>
                <div className="hidden md:flex gap-1 items-center bg-slate-900/50 p-1 rounded-lg border border-slate-800">
                    {NAV_ITEMS.map((item) => {
                        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${isActive
                                    ? 'bg-emerald-500/10 text-emerald-400 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                    }`}
                            >
                                {item.name}
                            </Link>
                        )
                    })}
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-emerald-400 shadow-inner">
                    A
                </div>
                <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-slate-400 hover:text-red-400 transition-colors"
                >
                    Logout
                </button>
            </div>
        </nav>
    )
}
