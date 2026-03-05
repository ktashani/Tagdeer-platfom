'use client';
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, ArrowRight, TrendingUp, Users, DollarSign, Activity, CheckCircle2, Loader2 } from 'lucide-react'
import { useTagdeer } from '@/context/TagdeerContext'

export default function AdminDashboard() {
    const {
        supabase, businesses,
        shieldPricing = { trust: 20, fatora: 50 }
    } = useTagdeer()
    const [stats, setStats] = useState({
        mrr: 0,
        vipUsers: 0,
        pendingClaims: 0,
        openDisputes: 0,
        couponsRedeemed: 0,
        systemHealth: null
    })
    const [recentApprovals, setRecentApprovals] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!supabase) return;

        const loadStats = async () => {
            try {
                // Fetch VIP users count
                const { count: vipCount } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .gt('gader', 1000)

                // Fetch pending claims count
                const { count: claimsCount } = await supabase
                    .from('business_claims')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pending')

                // Fetch pending disputes
                const { count: disputesCount } = await supabase
                    .from('disputes')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pending_admin_review')

                // MRR Approximation based on Shield Config Prices
                let calculatedMrr = 0;
                let topApprovals = [];
                if (businesses) {
                    calculatedMrr = businesses.reduce((acc, curr) => {
                        if (curr.shield_level === 2) return acc + shieldPricing.fatora;
                        if (curr.shield_level === 1) return acc + shieldPricing.trust;
                        return acc;
                    }, 0);

                    // Grab newest claimed businesses for the table
                    topApprovals = [...businesses]
                        .filter(b => b.isClaimed)
                        .slice(0, 5); // Just top 5
                }

                // Fetch total redeemed coupons (amount - remaining across all pools)
                let totalCouponsRedeemed = 0;
                try {
                    const { data: pools } = await supabase
                        .from('coupon_pools')
                        .select('amount, remaining');
                    if (pools) {
                        totalCouponsRedeemed = pools.reduce((sum, p) => sum + ((p.amount || 0) - (p.remaining || 0)), 0);
                    }
                } catch (_) { /* table may not exist yet */ }

                setStats({
                    mrr: calculatedMrr,
                    vipUsers: vipCount || 0,
                    pendingClaims: claimsCount || 0,
                    openDisputes: disputesCount || 0,
                    couponsRedeemed: totalCouponsRedeemed,
                    systemHealth: null // Will be computed when monitoring is set up
                });
                setRecentApprovals(topApprovals);

            } catch (error) {
                console.error("Dashboard Aggregation Error", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadStats()
    }, [supabase, businesses])

    if (isLoading) {
        return <div className="min-h-[60vh] flex items-center justify-center text-slate-400 gap-3"><Loader2 className="w-6 h-6 animate-spin" /> Loading Pulse...</div>
    }
    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">The Pulse</h1>
                    <p className="text-slate-400 mt-1">High-level view of Tagdeer's platform health.</p>
                </div>
                <div className="flex items-center space-x-3 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700/50">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-sm font-medium text-slate-300">Operations Normal</span>
                </div>
            </div>

            {/* TOP: High-Level Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl hover:bg-slate-800 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-slate-400">Monthly Revenue (MRR)</h3>
                        <DollarSign className="w-5 h-5 text-emerald-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.mrr} <span className="text-lg text-slate-500">LYD</span></div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl hover:bg-slate-800 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-slate-400">Total VIP Users</h3>
                        <Users className="w-5 h-5 text-purple-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.vipUsers}</div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl hover:bg-slate-800 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-slate-400">Coupon Burn Rate</h3>
                        <Activity className="w-5 h-5 text-blue-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.couponsRedeemed || '—'} <span className="text-lg text-slate-500">/day</span></div>
                    {stats.couponsRedeemed > 0 && <div className="mt-2 text-xs font-medium text-amber-400 bg-amber-400/10 inline-block px-2 py-1 rounded-md">Active usage</div>}
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl hover:bg-slate-800 transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-slate-400">System Health Score</h3>
                        <TrendingUp className="w-5 h-5 text-emerald-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.systemHealth || '—'}<span className="text-lg font-normal text-slate-500">%</span></div>
                    {stats.systemHealth && <div className="mt-2 text-xs font-medium text-emerald-400 bg-emerald-400/10 inline-block px-2 py-1 rounded-md">Operational</div>}
                </div>
            </div>

            {/* MIDDLE: Operational Tasks (Action Required) */}
            <h2 className="text-xl font-semibold text-white mt-12 mb-4 border-b border-slate-800 pb-2">Operational Tasks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pending Claims */}
                <div className="bg-slate-800/30 border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-500/10 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                            </div>
                            <h3 className="text-lg font-medium text-white">Pending Business Claims</h3>
                        </div>
                        <p className="text-slate-400 text-sm mb-6 pl-12">There are new businesses waiting to be verified before they can access the Merchant Portal.</p>
                        <div className="pl-12">
                            <span className="text-4xl font-bold text-white">{stats.pendingClaims}</span>
                            <span className="text-slate-500 ml-2">claims require review</span>
                        </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-slate-700/50 pl-12">
                        <Link href="/admin/requests" className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium border border-slate-700">
                            Review Claims
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {/* Open Disputes */}
                <div className="bg-slate-800/30 border border-red-500/20 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-red-500/10 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-red-400" />
                            </div>
                            <h3 className="text-lg font-medium text-white">Open Receipt Disputes</h3>
                        </div>
                        <p className="text-slate-400 text-sm mb-6 pl-12">Urgent unhandled disputes from merchants regarding user-uploaded receipts.</p>
                        <div className="pl-12">
                            <span className="text-4xl font-bold text-white">{stats.openDisputes}</span>
                            <span className="text-slate-500 ml-2">disputes are waiting</span>
                        </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-slate-700/50 pl-12">
                        <Link href="/admin/disputes" className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium border border-slate-700">
                            Resolve Disputes
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* BOTTOM: Monitoring Lists */}
            <h2 className="text-xl font-semibold text-white mt-12 mb-4 border-b border-slate-800 pb-2">Real-Time Registry Log</h2>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-white">Recent Store Approvals</h3>
                    <Link href="/admin/businesses" className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">View All Directory</Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400 min-w-[600px]">
                        <thead className="text-xs uppercase bg-slate-800/50 border-b border-slate-700/50">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-medium text-slate-300">Business Name</th>
                                <th scope="col" className="px-6 py-4 font-medium text-slate-300">Category</th>
                                <th scope="col" className="px-6 py-4 font-medium text-slate-300">Location</th>
                                <th scope="col" className="px-6 py-4 font-medium text-slate-300">Status</th>
                                <th scope="col" className="px-6 py-4 font-medium text-slate-300 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentApprovals.map(business => (
                                <tr key={business.id} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{business.name}</td>
                                    <td className="px-6 py-4">{business.category || 'Unknown'}</td>
                                    <td className="px-6 py-4">{business.region || 'Unknown'}</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Verified
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link href="/admin/businesses" className="text-slate-500 hover:text-slate-300 font-medium">Manage</Link>
                                    </td>
                                </tr>
                            ))}
                            {recentApprovals.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">No verified businesses yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    )
}
