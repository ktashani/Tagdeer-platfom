'use client';

import { useState, useCallback } from 'react';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { calculateVoteWeight } from '@/lib/trustEngine';

/**
 * useVoteSubmission — Shared vote submission logic.
 *
 * Consolidates the duplicated voting flow from layout.jsx and InlineReviewBlock.jsx.
 * Handles: anonymous limits, 24h cooldown, 30-day diminishing returns,
 * weight calculation, log insertion, Gader point awarding, and anonymous tracking.
 *
 * @param {object} params
 * @param {object|null} params.user - Current user from context
 * @param {object|null} params.supabase - Supabase client from context
 * @param {string} params.lang - Language code ('ar' or 'en')
 * @param {number} params.anonInteractions - Current anonymous interaction count
 * @param {function} params.setAnonInteractions - Setter for anonymous interaction count
 * @param {function} params.setUser - Setter for user object (to update Gader points)
 * @param {function} params.showToast - Toast notification function
 * @param {function} params.setShowLimitModal - Setter to show anonymous limit modal
 */
export function useVoteSubmission({
    user,
    supabase,
    lang,
    anonInteractions,
    setAnonInteractions,
    setUser,
    showToast,
    setShowLimitModal,
    setBusinesses // Added to instantly reflect new logs
}) {
    const [impactBubble, setImpactBubble] = useState(null);

    /**
     * Submit a vote for a business.
     *
     * @param {string} businessId - UUID of the business
     * @param {string} type - 'recommend' or 'complain'
     * @param {string} reasonText - Optional reason text
     * @param {boolean} isClaimed - Whether the business is claimed
     * @returns {Promise<boolean>} true if vote was submitted successfully
     */
    const submitVote = useCallback(async (businessId, type, reasonText = '', isClaimed = false) => {
        // Block merchant accounts from voting
        if (user?.role === 'merchant') {
            showToast(lang === 'ar'
                ? 'حسابات التجار لا يمكنها التصويت. استخدم حساب مستهلك.'
                : 'Merchant accounts cannot vote. Use a consumer account.'
            );
            return false;
        }

        const fingerprint = getDeviceFingerprint();
        let weight = calculateVoteWeight(user, 0);

        if (supabase) {
            try {
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

                // ── Step 0: Server-side anonymous vote limit (3 per 24h) ──
                if (!user) {
                    const { count: anonTotal, error: anonErr } = await supabase
                        .from('logs')
                        .select('*', { count: 'exact', head: true })
                        .eq('fingerprint', fingerprint)
                        .gte('created_at', twentyFourHoursAgo);

                    if (!anonErr && anonTotal >= 3) {
                        setShowLimitModal(true);
                        return false;
                    }
                }

                // ── Step 1: 24-Hour Same-Business Cooldown ──
                const cooldownQuery = user?.id
                    ? supabase.from('logs').select('*', { count: 'exact', head: true })
                        .eq('business_id', businessId)
                        .eq('profile_id', user.id)
                        .gte('created_at', twentyFourHoursAgo)
                    : supabase.from('logs').select('*', { count: 'exact', head: true })
                        .eq('business_id', businessId)
                        .eq('fingerprint', fingerprint)
                        .gte('created_at', twentyFourHoursAgo);

                const { count: recentCount, error: cooldownErr } = await cooldownQuery;

                if (!cooldownErr && recentCount > 0) {
                    showToast(lang === 'ar'
                        ? 'لقد قيّمت هذا النشاط مؤخرًا. يرجى الانتظار 24 ساعة قبل تسجيل تجربة أخرى هنا.'
                        : 'You recently evaluated this business. Please wait 24 hours before logging another experience here.'
                    );
                    return false;
                }

                // ── Step 2: Diminishing Returns (30-day count) ──
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

                const diminishingQuery = user?.id
                    ? supabase.from('logs').select('*', { count: 'exact', head: true })
                        .eq('business_id', businessId)
                        .eq('profile_id', user.id)
                        .gte('created_at', thirtyDaysAgo)
                    : supabase.from('logs').select('*', { count: 'exact', head: true })
                        .eq('business_id', businessId)
                        .eq('fingerprint', fingerprint)
                        .gte('created_at', thirtyDaysAgo);

                const { count: pastVoteCount, error: dimErr } = await diminishingQuery;
                const safeCount = (!dimErr && pastVoteCount) ? pastVoteCount : 0;

                // ── Step 3: Calculate Dynamic Weight ──
                weight = calculateVoteWeight(user, safeCount);

                // ── Step 4: Insert with weight ──
                const { data: insertedLog, error } = await supabase.from('logs').insert([{
                    business_id: businessId,
                    interaction_type: type,
                    reason_text: typeof reasonText === 'string' && reasonText.trim() ? reasonText.trim() : null,
                    profile_id: user?.id || null,
                    fingerprint: fingerprint,
                    weight: weight
                }]).select().single();

                if (error) {
                    console.error("Supabase insert error:", error);
                    showToast(lang === 'ar' ? "حدث خطأ: " + error.message : "Error: " + error.message);
                    return false;
                }

                // Instantly inject the new log into the businesses state to solve "Missing Data"
                if (insertedLog && setBusinesses) {
                    setBusinesses(prev => prev.map(b => {
                        if (b.id === businessId) {
                            return {
                                ...b,
                                logs: [
                                    {
                                        id: insertedLog.id,
                                        type: insertedLog.interaction_type,
                                        text: insertedLog.reason_text || (insertedLog.interaction_type === 'recommend' ? 'User recommended' : 'User complained'),
                                        date: new Date(insertedLog.created_at).toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en-US'),
                                        created_at: insertedLog.created_at,
                                        is_verified: !!insertedLog.profile_id,
                                        helpful_votes: insertedLog.helpful_votes || 0,
                                        unhelpful_votes: insertedLog.unhelpful_votes || 0,
                                        fingerprint: insertedLog.fingerprint,
                                        profile_id: insertedLog.profile_id
                                    },
                                    ...(b.logs || [])
                                ]
                            };
                        }
                        return b;
                    }));
                }

            } catch (err) {
                console.error("Supabase insert exception:", err);
                showToast("Connection failed.");
                return false;
            }
        }

        // ── Award Gader Points atomically via RPC ──
        if (user?.id && supabase) {
            try {
                const earnedPoints = Math.max(5, Math.min(25, Math.round(weight * 10)));
                const { data: newPoints, error: rpcErr } = await supabase.rpc('increment_gader_points', {
                    p_profile_id: user.id,
                    p_amount: earnedPoints,
                });
                if (!rpcErr && newPoints !== null) {
                    setUser(prev => prev ? { ...prev, gader: newPoints } : prev);
                }
            } catch (e) {
                console.error('Error awarding points:', e);
            }
        }

        // Track anonymous vote count
        if (!user) {
            const currentCount = parseInt(localStorage.getItem('trust_ledger_interactions') || '0');
            const newCount = currentCount + 1;
            setAnonInteractions(newCount);
            localStorage.setItem('trust_ledger_interactions', newCount.toString());
        }

        // Trigger Impact Bubble animation locally AND globally
        const bubbleData = { weight, type };
        setImpactBubble(bubbleData);
        setTimeout(() => setImpactBubble(null), 2000);
        
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('trust-ledger-vote', { detail: bubbleData }));
        }

        // Show appropriate success toast
        // BUG FIX: Removed anon math that caused "[ no user logged in ] The success toast is showing a weird message"
        if (!isClaimed) {
            showToast(lang === 'ar'
                ? 'تم حفظ تقييمك في سجل الثقة. العرض العام مقيّد حالياً لأن صاحب النشاط لم يسجّل بعد.'
                : 'Your vote is saved in the Trust Ledger. The public view is currently limited because the owner has not claimed this business yet.');
        } else {
            showToast(lang === 'ar' ? 'تم تسجيل تقييمك بنجاح!' : 'Vote logged successfully!');
        }

        return { success: true, weight };
    }, [user, supabase, lang, anonInteractions, setAnonInteractions, setUser, showToast, setShowLimitModal, setBusinesses]);

    return { submitVote, impactBubble };
}
