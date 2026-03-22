"use client";

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Loader2, ShieldAlert, LogIn } from 'lucide-react';
import { useTagdeer } from '@/context/TagdeerContext';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { calculateVoteWeight } from '@/lib/trustEngine';
import { useVoteSubmission } from '@/hooks/useVoteSubmission';

/**
 * InlineReviewBlock — Storefront voting component.
 * Uses the SAME voting logic as the Discover page (cooldown, weight, limits, shield checks).
 * Inserts into the main `logs` table (not consumer_logs) for system integrity.
 */
export function InlineReviewBlock({ businessId, business, isRTL, theme }) {
    const {
        user, supabase, lang,
        anonInteractions, setAnonInteractions,
        setUser, showToast, setShowLimitModal, setShowLoginModal,
        refreshAnonInteractions, setBusinesses
    } = useTagdeer();

    const { submitVote: executeVote } = useVoteSubmission({
        user, supabase, lang,
        anonInteractions, setAnonInteractions,
        setUser, // Phase 2d fix: propagate Gader points to UI
        showToast, setShowLimitModal, setBusinesses
    });

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [selectedType, setSelectedType] = useState(null);
    const [reasonText, setReasonText] = useState('');
    const [impactWeight, setImpactWeight] = useState(null);

    const t = isRTL ? {
        title: 'قيّم تجربتك',
        desc: 'رأيك يهمنا ويساعد الآخرين',
        recommend: 'أنصح به',
        complain: 'لا أنصح به',
        reasonPlaceholder: 'ما سبب تقييمك؟ (اختياري)',
        submit: 'إرسال التقييم',
        thanks: 'شكراً لمشاركتك!',
        error: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
        sending: 'جاري الإرسال...',
        cooldown: 'لقد قيّمت هذا النشاط مؤخرًا. يرجى الانتظار 24 ساعة.',
        shieldRequired: 'يتطلب هذا النشاط تسجيل الدخول لإضافة شكوى.',
        receiptRequired: 'يتطلب هذا النشاط رفع فاتورة لإضافة شكوى.',
        impact: 'قوة التأثير'
    } : {
        title: 'Rate Your Experience',
        desc: 'Your opinion helps others',
        recommend: 'Recommend',
        complain: 'Complain',
        reasonPlaceholder: 'What is the reason? (Optional)',
        submit: 'Submit Review',
        thanks: 'Thank you for your feedback!',
        error: 'An error occurred. Please try again.',
        sending: 'Sending...',
        cooldown: 'You recently rated this business. Please wait 24 hours.',
        shieldRequired: 'This business requires login to complain.',
        receiptRequired: 'This business requires a receipt to complain.',
        impact: 'Impact Power'
    };

    // Shield check before allowing complain selection
    const handleTypeSelect = async (type) => {
        if (type === 'complain' && business) {
            if (business.shield_level === 2) {
                showToast(t.receiptRequired);
                return;
            }
            if (business.shield_level === 1 || business.isShielded) {
                if (!user) {
                    showToast(t.shieldRequired);
                    setShowLoginModal(true);
                    return;
                }
            }
        }

        // Anonymous limit check
        if (!user) {
            const currentCount = await refreshAnonInteractions();
            if (currentCount >= 3) {
                setShowLimitModal(true);
                return;
            }
        }

        setSelectedType(type);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedType || !supabase) return;

        setLoading(true);
        setError('');

        try {
            const success = await executeVote(
                businessId,
                selectedType,
                reasonText || '',
                business?.isClaimed || false
            );

            if (success) {
                const fingerprint = getDeviceFingerprint();
                const weight = calculateVoteWeight(user, 0);
                setImpactWeight(weight);
                setSuccess(true);
            } else {
                // Vote was blocked (cooldown, limit, etc.) — toast already shown by hook
            }
        } catch (err) {
            console.error('Error submitting review:', err);
            setError(t.error);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="mt-8 p-8 rounded-3xl bg-emerald-50 dark:bg-emerald-900/20 shadow-sm border border-emerald-100 dark:border-emerald-800/30 text-center animate-in fade-in slide-in-from-bottom-4">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ThumbsUp className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mb-2">{t.thanks}</h3>
                {impactWeight && (
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mt-2">
                        {t.impact}: +{impactWeight}x
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="mt-8 p-6 md:p-8 rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 dark:bg-slate-800/50 rounded-full blur-3xl -mr-10 -mt-10" />

            <div className="relative z-10">
                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2">{t.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm md:text-base">{t.desc}</p>

                <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => handleTypeSelect('recommend')}
                            disabled={loading}
                            className={`flex flex-col items-center justify-center flex-1 py-4 md:py-6 rounded-2xl border-2 transition-all gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${selectedType === 'recommend'
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50/50 dark:hover:border-emerald-900/50'
                                }`}
                        >
                            <div className={`p-3 rounded-full ${selectedType === 'recommend' ? 'bg-emerald-200/50 dark:bg-emerald-800/50' : 'bg-white dark:bg-slate-700'} shadow-sm`}>
                                <ThumbsUp className="w-6 h-6 md:w-8 md:h-8" />
                            </div>
                            <span className="font-bold">{t.recommend}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleTypeSelect('complain')}
                            disabled={loading}
                            className={`flex flex-col items-center justify-center flex-1 py-4 md:py-6 rounded-2xl border-2 transition-all gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${selectedType === 'complain'
                                ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
                                : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:border-rose-200 hover:bg-rose-50/50 dark:hover:border-rose-900/50'
                                }`}
                        >
                            <div className={`p-3 rounded-full ${selectedType === 'complain' ? 'bg-rose-200/50 dark:bg-rose-800/50' : 'bg-white dark:bg-slate-700'} shadow-sm`}>
                                <ThumbsDown className="w-6 h-6 md:w-8 md:h-8" />
                            </div>
                            <span className="font-bold">{t.complain}</span>
                        </button>
                    </div>

                    {selectedType && (
                        <div className="animate-in fade-in slide-in-from-top-2 pt-4">
                            <textarea
                                value={reasonText}
                                onChange={(e) => setReasonText(e.target.value)}
                                placeholder={t.reasonPlaceholder}
                                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 resize-none h-24 text-sm dark:text-white"
                                style={{ focusRingColor: theme.primaryColor }}
                            />

                            {error && (
                                <p className="text-rose-500 text-sm mt-2">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-4 py-4 rounded-xl text-white font-bold text-lg shadow-md hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                style={{ backgroundColor: theme.primaryColor }}
                            >
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                {loading ? t.sending : t.submit}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
