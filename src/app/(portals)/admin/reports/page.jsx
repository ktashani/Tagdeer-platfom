'use client'

import { useState, useEffect } from 'react'
import { BarChart3, LineChart, PieChart, Activity, Users, Download, Zap, Loader2 } from 'lucide-react'
import { useTagdeer } from '@/context/TagdeerContext'

const growthData = [
    { month: 'Oct', signups: 1200, uninstalls: 300 },
    { month: 'Nov', signups: 1800, uninstalls: 400 },
    { month: 'Dec', signups: 2200, uninstalls: 350 },
    { month: 'Jan', signups: 2800, uninstalls: 500 },
    { month: 'Feb', signups: 3200, uninstalls: 600 },
    { month: 'Mar', signups: 3800, uninstalls: 450 },
]

export default function ReportsPage() {
    const { supabase } = useTagdeer()
    const [metrics, setMetrics] = useState({
        globalScore: 0,
        totalLogs: 0,
        totalDisputes: 0,
        totalRedemptions: 0,
        totalUsers: 0
    })
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!supabase) return;

        const fetchMetrics = async () => {
            setIsLoading(true);
            try {
                // Fetch aggregate counts. Note: In a production app with huge tables, 
                // these would be cached view queries or RPCs instead of raw count queries.
                const [usersRes, logsRes, disputesRes, redemptionsRes, profilesRes] = await Promise.all([
                    supabase.from('profiles').select('*', { count: 'exact', head: true }),
                    supabase.from('logs').select('*', { count: 'exact', head: true }),
                    supabase.from('disputes').select('*', { count: 'exact', head: true }),
                    supabase.from('coupon_redemptions').select('*', { count: 'exact', head: true }),
                    supabase.from('profiles').select('trust_points')
                ]);

                // Calculate global health score based on average trust points
                let avgTrust = 80;
                if (profilesRes.data && profilesRes.data.length > 0) {
                    const totalTrust = profilesRes.data.reduce((acc, curr) => acc + (curr.trust_points || 0), 0);
                    avgTrust = Math.round(totalTrust / profilesRes.data.length);
                    // Clamp to 100 max for visual score
                    avgTrust = Math.min(100, avgTrust);
                }

                setMetrics({
                    totalUsers: usersRes.count || 0,
                    totalLogs: logsRes.count || 0,
                    totalDisputes: disputesRes.count || 0,
                    totalRedemptions: redemptionsRes.count || 0,
                    globalScore: avgTrust
                });
            } catch (err) {
                console.error("Error fetching report metrics", err);
            }
            setIsLoading(false);
        }

        fetchMetrics();
    }, [supabase])
    return (
        <div className="animate-in fade-in duration-500 min-h-[calc(100vh-8rem)] flex flex-col">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Platform Analytics</h1>
                    <p className="text-slate-400 mt-1">Deep dive into user growth, interactions, and system health.</p>
                </div>

                <div className="flex gap-4">
                    <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors border border-slate-700 flex items-center gap-2 text-sm font-semibold">
                        <Download className="w-4 h-4" /> Export Raw CSV
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto pb-8">

                {/* 1. Growth Metrics (Signups vs Uninstalls) */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 flex flex-col min-h-[350px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-400" /> User Retention & Growth
                            </h3>
                            <p className="text-sm text-slate-400">Monthly signups compared to app uninstalls.</p>
                        </div>
                        <select className="bg-slate-900 border border-slate-700 text-sm text-slate-300 rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500">
                            <option>Last 6 Months</option>
                            <option>Year to Date</option>
                            <option>All Time</option>
                        </select>
                    </div>

                    <div className="flex-1 border border-slate-700/50 bg-slate-900/50 rounded-xl flex items-end justify-between p-6 relative group overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur-sm z-10">
                            <div className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                <LineChart className="w-4 h-4" /> Dynamic Charting Library Required
                            </div>
                        </div>

                        {/* Dummy Bar Chart Visualization */}
                        {growthData.map((data, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end flex-1">
                                <div className="flex gap-2 items-end h-[80%] w-full justify-center">
                                    <div
                                        className="w-8 bg-blue-500/80 rounded-t-md relative shrink-0"
                                        style={{ height: `${(data.signups / 4000) * 100}%` }}
                                    ></div>
                                    <div
                                        className="w-8 bg-red-500/80 rounded-t-md relative shrink-0"
                                        style={{ height: `${(data.uninstalls / 4000) * 100}%` }}
                                    ></div>
                                </div>
                                <span className="text-xs text-slate-400 font-medium">{data.month}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-center gap-6 mt-4 text-xs font-medium text-slate-400">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> New Signups</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Uninstalls</div>
                    </div>
                </div>

                {/* 2. System Health Score Trends */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 flex flex-col min-h-[350px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                <Activity className="w-5 h-5 text-emerald-400" /> Platform Health Score
                            </h3>
                            <p className="text-sm text-slate-400">Average trust rating across all registered locations.</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-8 mb-6">
                        <div className="bg-slate-900 border border-emerald-500/30 p-4 rounded-xl flex-1 border-l-4 border-l-emerald-500">
                            <div className="text-xs text-slate-400 mb-1">Current Global Score</div>
                            <div className="text-4xl font-black text-white">
                                {isLoading ? <Loader2 className="w-8 h-8 animate-spin text-emerald-500" /> : `${metrics.globalScore}`}
                                {!isLoading && <span className="text-xl text-emerald-500">/100</span>}
                            </div>
                        </div>
                        <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex-1 justify-center flex flex-col">
                            <div className="text-xs text-slate-400 mb-1">Total Registered Users</div>
                            <div className="text-xl font-bold text-white">
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : metrics.totalUsers.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 border border-slate-700/50 bg-slate-900/50 rounded-xl flex items-center justify-center p-6 text-slate-500 relative overflow-hidden group">
                        <LineChart className="w-12 h-12 text-slate-700 mb-3" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur-sm">
                            <span className="text-sm font-medium text-slate-300">Trendline Visualization Area</span>
                        </div>
                    </div>
                </div>

                {/* 3. Interaction Heatmaps / Engagement */}
                <div className="xl:col-span-2 bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                <Zap className="w-5 h-5 text-amber-500" /> Core Interactions
                            </h3>
                            <p className="text-sm text-slate-400">Total volume of receipts uploaded, disputes filed, and rewards claimed.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl flex items-center justify-between">
                            <div>
                                <div className="text-sm text-slate-400 mb-2">Total Logs Uploaded</div>
                                <div className="text-3xl font-bold text-white">
                                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : metrics.totalLogs.toLocaleString()}
                                </div>
                            </div>
                            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                                <BarChart3 className="w-8 h-8 text-blue-500" />
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl flex items-center justify-between">
                            <div>
                                <div className="text-sm text-slate-400 mb-2">Total Disputes Handled</div>
                                <div className="text-3xl font-bold text-white">
                                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : metrics.totalDisputes.toLocaleString()}
                                </div>
                            </div>
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                                <Activity className="w-8 h-8 text-red-500" />
                            </div>
                        </div>

                        <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl flex items-center justify-between">
                            <div>
                                <div className="text-sm text-slate-400 mb-2">Rewards Redeemed</div>
                                <div className="text-3xl font-bold text-white">
                                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : metrics.totalRedemptions.toLocaleString()}
                                </div>
                            </div>
                            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
                                <PieChart className="w-8 h-8 text-amber-500" />
                            </div>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    )
}
