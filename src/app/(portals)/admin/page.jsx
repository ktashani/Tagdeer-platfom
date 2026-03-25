'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ClaimQueue from '@/components/admin/ClaimQueue';
import FlaggedContentQueue from '@/components/admin/FlaggedContentQueue';
import PaymentQueue from '@/components/admin/PaymentQueue';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            const { data, error } = await supabase.rpc('admin_dashboard_stats');
            if (!error && data) setStats(data);
            setLoading(false);
        };
        fetchStats();
    }, []);

    const statCards = [
        {
            label: 'Total Users',
            value: stats?.total_users,
            icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
            color: 'emerald',
            sub: `${stats?.total_merchants || 0} merchants`,
        },
        {
            label: 'Active Businesses',
            value: stats?.total_businesses,
            icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
            color: 'blue',
            sub: `${stats?.active_subscriptions || 0} subscriptions`,
        },
        {
            label: 'Total Tagdeers',
            value: stats?.total_logs,
            icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
            color: 'purple',
            sub: stats?.flagged_logs ? `${stats.flagged_logs} flagged` : 'None flagged',
        },
        {
            label: 'Pending Claims',
            value: stats?.pending_claims,
            icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
            color: 'amber',
            sub: stats?.pending_claims > 0 ? 'Action required' : 'All clear',
        },
        {
            label: 'Pending Payments',
            value: stats?.pending_payments,
            icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
            color: 'rose',
            sub: stats?.pending_payments > 0 ? 'Needs review' : 'None pending',
        },
    ];

    const colorMap = {
        emerald: { icon: 'text-emerald-400', badge: 'text-emerald-400 bg-emerald-400/10' },
        blue: { icon: 'text-blue-400', badge: 'text-blue-400 bg-blue-400/10' },
        purple: { icon: 'text-purple-400', badge: 'text-purple-400 bg-purple-400/10' },
        amber: { icon: 'text-amber-400', badge: 'text-amber-400 bg-amber-400/10' },
        rose: { icon: 'text-rose-400', badge: 'text-rose-400 bg-rose-400/10' },
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">System Overview</h1>
                    <p className="text-slate-400 mt-1">Monitor Tagdeer platform health and metrics.</p>
                </div>
                <div className="flex items-center gap-4">
                    {stats?.mrr > 0 && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full">
                            <span className="text-sm font-bold text-emerald-400">{stats.mrr} LYD</span>
                            <span className="text-xs text-emerald-400/70 ml-1">MRR</span>
                        </div>
                    )}
                    <div className="flex items-center space-x-3 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700/50">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-sm font-medium text-slate-300">All Systems Operational</span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {statCards.map((card) => {
                    const colors = colorMap[card.color];
                    return (
                        <div key={card.label} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl hover:bg-slate-800 transition-all group">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-slate-400">{card.label}</h3>
                                <svg className={`w-5 h-5 ${colors.icon} opacity-80 group-hover:opacity-100 transition-opacity`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={card.icon} />
                                </svg>
                            </div>
                            {loading ? (
                                <div className="h-9 w-24 bg-slate-700/50 rounded-lg animate-pulse" />
                            ) : (
                                <div className="text-3xl font-bold text-white">
                                    {(card.value ?? 0).toLocaleString()}
                                </div>
                            )}
                            <div className={`mt-2 text-xs font-medium ${colors.badge} inline-block px-2 py-1 rounded-md`}>
                                {card.sub}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Live Claim Queue */}
            <ClaimQueue />

            {/* Payment Confirmation Queue */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
                <PaymentQueue />
            </div>

            {/* Flagged Content Moderation */}
            <FlaggedContentQueue />
        </div>
    )
}
