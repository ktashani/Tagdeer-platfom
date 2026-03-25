'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Admin Analytics — signup trends, vote activity, MRR, top businesses.
 * Uses inline CSS bar charts (no charting library dependency).
 */
export default function AdminAnalytics() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState(30); // days

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        const since = new Date(Date.now() - timeRange * 86400000).toISOString();

        try {
            // Parallel queries
            const [signupsRes, logsRes, transactionsRes, topBizRes] = await Promise.all([
                supabase.from('profiles').select('id, created_at').gte('created_at', since),
                supabase.from('logs').select('id, created_at, interaction_type').gte('created_at', since),
                supabase.from('transactions').select('id, amount, status, created_at').gte('created_at', since),
                supabase
                    .from('businesses')
                    .select('id, name, category')
                    .limit(10),
            ]);

            // Group signups by day
            const signupsByDay = groupByDay(signupsRes.data || [], timeRange);

            // Group votes by day
            const votesByDay = groupByDay(logsRes.data || [], timeRange);

            // Vote breakdown
            const recommends = (logsRes.data || []).filter(l => l.interaction_type === 'recommend').length;
            const complains = (logsRes.data || []).filter(l => l.interaction_type === 'complain').length;

            // Revenue
            const approvedTx = (transactionsRes.data || []).filter(t => t.status === 'approved');
            const totalRevenue = approvedTx.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
            const pendingTx = (transactionsRes.data || []).filter(t => t.status === 'pending').length;

            setData({
                signupsByDay,
                votesByDay,
                recommends,
                complains,
                totalVotes: (logsRes.data || []).length,
                totalSignups: (signupsRes.data || []).length,
                totalRevenue,
                pendingTx,
                approvedTxCount: approvedTx.length,
            });
        } catch (err) {
            console.error('Analytics fetch error:', err);
        }
        setLoading(false);
    }, [timeRange]);

    useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

    if (loading) {
        return (
            <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">📊 Analytics Dashboard</h3>
                <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(Number(e.target.value))}
                    className="px-3 py-1.5 bg-slate-700 text-white border border-slate-600 rounded-lg text-sm outline-none"
                >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                </select>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'New Users', value: data.totalSignups, emoji: '👤', bg: 'bg-blue-500/20 border-blue-500/30' },
                    { label: 'Total Votes', value: data.totalVotes, emoji: '📝', bg: 'bg-emerald-500/20 border-emerald-500/30' },
                    { label: 'Revenue (LYD)', value: data.totalRevenue.toLocaleString(), emoji: '💰', bg: 'bg-amber-500/20 border-amber-500/30' },
                    { label: 'Pending Payments', value: data.pendingTx, emoji: '⏳', bg: 'bg-purple-500/20 border-purple-500/30' },
                ].map((kpi, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${kpi.bg}`}>
                        <div className="text-2xl mb-1">{kpi.emoji}</div>
                        <div className="text-2xl font-black text-white">{kpi.value}</div>
                        <div className="text-xs text-slate-400 font-medium">{kpi.label}</div>
                    </div>
                ))}
            </div>

            {/* Signup Trend Chart */}
            <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                <h4 className="text-sm font-bold text-slate-300 mb-3">📈 Signup Trend</h4>
                <BarChart data={data.signupsByDay} color="bg-blue-500" />
            </div>

            {/* Vote Activity Chart */}
            <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                <h4 className="text-sm font-bold text-slate-300 mb-3">💬 Vote Activity</h4>
                <BarChart data={data.votesByDay} color="bg-emerald-500" />
            </div>

            {/* Vote Breakdown */}
            <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                <h4 className="text-sm font-bold text-slate-300 mb-3">⚖️ Vote Breakdown</h4>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>👍 Recommends ({data.recommends})</span>
                            <span>👎 Complains ({data.complains})</span>
                        </div>
                        <div className="w-full h-6 rounded-full overflow-hidden flex bg-slate-600">
                            <div
                                className="bg-emerald-500 h-full transition-all duration-500"
                                style={{ width: data.totalVotes > 0 ? `${(data.recommends / data.totalVotes) * 100}%` : '50%' }}
                            />
                            <div
                                className="bg-red-500 h-full transition-all duration-500"
                                style={{ width: data.totalVotes > 0 ? `${(data.complains / data.totalVotes) * 100}%` : '50%' }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Group records by day for chart display */
function groupByDay(records, daysBack) {
    const days = [];
    for (let i = daysBack - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        days.push({ key, label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }), count: 0 });
    }

    records.forEach(r => {
        const key = r.created_at?.slice(0, 10);
        const day = days.find(d => d.key === key);
        if (day) day.count++;
    });

    return days;
}

/** Simple inline bar chart using CSS */
function BarChart({ data, color }) {
    const max = Math.max(...data.map(d => d.count), 1);
    // Show last N bars depending on count
    const visible = data.length > 14 ? data.filter((_, i) => i % Math.ceil(data.length / 14) === 0 || i === data.length - 1) : data;

    return (
        <div className="flex items-end gap-1 h-28">
            {visible.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div className="w-full relative group">
                        <div
                            className={`w-full ${color} rounded-t transition-all duration-300 hover:opacity-80`}
                            style={{ height: `${Math.max((d.count / max) * 96, 2)}px` }}
                        />
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                            {d.count}
                        </div>
                    </div>
                    <span className="text-[8px] text-slate-500 truncate w-full text-center">{d.label.split(' ')[1]}</span>
                </div>
            ))}
        </div>
    );
}
