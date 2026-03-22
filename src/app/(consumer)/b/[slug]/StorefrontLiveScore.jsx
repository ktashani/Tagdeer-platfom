'use client';

import { useState, useEffect } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import StorefrontLogEntries from './StorefrontLogEntries';

/**
 * StorefrontLiveScore — Client component for real-time Gader Index + community logs.
 *
 * Phase 2c: Uses `display_score` from the businesses table as the unified score source.
 * Phase 3a: Subscribes to Supabase Realtime for live updates to both the business
 *           score (via the `businesses` table) and new log entries (via the `logs` table).
 *
 * Server-rendered data is passed as initial props for instant display (SEO-friendly).
 * After hydration, the component subscribes to Realtime and keeps the UI live.
 */
export default function StorefrontLiveScore({
    initialBusiness,
    initialLogs,
    isRTL,
    theme,
    labels: t,
}) {
    const { supabase } = useTagdeer();

    // Live state, seeded from server-rendered props
    const [business, setBusiness] = useState(initialBusiness);
    const [logs, setLogs] = useState(initialLogs || []);

    // ── Supabase Realtime: subscribe to business score + new logs ──
    useEffect(() => {
        if (!supabase || !business?.id) return;

        // Channel 1: Business row updates (score, recommends, complains)
        const bizChannel = supabase
            .channel(`storefront-biz-${business.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'businesses',
                    filter: `id=eq.${business.id}`,
                },
                (payload) => {
                    const updated = payload.new;
                    setBusiness(prev => ({
                        ...prev,
                        recommends: updated.recommends ?? prev.recommends,
                        complains: updated.complains ?? prev.complains,
                        display_score: updated.display_score ?? prev.display_score,
                    }));
                }
            )
            .subscribe();

        // Channel 2: New log inserts for this business
        const logChannel = supabase
            .channel(`storefront-logs-${business.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'logs',
                    filter: `business_id=eq.${business.id}`,
                },
                (payload) => {
                    const newLog = payload.new;
                    setLogs(prev => {
                        // Deduplicate: skip if this log ID already exists
                        if (prev.some(l => l.id === newLog.id)) return prev;
                        return [newLog, ...prev].slice(0, 20); // Keep max 20 visible
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(bizChannel);
            supabase.removeChannel(logChannel);
        };
    }, [supabase, business?.id]);

    // ── Derived scores ──
    const totalVotes = (business.recommends || 0) + (business.complains || 0);

    // Phase 2c: Use display_score from the DB trigger (unified with Discover).
    // Fallback to raw calculation only if display_score is null (first-time edge case).
    const gaderScore = business.display_score != null
        ? Math.round(business.display_score)
        : totalVotes > 0
            ? Math.round(((business.recommends || 0) / totalVotes) * 100)
            : null;

    const trustScore = gaderScore != null ? `${gaderScore}%` : 'N/A';
    const complainPercent = gaderScore != null && totalVotes > 0 ? `${100 - gaderScore}%` : '0%';
    const greenWidth = gaderScore != null ? Math.max(gaderScore, 8) : 50;
    const redWidth = gaderScore != null ? Math.max(100 - gaderScore, 8) : 50;

    return (
        <>
            {/* ── Community Trust & Rating Card ──────────────── */}
            <div className="mt-8 p-4 md:p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                {/* Gader Index Header */}
                <div className="flex justify-between items-end mb-4">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${totalVotes === 0
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            : gaderScore >= 50
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            }`}>
                            ⚡
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-900 dark:text-white font-bold text-lg leading-tight">{t.gaderScore}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{isRTL ? 'مقدار' : 'Migdar'}</span>
                        </div>
                    </div>
                    {totalVotes === 0 ? (
                        <span className="text-sm font-medium text-slate-400 italic">
                            {isRTL ? 'لا توجد تجارب بعد' : 'No experiences yet'}
                        </span>
                    ) : (
                        <div className="flex items-center gap-1.5 text-sm font-bold">
                            <span className="text-green-600 dark:text-green-400">{trustScore}</span>
                            <span className="text-slate-300 dark:text-slate-600">/</span>
                            <span className="text-red-500 dark:text-red-400">{complainPercent}</span>
                        </div>
                    )}
                </div>

                {/* Tug-of-War Progress Bar */}
                {totalVotes === 0 ? (
                    <div className="w-full rounded-full h-4 overflow-hidden flex shadow-inner border border-slate-200 dark:border-slate-700 mb-4">
                        <div className="bg-slate-300 dark:bg-slate-600 h-4 w-1/2 flex items-center justify-end">
                            <span className="text-[10px] font-bold text-slate-500/70 pr-1.5">⚖️</span>
                        </div>
                        <div className="bg-slate-300 dark:bg-slate-600 h-4 w-1/2 border-l border-slate-400/30 dark:border-slate-500/30 flex items-center justify-start">
                            <span className="text-[10px] font-bold text-slate-500/70 pl-1.5">⚖️</span>
                        </div>
                    </div>
                ) : (
                    <div className="w-full rounded-full h-4 overflow-hidden flex shadow-inner border border-slate-200 dark:border-slate-700 mb-4">
                        <div
                            className="bg-gradient-to-r from-green-400 to-green-500 h-4 transition-all duration-1000 ease-out flex items-center justify-end"
                            style={{ width: `${greenWidth}%` }}
                        >
                            {greenWidth >= 20 && <span className="text-[10px] font-bold text-white/90 pr-1.5">👍</span>}
                        </div>
                        <div
                            className="bg-gradient-to-r from-red-400 to-red-500 h-4 transition-all duration-1000 ease-out flex items-center justify-start"
                            style={{ width: `${redWidth}%` }}
                        >
                            {redWidth >= 20 && <span className="text-[10px] font-bold text-white/90 pl-1.5">👎</span>}
                        </div>
                    </div>
                )}

                {/* Recommend/Complain Count Badges */}
                <div className={`flex justify-between text-xs font-bold px-1 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">
                        👍 {business.recommends || 0} {t.recommend}
                    </div>
                    <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                        {business.complains || 0} {t.complain} 👎
                    </div>
                </div>

                {/* Inline Review Block */}
                <div className="[&>div]:mt-0 [&>div]:shadow-none [&>div]:border-0 [&>div]:p-0 [&>div]:rounded-none">
                    {/* InlineReviewBlock is rendered by the server page, not duplicated here */}
                </div>
            </div>

            {/* ── Community Logs History ────────────────────── */}
            <div className="mt-12">
                <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                    <span className="w-2 h-8 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                    {t.communityReviews}
                </h3>
                {logs && logs.length > 0 ? (
                    <StorefrontLogEntries logs={logs} isRTL={isRTL} theme={theme} />
                ) : (
                    <div className="p-8 md:p-12 rounded-[2rem] bg-slate-50 dark:bg-slate-900/50 border border-slate-200 border-dashed dark:border-slate-800 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl mb-4 opacity-50">💬</div>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-sm">
                            {t.noLogsYet}
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
