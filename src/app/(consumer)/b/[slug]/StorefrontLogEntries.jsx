'use client';

import { useState, useEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, BadgeCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTagdeer } from '@/context/TagdeerContext';
import { getDeviceFingerprint } from '@/lib/fingerprint';

/**
 * StorefrontLogEntries — Horizontal snap carousel for community reviews.
 * Shows 3 cards per view on desktop, 1.2 on mobile (peek-ahead).
 * CSS scroll-snap for smooth touch swiping.
 */
export default function StorefrontLogEntries({ logs, isRTL, theme }) {
    const { user, supabase, showToast } = useTagdeer();
    const lang = isRTL ? 'ar' : 'en';
    const scrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

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

    const checkScrollability = () => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 10);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        checkScrollability();
        el.addEventListener('scroll', checkScrollability, { passive: true });
        return () => el.removeEventListener('scroll', checkScrollability);
    }, [logs.length]);

    const scroll = (direction) => {
        const el = scrollRef.current;
        if (!el) return;
        const cardWidth = el.querySelector('[data-log-card]')?.offsetWidth || 300;
        el.scrollBy({ left: direction * cardWidth * 3, behavior: 'smooth' });
    };

    return (
        <div className="relative group">
            {/* Navigation Arrows (desktop only) */}
            {canScrollLeft && (
                <button
                    onClick={() => scroll(-1)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-20 w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all opacity-0 group-hover:opacity-100 hidden md:flex"
                    aria-label="Scroll left"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            )}
            {canScrollRight && (
                <button
                    onClick={() => scroll(1)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-20 w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all opacity-0 group-hover:opacity-100 hidden md:flex"
                    aria-label="Scroll right"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            )}

            {/* Horizontal Snap Carousel */}
            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-2 -mx-1 px-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                dir={isRTL ? 'rtl' : 'ltr'}
            >
                {logs.map(log => (
                    <div
                        key={log.id}
                        data-log-card
                        className="snap-start shrink-0 w-[85vw] sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.75rem)]"
                    >
                        <LogEntryCard
                            log={log}
                            user={user}
                            supabase={supabase}
                            showToast={showToast}
                            isRTL={isRTL}
                            theme={theme}
                            t={t}
                            lang={lang}
                        />
                    </div>
                ))}
            </div>

            {/* Scroll Indicators (mobile) */}
            {logs.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-4 md:hidden">
                    {logs.slice(0, Math.min(logs.length, 10)).map((log, i) => (
                        <div
                            key={log.id}
                            className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 transition-all"
                        />
                    ))}
                    {logs.length > 10 && <span className="text-[10px] text-slate-400 ml-1">+{logs.length - 10}</span>}
                </div>
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

    useEffect(() => {
        const storedVote = localStorage.getItem(`tagdeer_vote_${log.id}`);
        if (storedVote) setVotedType(storedVote);
    }, [log.id]);

    const isOwner = (user && log.profile_id === user.id) ||
        (!user && (log.fingerprint === getDeviceFingerprint()));

    const handleVote = async (voteType) => {
        if (votedType || isOwner) return;
        setLocalVotes(prev => ({ ...prev, [voteType]: prev[voteType] + 1 }));
        setVotedType(voteType);
        showToast(t.voteToast(voteType));

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
    const isRecommend = log.interaction_type === 'recommend';

    return (
        <div className={`h-full flex flex-col p-5 rounded-2xl border transition-all duration-200 hover:shadow-md ${
            isRecommend
                ? 'bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-slate-900 border-emerald-100 dark:border-emerald-900/30'
                : 'bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/30 dark:to-slate-900 border-rose-100 dark:border-rose-900/30'
        }`}>
            {/* Header */}
            <div className={`flex items-center gap-3 mb-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                    isRecommend
                        ? 'bg-emerald-100 dark:bg-emerald-900/40'
                        : 'bg-rose-100 dark:bg-rose-900/40'
                }`}>
                    {isRecommend ? '👍' : '👎'}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white text-sm truncate flex items-center gap-1">
                        {authorName}
                        {isVerifiedAuthor && <BadgeCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        {new Date(log.created_at).toLocaleDateString(isRTL ? 'ar-LY' : 'en-US', { month: 'short', day: 'numeric' })}
                    </p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-widest shrink-0 ${
                    isRecommend
                        ? 'bg-emerald-200/60 text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-300'
                        : 'bg-rose-200/60 text-rose-700 dark:bg-rose-800/40 dark:text-rose-300'
                }`}>
                    {isRecommend ? t.recommend : t.complain}
                </span>
            </div>

            {/* Reason Text */}
            <div className="flex-1">
                {log.reason_text ? (
                    <p className={`text-slate-600 dark:text-slate-300 text-sm leading-relaxed line-clamp-3 ${isRTL ? 'text-right' : ''}`}>
                        "{log.reason_text}"
                    </p>
                ) : (
                    <p className={`text-slate-400 dark:text-slate-500 text-sm italic ${isRTL ? 'text-right' : ''}`}>
                        {isRecommend ? (isRTL ? 'تجربة إيجابية' : 'Positive experience') : (isRTL ? 'تجربة سلبية' : 'Negative experience')}
                    </p>
                )}
            </div>

            {/* Vote Buttons */}
            <div className={`flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button
                    onClick={() => handleVote('up')}
                    disabled={!!votedType || isOwner}
                    className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${votedType === 'up' ? 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                            : 'text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        } ${isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                    <ThumbsUp className="w-3.5 h-3.5" /> {localVotes.up}
                </button>
                <button
                    onClick={() => handleVote('down')}
                    disabled={!!votedType || isOwner}
                    className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${votedType === 'down' ? 'text-rose-700 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                        } ${isOwner ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                    <ThumbsDown className="w-3.5 h-3.5" /> {localVotes.down}
                </button>
            </div>
        </div>
    );
}
