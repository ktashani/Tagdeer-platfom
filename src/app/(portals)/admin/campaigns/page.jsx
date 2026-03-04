'use client'

import { useState, useEffect } from 'react'
import { Ticket, Store, Loader2 } from 'lucide-react'
import { useTagdeer } from '@/context/TagdeerContext'

export default function CampaignsPage() {
    const { supabase, showToast } = useTagdeer()
    const [coupons, setCoupons] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [stats, setStats] = useState({
        totalPledged: 0,
        totalClaimed: 0,
        totalRedeemed: 0,
        activeCampaigns: 0
    })

    useEffect(() => {
        if (!supabase) return;

        const fetchData = async () => {
            setIsLoading(true)

            // Fetch all merchant coupons joined with business name
            const { data: couponsData, error } = await supabase
                .from('merchant_coupons')
                .select('*, businesses(name, region)')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching admin coupons:", error);
                showToast("Failed to load coupon data.");
            } else if (couponsData) {
                setCoupons(couponsData);

                // Calculate Stats
                const pledged = couponsData.reduce((acc, c) => acc + (c.initial_quantity || 0), 0);
                const claimed = couponsData.reduce((acc, c) => acc + (c.claimed_count || 0), 0);
                const active = couponsData.filter(c => c.status === 'active').length;

                setStats({
                    totalPledged: pledged,
                    totalClaimed: claimed,
                    totalRedeemed: 0, // Need coupon_redemptions table for this if we want it exact
                    activeCampaigns: active
                });
            }

            setIsLoading(false)
        }
        fetchData()
    }, [supabase])

    const updateCouponStatus = async (id, newStatus) => {
        try {
            const { error } = await supabase
                .from('merchant_coupons')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            setCoupons(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
            showToast(`Campaign ${newStatus} successfully.`);
        } catch (err) {
            console.error(err);
            showToast("Failed to update campaign status.");
        }
    }

    return (
        <div className="animate-in fade-in duration-500 h-[calc(100vh-8rem)] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Marketing Engine</h1>
                    <p className="text-slate-400 mt-1">Platform-wide liability tracking and merchant campaign monitoring.</p>
                </div>

                <div className="flex gap-4">
                    <div className="bg-[#1A1C23] border border-slate-700/50 rounded-xl px-4 py-2 flex items-center gap-6">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Platform Liability</p>
                            <p className="text-lg font-bold text-white leading-none mt-1">{stats.totalPledged} <span className="text-xs text-slate-400 font-normal">Pledged</span></p>
                        </div>
                        <div className="w-px h-8 bg-slate-800"></div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Active Exposure</p>
                            <p className="text-lg font-bold text-indigo-400 leading-none mt-1">{stats.totalClaimed} <span className="text-xs text-slate-400 font-normal">Claimed</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Campaigns List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                        <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                        <p>Loading market data...</p>
                    </div>
                ) : coupons.length > 0 ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {coupons.map(coupon => (
                            <div key={coupon.id} className="bg-[#1A1C23] border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600 transition-colors relative overflow-hidden">
                                <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl -mr-10 -mt-10 ${coupon.status === 'active' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}></div>

                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`${coupon.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-700 text-slate-400 border-slate-600'
                                                } rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider border`}>
                                                {coupon.status}
                                            </span>
                                            <span className="text-xs text-slate-500 font-mono">#{coupon.id.substring(0, 8)}</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-1">{coupon.title || `${coupon.discount_value}% Discount`}</h3>
                                        <p className="text-sm text-slate-400 flex items-center gap-1.5">
                                            <Store className="w-3.5 h-3.5" /> {coupon.businesses?.name} <span className="text-slate-600">•</span> {coupon.businesses?.region}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {coupon.status === 'active' ? (
                                            <button
                                                onClick={() => updateCouponStatus(coupon.id, 'paused')}
                                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                            >
                                                Pause Campaign
                                            </button>
                                        ) : coupon.status === 'paused' ? (
                                            <button
                                                onClick={() => updateCouponStatus(coupon.id, 'active')}
                                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                            >
                                                Resume
                                            </button>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-6 mt-8 border-t border-slate-800 pt-6">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Inventory</p>
                                        <p className="text-lg font-bold text-white leading-none">
                                            {coupon.initial_quantity} <span className="text-xs text-slate-500 font-normal">total</span>
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Claimed</p>
                                        <p className="text-lg font-bold text-indigo-400 leading-none">{coupon.claimed_count || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Channel</p>
                                        <p className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-1 rounded inline-block mt-1 uppercase tracking-tight">
                                            {coupon.distribution_rule?.replace('_', ' ')}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-500"
                                        style={{ width: `${Math.min(100, ((coupon.claimed_count || 0) / coupon.initial_quantity) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-20 text-center bg-[#1A1C23] border border-dashed border-slate-700 rounded-2xl">
                        <Ticket className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500">No active merchant campaigns found.</p>
                    </div>
                )}
            </div>

        </div>
    )
}
