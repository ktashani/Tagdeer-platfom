"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, MessageSquare, Ticket, Settings, Bell, ChevronDown, Store, Plus, CheckCircle2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useRef, useEffect } from 'react';

export default function TopNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
    const storeMenuRef = useRef(null);

    // Mock stores as state so we can select them
    const [stores, setStores] = useState([
        { id: '1', name: 'Al-Saha Clinic', location: 'Tripoli', active: true }
        // Uncomment to test Pro Tier limit
        // ,{ id: '2', name: 'Al-Saha Pharmacy', location: 'Benghazi', active: false }
    ]);

    // Business Logic: 1 business = free tier max. 2+ businesses = requires Pro Tier.
    // The button shows if they have NO businesses (0), OR if they are Pro.
    const isPro = false;
    const showAddButton = stores.length < 1 || isPro;

    const handleStoreSelect = (storeId) => {
        setStores(stores.map(store => ({
            ...store,
            active: store.id === storeId
        })));
        setIsStoreMenuOpen(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (storeMenuRef.current && !storeMenuRef.current.contains(event.target)) {
                setIsStoreMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const basePath = pathname.startsWith('/merchant') ? '/merchant' : '';

    const navItems = [
        { href: `${basePath}/dashboard`, icon: LayoutDashboard, label: 'Home' },
        {
            href: `${basePath}/inbox`,
            icon: MessageSquare,
            label: 'Inbox',
            badge: '2' // Mock notification
        },
        { href: `${basePath}/coupons`, icon: Ticket, label: 'Coupons' },
        { href: `${basePath}/settings`, icon: Settings, label: 'Settings' },
    ];

    return (
        <nav className="bg-[#1A1C23] border-b border-[#2C2E3E] text-slate-300 p-2 lg:px-6 flex justify-between items-center sticky top-0 z-50">
            {/* Logo area */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl leading-none">
                    T
                </div>
                <div className="font-bold text-lg tracking-tight hidden sm:block text-white">
                    Tagdeer <span className="font-normal text-slate-400">Merchant</span>
                </div>
            </div>

            {/* Centered Navigation Icons (HRM Style) */}
            <div className="flex items-center gap-1 sm:gap-2">
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full transition-all duration-200 ${isActive
                                ? 'bg-indigo-500/20 text-indigo-400 font-medium'
                                : 'hover:bg-slate-800 hover:text-white'
                                }`}
                            title={item.label}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                            {isActive && <span className="text-sm hidden sm:block">{item.label}</span>}
                            {item.badge && (
                                <Badge variant="destructive" className="h-4 w-4 rounded-full p-0 flex items-center justify-center text-[9px] -ml-1">
                                    {item.badge}
                                </Badge>
                            )}
                        </Link>
                    )
                })}
            </div>

            {/* Right Side Actions & Profile */}
            <div className="flex items-center gap-4">

                {/* Store Selector Dropdown */}
                <div className="relative hidden md:block" ref={storeMenuRef}>
                    <button
                        onClick={() => setIsStoreMenuOpen(!isStoreMenuOpen)}
                        className={`flex items-center gap-3 transition-colors rounded-full pl-3 pr-4 py-2 border hover:bg-slate-800 ${isStoreMenuOpen
                            ? 'bg-slate-800 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                            : 'bg-transparent border-slate-700/50'
                            }`}
                    >
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isStoreMenuOpen ? 'rotate-180' : ''}`} />
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-sm font-bold text-white mb-1">{stores.find(s => s.active)?.name || 'Select Store'}</span>
                            <span className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                                Open <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse hidden sm:block"></span>
                            </span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center ml-2 border border-blue-500/30">
                            <Store className="w-4 h-4" />
                        </div>
                    </button>

                    {/* Dropdown Menu */}
                    {isStoreMenuOpen && (
                        <div className="absolute top-full right-0 mt-3 w-80 bg-[#16181D] border border-[#2A2D35] rounded-[24px] shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">

                            <div className="px-6 py-5">
                                <p className="text-[13px] font-bold text-slate-400 tracking-[0.2em] text-center mb-4">YOUR BUSINESSES</p>

                                <div className="space-y-2">
                                    {stores.map(store => (
                                        <button
                                            key={store.id}
                                            onClick={() => handleStoreSelect(store.id)}
                                            className={`w-full px-5 py-4 text-left flex justify-between items-center transition-all rounded-xl group ${store.active
                                                ? 'bg-[#1E222B] border border-[#2A2D35]'
                                                : 'hover:bg-[#1A1C23] border border-transparent'
                                                }`}
                                        >
                                            <div className="flex flex-col items-start w-full">
                                                <p className={`text-lg font-bold ${store.active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{store.name}</p>
                                                <p className="text-sm text-slate-500 mt-1">{store.location}</p>
                                            </div>
                                            {store.active && (
                                                <div className="w-6 h-6 rounded-full border-2 border-indigo-500 flex items-center justify-center shrink-0">
                                                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-5 border-t border-[#2A2D35] bg-[#1A1C23]">
                                {showAddButton ? (
                                    <Button
                                        onClick={() => {
                                            setIsStoreMenuOpen(false);
                                            router.push(`${basePath}/onboarding`);
                                        }}
                                        className="w-full bg-transparent hover:bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 h-12 rounded-xl font-medium text-[15px] transition-all"
                                    >
                                        Claim Another Business <Plus className="w-5 h-5 ml-2" />
                                    </Button>
                                ) : (
                                    <div className="w-full bg-transparent text-slate-400 border border-slate-700/50 h-12 rounded-xl font-medium text-[15px] flex items-center justify-center opacity-70 cursor-not-allowed">
                                        Upgrade to Pro for more
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <button className="relative p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-full">
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#1A1C23]"></span>
                </button>

                <div className="flex items-center gap-2 pl-2 border-l border-slate-700 cursor-pointer hover:bg-slate-800 p-1.5 rounded-full pr-3 transition-colors">
                    <img src="https://flagcdn.com/w20/ly.png" alt="English" className="w-5 h-3.5 rounded-sm object-cover hidden sm:block" />
                    <Avatar className="w-8 h-8 border border-slate-700">
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs">WD</AvatarFallback>
                    </Avatar>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </div>
            </div>
        </nav>
    );
}
