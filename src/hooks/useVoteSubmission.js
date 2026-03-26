'use client';

import { useState, useCallback, useRef } from 'react';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { containsBadWords } from '@/lib/contentFilter';

/**
 * useVoteSubmission — Shared vote submission logic.
 *
 * Consolidates the duplicated voting flow from layout.jsx and InlineReviewBlock.jsx.
 * Handles: anonymous limits, 24h cooldown, 30-day diminishing returns,
 * weight calculation, log insertion, Gader point awarding, and anonymous tracking.
 *
 * ✅ Phase 1a: Now routes through server-side `submit_vote` RPC for security.
 * ✅ Phase 1b: Integrates content filter (bad word detection).
 * ✅ Phase 1e: Mutex lock prevents rapid-fire double submissions.
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
    const isSubmitting = useRef(false); // Phase 1e: mutex lock

    /**
     * Submit a vote for a business.
     *
     * @param {string} businessId - UUID of the business
     * @param {string} type - 'recommend' or 'complain'
     * @param {string} reasonText - Optional reason text
     * @param {boolean} isClaimed - Whether the business is claimed
     * @returns {Promise<boolean|object>} result object if successful, false if blocked
     */
    const submitVote = useCallback(async (businessId, type, reasonText = '', isClaimed = false) => {
        // Phase 1e: Mutex — prevent double submission
        if (isSubmitting.current) return false;
        isSubmitting.current = true;

        try {
            // Block merchant accounts from voting (client-side pre-check)
            if (user?.role === 'merchant') {
                showToast(lang === 'ar'
                    ? 'حسابات التجار لا يمكنها التصويت. استخدم حساب مستهلك.'
                    : 'Merchant accounts cannot vote. Use a consumer account.'
                );
                return false;
            }

            const fingerprint = getDeviceFingerprint();

            // Phase 1b: Content filter — flag if bad words detected
            const isFlagged = typeof reasonText === 'string' && reasonText.trim()
                ? containsBadWords(reasonText)
                : false;

            if (!supabase) {
                showToast("Connection failed.");
                return false;
            }

            // ── Call server-side submit_vote RPC ────────────────
            const rpcParams = {
                p_business_id: businessId,
                p_interaction_type: type,
                p_reason_text: typeof reasonText === 'string' && reasonText.trim() ? reasonText.trim() : null,
                p_profile_id: user?.id || null,
                p_fingerprint: fingerprint,
                p_is_flagged: isFlagged,
                p_receipt_url: null,
            };
            console.log('[submit_vote] calling RPC with:', rpcParams);
            const { data: result, error: rpcError } = await supabase.rpc('submit_vote', rpcParams);

            if (rpcError) {
                console.error("submit_vote RPC error:", JSON.stringify(rpcError), "message:", rpcError.message, "code:", rpcError.code, "details:", rpcError.details, "hint:", rpcError.hint);
                showToast(lang === 'ar' ? "حدث خطأ: " + (rpcError.message || 'Unknown') : "Error: " + (rpcError.message || 'Unknown'));
                return false;
            }

            // ── Handle server-side error responses ──────────────
            if (result?.error) {
                if (result.error === 'anonymous_weekly_limit') {
                    setShowLimitModal(true);
                    return false;
                }
                if (result.error === 'cooldown_active') {
                    showToast(lang === 'ar'
                        ? 'لقد قيّمت هذا النشاط مؤخرًا. يرجى الانتظار 24 ساعة قبل تسجيل تجربة أخرى هنا.'
                        : 'You recently evaluated this business. Please wait 24 hours before logging another experience here.'
                    );
                    return false;
                }
                if (result.error === 'Merchant accounts cannot vote') {
                    showToast(lang === 'ar'
                        ? 'حسابات التجار لا يمكنها التصويت.'
                        : 'Merchant accounts cannot vote.'
                    );
                    return false;
                }
                showToast(result.error);
                return false;
            }

            // ── Success — extract data from RPC response ────────
            const weight = result.weight;
            const logId = result.log_id;
            const createdAt = result.created_at;

            // Phase 1b: Notify user if content was flagged
            if (isFlagged) {
                showToast(lang === 'ar'
                    ? 'تم إرسال تقييمك للمراجعة. شكراً لمشاركتك!'
                    : 'Your review has been submitted for moderation. Thanks for sharing!'
                );
            }

            // Instantly inject the new log into the businesses state
            if (logId && setBusinesses) {
                setBusinesses(prev => prev.map(b => {
                    if (b.id === businessId) {
                        return {
                            ...b,
                            logs: [
                                {
                                    id: logId,
                                    type: type,
                                    text: result.reason_text || (type === 'recommend' ? 'User recommended' : 'User complained'),
                                    date: new Date(createdAt).toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en-US'),
                                    created_at: createdAt,
                                    is_verified: !!result.profile_id,
                                    helpful_votes: 0,
                                    unhelpful_votes: 0,
                                    fingerprint: result.fingerprint,
                                    profile_id: result.profile_id
                                },
                                ...(b.logs || [])
                            ]
                        };
                    }
                    return b;
                }));
            }

            // ── Update user's Gader points from server response ─
            if (user?.id && result.new_gader_total !== null && result.new_gader_total !== undefined) {
                setUser(prev => prev ? { ...prev, gader: result.new_gader_total } : prev);
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
                
                // Phase 4: Coupon Award Event
                if (result.coupon_awarded) {
                    window.dispatchEvent(new CustomEvent('trust-ledger-coupon', { detail: result.coupon_awarded }));
                }
            }

            // Phase 2b: Diminishing returns notification
            if (user && result.past_vote_count > 0) {
                if (result.past_vote_count === 1) {
                    showToast(lang === 'ar'
                        ? 'تم تسجيل تقييمك! تأثير تقييمك أقل لأنك قيّمت هذا النشاط مؤخرًا.'
                        : 'Vote logged! Your impact is reduced because you recently rated this business.'
                    );
                } else if (result.past_vote_count >= 2) {
                    showToast(lang === 'ar'
                        ? 'تم تسجيل تقييمك! تأثيرك محدود — جرّب تقييم نشاط مختلف.'
                        : 'Vote logged! Your impact is significantly reduced — try rating a different business.'
                    );
                }
            } else if (!isFlagged) {
                // Normal success toast (only if not already showing flagged toast)
                if (!isClaimed) {
                    showToast(lang === 'ar'
                        ? 'تم حفظ تقييمك في سجل الثقة. العرض العام مقيّد حالياً لأن صاحب النشاط لم يسجّل بعد.'
                        : 'Your vote is saved in the Trust Ledger. The public view is currently limited because the owner has not claimed this business yet.');
                } else {
                    showToast(lang === 'ar' ? 'تم تسجيل تقييمك بنجاح!' : 'Vote logged successfully!');
                }
            }

            return { success: true, weight };
        } finally {
            // Phase 1e: Always release the mutex
            isSubmitting.current = false;
        }
    }, [user, supabase, lang, anonInteractions, setAnonInteractions, setUser, showToast, setShowLimitModal, setBusinesses]);

    return { submitVote, impactBubble };
}
