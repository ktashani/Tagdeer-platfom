'use client';

import React, { useState, useEffect, memo } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { ThumbsUp, ThumbsDown, BadgeCheck } from 'lucide-react';

function LogItem({ log }) {
    const { t, showToast, lang, supabase, user } = useTagdeer();
    const [isExpanded, setIsExpanded] = useState(false);

    const [votedType, setVotedType] = useState(null);
    const [localVotes, setLocalVotes] = useState({
        up: log.helpful_votes || 0,
        down: log.unhelpful_votes || 0
    });

    // Initial load of votes from props and voted status from localStorage
    useEffect(() => {
        setLocalVotes({
            up: log.helpful_votes || 0,
            down: log.unhelpful_votes || 0
        });

        const storedVote = localStorage.getItem(`tagdeer_vote_${log.id}`);
        if (storedVote) {
            setVotedType(storedVote);
        }
    }, [log.helpful_votes, log.unhelpful_votes, log.id]);

    // Fallbacks since our mock logs might not have these yet
    const isVerifiedAuthor = log.is_verified_author ?? false;
    const authorName = log.author_name || (log.profile_id ? 'VIP User' : 'Anonymous');
    const textLimit = 150;
    const isLong = log.text.length > textLimit;
    const displayText = isExpanded ? log.text : log.text.substring(0, textLimit) + (isLong ? '...' : '');

    // Identify if the current viewer is the author (either via profile or fingerprint)
    // Note: parentheses around the fingerprint comparison are required due to JS operator precedence
    const isOwner = (user && log.profile_id === user.id) || (!user && (log.fingerprint === getDeviceFingerprint()));

    const handleVote = async (voteType) => {
        if (votedType) return; // Prevent double voting locally

        const translatedType = voteType === 'up' ? (lang === 'ar' ? 'أعجبني' : 'Up') : (lang === 'ar' ? 'لم يعجبني' : 'Down');

        // Optimistic UI Update
        setLocalVotes(prev => ({
            ...prev,
            [voteType]: prev[voteType] + 1
        }));
        setVotedType(voteType);
        showToast(t('vote_mock_toast', { voteType: translatedType }));

        // Database Update
        if (supabase) {
            try {
                const fingerprint = getDeviceFingerprint();

                // Use upsert with conflict handling to prevent duplicate votes.
                // Requires DB unique constraints on (log_id, profile_id) and (log_id, fingerprint).
                await supabase.from('log_votes').upsert([{
                    log_id: log.id,
                    vote_type: voteType,
                    profile_id: user?.id || null,
                    fingerprint: user ? null : fingerprint
                }], { onConflict: user?.id ? 'log_id,profile_id' : 'log_id,fingerprint', ignoreDuplicates: true });

                // Persist the fact that THIS browser voted on THIS log
                localStorage.setItem(`tagdeer_vote_${log.id}`, voteType);
            } catch (err) {
                console.error("Failed to submit vote:", err);
            }
        }
    };

    return (
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm flex flex-col gap-2 relative">
            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        {log.type === 'recommend' ? <ThumbsUp className="h-4 w-4 text-green-500" /> : <ThumbsDown className="h-4 w-4 text-red-500" />}
                        {isVerifiedAuthor && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 uppercase" title="Verified Tagdeer Consumer">
                                <BadgeCheck className="w-3 h-3" /> VIP
                            </div>
                        )}
                        <span className="text-slate-700 font-bold">{authorName}</span>
                        <span className="text-slate-400 text-[10px] ml-2">{log.date}</span>
                    </div>
                </div>

                {log.receipt_url && (
                    <div className="flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded text-[10px] font-bold" title="Verified Purchase">
                        📎 Receipt Attached
                    </div>
                )}
            </div>

            <p className="text-slate-600 leading-relaxed mt-1">
                {displayText}
                {isLong && (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="text-blue-600 font-bold ml-1 hover:underline">
                        {isExpanded ? t('show_less', 'Show Less') : t('see_more', 'See More')}
                    </button>
                )}
            </p>

            <div className="flex items-center gap-2 mt-2 pt-3 border-t border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-2">Community</span>
                <button
                    onClick={() => handleVote('up')}
                    disabled={!!votedType || isOwner}
                    className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1.5 rounded transition-colors group ${votedType === 'up' ? 'text-green-700 bg-green-100' : 'text-slate-500 hover:text-green-600 hover:bg-green-50'} ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isOwner ? (lang === 'ar' ? 'لا يمكنك التصويت لتعليقك الخاص' : 'You cannot vote on your own log') : ''}
                >
                    <ThumbsUp className={`w-3.5 h-3.5 ${votedType === 'up' ? 'fill-green-200' : 'group-hover:fill-green-100'}`} />
                    <span className={localVotes.up > 0 ? "text-green-600" : ""}>{localVotes.up}</span>
                </button>
                <div className="w-px h-3 bg-slate-200"></div>
                <button
                    onClick={() => handleVote('down')}
                    disabled={!!votedType || isOwner}
                    className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1.5 rounded transition-colors group ${votedType === 'down' ? 'text-red-700 bg-red-100' : 'text-slate-500 hover:text-red-600 hover:bg-red-50'} ${isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isOwner ? (lang === 'ar' ? 'لا يمكنك التصويت لتعليقك الخاص' : 'You cannot vote on your own log') : ''}
                >
                    <ThumbsDown className={`w-3.5 h-3.5 ${votedType === 'down' ? 'fill-red-200' : 'group-hover:fill-red-100'}`} />
                    <span className={localVotes.down > 0 ? "text-red-600" : ""}>{localVotes.down}</span>
                </button>
                <span className="ml-auto text-xs text-slate-400 italic">
                    {isOwner ? (lang === 'ar' ? 'تعليقك الشخصي' : 'Your own log') : 'Does this help?'}
                </span>
            </div>
        </div>
    );
}

export default memo(LogItem);
