"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, MessageSquare, Ticket, Settings, Bell, ChevronDown, Store, Plus, CheckCircle2, Lock } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useState, useRef, useEffect, useMemo } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { useActiveBusiness } from '@/context/providers/ActiveBusinessProvider';

export default function TopNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, businesses, supabase, logout, showToast } = useTagdeer();
    const { activeBusiness, myBusinesses, selectedBusinessId, setSelectedBusinessId, claimStatuses } = useActiveBusiness();

    const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
    const storeMenuRef = useRef(null);

    // claimStatuses is now provided by ActiveBusinessProvider via useActiveBusiness()
    const [subTier, setSubTier] = useState('Free');

    useEffect(() => {
        if (!supabase || !user) return;
        const fetchTier = async () => {
            const { data } = await supabase
                .from('subscriptions')
                .select('tier')
                .eq('profile_id', user.id)
                .eq('status', 'Active')
                .maybeSingle();

            if (data?.tier) setSubTier(data.tier);
        };
        fetchTier();
    }, [supabase, user]);

    // Fetch actual pending resolution count for inbox badge
    const [inboxCount, setInboxCount] = useState(0);
    useEffect(() => {
        if (!supabase || !user) return;
        const fetchInboxCount = async () => {
            try {
                // Count complaint logs against businesses owned by this merchant that are pending resolution
                const ownerBusinessIds = businesses?.filter(b => b.owner_id === user?.id).map(b => b.id) || [];
                if (ownerBusinessIds.length === 0) return;
                const { count } = await supabase
                    .from('logs')
                    .select('id', { count: 'exact', head: true })
                    .eq('interaction_type', 'complain')
                    .in('business_id', ownerBusinessIds)
                    .is('resolved_at', null);
                setInboxCount(count || 0);
            } catch (e) {
                // Silently fail — badge stays 0
            }
        };
        fetchInboxCount();
    }, [supabase, user, businesses]);

    // Derive the pending claim for the header display (when user has no approved businesses)
    const pendingClaim = useMemo(() => {
        if (myBusinesses.length > 0) return null;
        // Check if user has any claims at all
        const claimEntries = Object.entries(claimStatuses);
        if (claimEntries.length === 0) return null;
        const [bizId, status] = claimEntries[0];
        const bInfo = businesses?.find(b => b.id === bizId);
        return {
            name: bInfo?.name || 'Pending Business',
            region: bInfo?.region || 'In Review',
            status: status
        };
    }, [myBusinesses, claimStatuses, businesses]);

    const activeStore = activeBusiness;

    // Business gating: lock business-dependent nav items when no approved business
    const isBusinessLocked = useMemo(() => {
        if (!activeBusiness) return true;
        const status = claimStatuses[activeBusiness.id];
        return status === 'pending' || status === 'missing_docs';
    }, [activeBusiness, claimStatuses]);

    // Location gating: dynamic based on actual subscription tier
    const isPro = subTier !== 'Free';
    const showAddButton = myBusinesses.length < 1 || isPro;

    const handleStoreSelect = (storeId) => {
        setSelectedBusinessId(storeId);
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
        { href: `${basePath}/dashboard`, icon: LayoutDashboard, label: 'Home', requiresBusiness: true },
        {
            href: `${basePath}/inbox`,
            icon: MessageSquare,
            label: 'Inbox',
            badge: inboxCount > 0 ? String(inboxCount) : null, // Real count from pending resolutions
            requiresBusiness: true
        },
        { href: `${basePath}/coupons`, icon: Ticket, label: 'Coupons', requiresBusiness: true },
        { href: `${basePath}/settings`, icon: Settings, label: 'Settings', requiresBusiness: false },
    ];

    return (
        <nav className="bg-[#1A1C23] border-b border-[#2C2E3E] text-slate-300 p-2 lg:px-6 flex justify-between items-center sticky top-0 z-50">
            {/* Logo area */}
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xl leading-none">
                    T
                </div>
                <div className="font-bold text-lg tracking-tight hidden sm:flex items-center gap-2 text-white">
                    Tagdeer <span className="font-normal text-slate-400">Merchant</span>
                    {subTier !== 'Free' && (
                        <Badge variant="outline" className={`ml-1 text-[10px] h-5 ${subTier === 'Enterprise' ? 'border-purple-500 text-purple-400 bg-purple-500/10' : 'border-blue-500 text-blue-400 bg-blue-500/10'}`}>
                            {subTier}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Centered Navigation Icons (HRM Style) */}
            <div className="flex items-center gap-1 sm:gap-2">
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    const Icon = item.icon;
                    const isLocked = item.requiresBusiness && isBusinessLocked;

                    if (isLocked) {
                        return (
                            <button
                                key={item.href}
                                onClick={() => showToast?.('Your business is still under review. This feature will unlock once approved.')}
                                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full transition-all duration-200 opacity-40 cursor-not-allowed relative group"
                                title={`${item.label} — Locked until business is approved`}
                            >
                                <Icon className="w-5 h-5 text-slate-500" />
                                <Lock className="w-3 h-3 text-slate-500 absolute -top-0.5 -right-0.5" />
                            </button>
                        );
                    }

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
                    );
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
                            {myBusinesses.length > 0 ? (
                                <>
                                    <span className="text-sm font-bold text-white mb-1">{activeStore?.name || 'Select Business'}</span>
                                    {claimStatuses[activeStore?.id] === 'pending' ? (
                                        <span className="text-[11px] text-amber-400 flex items-center gap-1.5 font-medium">
                                            Pending <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse hidden sm:block"></span>
                                        </span>
                                    ) : claimStatuses[activeStore?.id] === 'missing_docs' ? (
                                        <span className="text-[11px] text-red-400 flex items-center gap-1.5 font-medium">
                                            Action Required <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse hidden sm:block"></span>
                                        </span>
                                    ) : (
                                        <span className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                                            Open <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse hidden sm:block"></span>
                                        </span>
                                    )}
                                </>
                            ) : pendingClaim ? (
                                <>
                                    <span className="text-sm font-bold text-white mb-1">{pendingClaim.name}</span>
                                    <span className="text-[11px] text-amber-400 flex items-center gap-1.5 font-medium">
                                        {pendingClaim.status === 'missing_docs' ? 'Action Required' : 'Approval Pending'}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="text-sm font-bold text-slate-400 mb-1">No Business</span>
                                    <span className="text-[11px] text-slate-500 font-medium">Claim your business</span>
                                </>
                            )}
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
                                    {myBusinesses.length > 0 ? (
                                        myBusinesses.map(store => {
                                            const isActive = store.id === selectedBusinessId;
                                            const storeClaimStatus = claimStatuses[store.id];
                                            const storeIsPending = storeClaimStatus === 'pending';
                                            const storeIsMissingDocs = storeClaimStatus === 'missing_docs';
                                            return (
                                                <button
                                                    key={store.id}
                                                    onClick={() => handleStoreSelect(store.id)}
                                                    className={`w-full px-5 py-4 text-left flex justify-between items-center transition-all rounded-xl group ${isActive
                                                        ? 'bg-[#1E222B] border border-[#2A2D35]'
                                                        : 'hover:bg-[#1A1C23] border border-transparent'
                                                        }`}
                                                >
                                                    <div className="flex flex-col items-start w-full">
                                                        <p className={`text-lg font-bold ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{store.name}</p>
                                                        <p className={`text-sm mt-1 ${storeIsPending ? 'text-amber-500' : storeIsMissingDocs ? 'text-red-500' : 'text-slate-500'}`}>
                                                            {storeIsPending ? 'Pending Approval' : storeIsMissingDocs ? 'Action Required' : (store.region || 'Libya')}
                                                        </p>
                                                    </div>
                                                    {isActive && (
                                                        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 flex items-center justify-center shrink-0">
                                                            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="w-full px-5 py-6 text-center rounded-xl border border-dashed border-[#2A2D35]">
                                            <p className="text-slate-500 text-sm">No connected businesses</p>
                                        </div>
                                    )}
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
                                    <div
                                        onClick={() => {
                                            setIsStoreMenuOpen(false);
                                            router.push(`${basePath}/settings?tab=subscription`);
                                        }}
                                        className="w-full bg-transparent hover:bg-slate-700 text-slate-400 border border-slate-700/50 h-12 rounded-xl font-medium text-[15px] flex items-center justify-center cursor-pointer transition-colors"
                                    >
                                        Upgrade to Pro for more
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <Popover>
                    <PopoverTrigger asChild>
                        <button className="relative p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-full focus:outline-none focus:ring-0">
                            <Bell className="w-4 h-4" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-[#1A1C23]"></span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 bg-[#16181D] border-[#2A2D35] p-0 shadow-2xl">
                        <div className="p-4 border-b border-[#2A2D35]">
                            <h4 className="font-bold text-white leading-none">Notifications</h4>
                        </div>
                        <div className="py-8 px-4 text-center">
                            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-500">
                                <Bell className="w-6 h-6" />
                            </div>
                            <p className="text-slate-400 text-sm">You have no new notifications.</p>
                        </div>
                    </PopoverContent>
                </Popover>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="flex items-center gap-2 pl-2 border-l border-slate-700 cursor-pointer hover:bg-slate-800 p-1.5 rounded-full pr-3 transition-colors outline-none focus:ring-0">
                            <img src="https://flagcdn.com/w20/ly.png" alt="Libya" className="w-5 h-3.5 rounded-sm object-cover hidden sm:block" />
                            <Avatar className="w-8 h-8 border border-slate-700">
                                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs">
                                    {user?.full_name?.substring(0, 2).toUpperCase() || 'TG'}
                                </AvatarFallback>
                            </Avatar>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-[#16181D] border-[#2A2D35] text-slate-300 shadow-2xl">
                        <DropdownMenuLabel className="font-bold text-white">
                            {user?.full_name || 'Tagdeer Merchant'}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-[#2A2D35]" />
                        <DropdownMenuItem className="focus:bg-[#1E222B] focus:text-white cursor-pointer" onClick={() => router.push(`${basePath}/settings`)}>
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-red-900/50 focus:text-red-400 cursor-pointer text-red-500 font-medium" onClick={() => {
                            if (logout) logout();
                            router.push('/');
                        }}>
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </nav>
    );
}
