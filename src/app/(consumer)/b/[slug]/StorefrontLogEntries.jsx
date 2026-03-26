'use client';

import { useState, useEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, BadgeCheck } from 'lucide-react';
import { useTagdeer } from '@/context/TagdeerContext';
import { getDeviceFingerprint } from '@/lib/fingerprint';

/**
 * StorefrontLogEntries — Client component for displaying community reviews
 * with helpful/unhelpful voting on storefronts.
 * Uses the same log_votes logic as the Discover page.
 */
export default function StorefrontLogEntries({ logs, isRTL, theme }) {
    const { user, supabase, showToast } = useTagdeer();
    const lang = isRTL ? 'ar' : 'en';

    const t = isRTL ? {
        recommend: 'أنصح به',
        complain: 'لا أنصح به',
        community: 'المجتمع',
        liked: 'أعجبني',
        disliked: 'لم يعجبني',
        selfVote: 'لا يمكنك التصويت لتعليقك',
        voteToast: (type) => type === 'up' ? '👍 أعجبني' : '👎 لم يعجبني'
    } : {
        recommend: 'Recommend',
        complain: 'Complain',
        community: 'Community',
        liked: 'Helpful',
        disliked: 'Unhelpful',
        selfVote: 'Cannot vote on your own log',
        voteToast: (type) => type === 'up' ? '👍 Helpful' : '👎 Unhelpful'
    };

    const [visibleCount, setVisibleCount] = useState(5);
    const visibleLogs = logs.slice(0, visibleCount);
    
    const containerRef = useRef(null);
    const prevLogsLength = useRef(logs.length);

    // Smooth scroll to top when a new log arrives (e.g. via realtime)
    useEffect(() => {
        if (logs.length > prevLogsLength.current && containerRef.current) {
            containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        prevLogsLength.current = logs.length;
    }, [logs.length]);

    const handleShowMore = () => {
        setVisibleCount(prev => prev + 5);
    };

    return (
        <div className="space-y-4">
            <div 
                ref={containerRef}
                className="max-h-[600px] overflow-y-auto pr-1 space-y-4 custom-scrollbar"
                style={{ scrollbarWidth: 'thin' }}
            >
                {visibleLogs.map(log => (
                    <LogEntryCard
                        key={log.id}
                        log={log}
                        user={user}
                        supabase={supabase}
                        showToast={showToast}
                        isRTL={isRTL}
                        theme={theme}
                        t={t}
                        lang={lang}
                    />
                ))}
            </div>
            
            {visibleCount < logs.length && (
                <button 
                    onClick={handleShowMore}
                    className="w-full py-3 text-sm font-bold text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                    {isRTL ? 'إظهار المزيد' : 'Show more reviews'}
                </button>
            )}
        </div>
    );
}

function LogEntryCard({ log, user, supabase, showToast, isRTL, theme, t, lang }) {
    const [localVotes, setLocalVotes] = useState({
        up: log.helpful_votes || 0,
        down: log.unhelpful_votes || 0
    });
    const [votedType, setVotedType] = useState(null);

    // Check localStorage for previous vote
    useEffect(() => {
        const storedVote = localStorage.getItem(`tagdeer_vote_${log.id}`);
        if (storedVote) setVotedType(storedVote);
    }, [log.id]);

    // Prevent self-voting
    const isOwner = (user && log.profile_id === user.id) ||
        (!user && (log.fingerprint === getDeviceFingerprint()));

    const handleVote = async (voteType) => {
        if (votedType || isOwner) return;

        // Optimistic UI
        setLocalVotes(prev => ({
            ...prev,
            [voteType]: prev[voteType] + 1
        }));
        setVotedType(voteType);
        showToast(t.voteToast(voteType));

        // DB update
        if (supabase) {
            try {
                const fingerprint = getDeviceFingerprint();
                await supabase.from('log_votes').upsert([{
                    log_id: log.id,
                    vote_type: voteType,
                    profile_id: user?.id || null,
                    fingerprint: user ? null : fingerprint
                }], {
                    onConflict: user?.id ? 'log_id,profile_id' : 'log_id,fingerprint',
                    ignoreDuplicates: true
                });
                localStorage.setItem(`tagdeer_vote_${log.id}`, voteType);
            } catch (err) {
                console.error('Failed to submit log vote:', err);
            }
        }
    };

    const isVerifiedAuthor = log.profile_id != null;
    const authorName = isVerifiedAuthor
        ? (isRTL ? 'عضو موثق' : 'Verified Member')
        : (isRTL ? 'مستخدم' : 'Anonymous');

    return (
        <div className="p-4 md:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-left">
            <div className={`flex items-start gap-4 mb-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 shrink-0 mt-1">
                    💬
                </div>
                <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                    <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
                        <p className="font-bold text-slate-900 dark:text-white text-lg leading-tight flex items-center gap-1.5">
                            {authorName}
                            {isVerifiedAuthor && (
                                <BadgeCheck className="w-4 h-4 text-blue-500 inline-block" />
                            )}
                        </p>
                        {log.interaction_type === 'recommend' ? (
                            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider leading-none self-start sm:self-auto">{t.recommend}</span>
                        ) : (
                            <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider leading-none self-start sm:self-auto">{t.complain}</span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 font-medium">
                        {new Date(log.created_at).toLocaleDateString(isRTL ? 'ar-LY' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                </div>
            </div>

            {log.reason_text && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className={`text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap ${isRTL ? 'text-right' : ''}`}>
                        "{log.reason_text}"
                    </p>
                </div>
            )}

            {/* Log Vote Buttons */}
            <div className={`flex items-center gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-2">{t.community}</span>
                <button
                    onClick={() => handleVote('up')}
                    disabled={!!votedType || isOwner}
                    className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1.5 rounded transition-colors group ${votedType === 'up' ? 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                            : 'text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        } ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isOwner ? t.selfVote : t.liked}
                >
                    <ThumbsUp className={`w-3.5 h-3.5 ${votedType === 'up' ? 'fill-green-200 dark:fill-green-800' : 'group-hover:fill-green-100'}`} />
                    <span className={localVotes.up > 0 ? "text-green-600 dark:text-green-400" : ""}>{localVotes.up}</span>
                </button>
                <div className="w-px h-3 bg-slate-200 dark:bg-slate-700"></div>
                <button
                    onClick={() => handleVote('down')}
                    disabled={!!votedType || isOwner}
                    className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1.5 rounded transition-colors group ${votedType === 'down' ? 'text-rose-700 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400'
                            : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                        } ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isOwner ? t.selfVote : t.disliked}
                >
                    <ThumbsDown className={`w-3.5 h-3.5 ${votedType === 'down' ? 'fill-rose-200 dark:fill-rose-800' : 'group-hover:fill-rose-100'}`} />
                    <span className={localVotes.down > 0 ? "text-rose-600 dark:text-rose-400" : ""}>{localVotes.down}</span>
                </button>
            </div>
        </div>
    );
}
