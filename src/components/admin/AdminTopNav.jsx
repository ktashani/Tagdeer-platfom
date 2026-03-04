'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAdmin } from '@/actions/adminAuth'
import { useTagdeer } from '@/context/TagdeerContext'
import { Menu, X, LayoutDashboard, ClipboardList, Building2, Users, AlertTriangle, DollarSign, Megaphone, BarChart3, Settings, LogOut } from 'lucide-react'

const NAV_ITEMS = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Requests', href: '/admin/requests', icon: ClipboardList },
    { name: 'Businesses', href: '/admin/businesses', icon: Building2 },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Disputes', href: '/admin/disputes', icon: AlertTriangle },
    { name: 'Financials', href: '/admin/financials', icon: DollarSign },
    { name: 'Campaigns', href: '/admin/campaigns', icon: Megaphone },
    { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
]

export default function AdminTopNav() {
    const pathname = usePathname()
    const { supabase } = useTagdeer()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const handleLogout = async () => {
        await logoutAdmin()
        if (supabase) await supabase.auth.signOut()
        window.location.href = '/admin/login'
    }

    if (pathname === '/admin/login') return null;

    return (
        <>
            <nav className="border-b border-slate-800 bg-slate-950 px-4 md:px-6 py-3 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-4 md:gap-8">
                    {/* Hamburger Menu Button (Mobile) */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="md:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        aria-label="Toggle menu"
                    >
                        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>

                    <Link href="/admin" className="font-bold text-lg md:text-xl tracking-tight text-emerald-400">
                        Tagdeer <span className="text-white">Admin</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex gap-1 items-center bg-slate-900/50 p-1 rounded-lg border border-slate-800">
                        {NAV_ITEMS.map((item) => {
                            const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`px-3 lg:px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${isActive
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

                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-emerald-400 shadow-inner">
                        A
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-sm font-medium text-slate-400 hover:text-red-400 transition-colors hidden sm:block"
                    >
                        Logout
                    </button>
                </div>
            </nav>

            {/* Mobile Navigation Drawer */}
            {isMobileMenuOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />

                    {/* Slide-in Menu */}
                    <div className="md:hidden fixed top-0 left-0 w-72 h-full bg-slate-950 border-r border-slate-800 z-50 animate-in slide-in-from-left duration-200 flex flex-col">
                        {/* Menu Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                            <span className="font-bold text-lg text-emerald-400">
                                Tagdeer <span className="text-white">Admin</span>
                            </span>
                            <button
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Nav Links */}
                        <div className="flex-1 overflow-y-auto py-4 px-3">
                            <div className="space-y-1">
                                {NAV_ITEMS.map((item) => {
                                    const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
                                    const Icon = item.icon
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent'
                                                }`}
                                        >
                                            <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                                            {item.name}
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Logout at Bottom */}
                        <div className="border-t border-slate-800 p-4">
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
                            >
                                <LogOut className="w-5 h-5" />
                                Logout
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}
