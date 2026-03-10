"use client";

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Loader2, ShieldAlert, LogIn } from 'lucide-react';
import { useTagdeer } from '@/context/TagdeerContext';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { calculateVoteWeight } from '@/lib/trustEngine';

/**
 * InlineReviewBlock — Storefront voting component.
 * Uses the SAME voting logic as the Discover page (cooldown, weight, limits, shield checks).
 * Inserts into the main `logs` table (not consumer_logs) for system integrity.
 */
export function InlineReviewBlock({ businessId, business, isRTL, theme }) {
    const {
        user, supabase, lang,
        anonInteractions, setAnonInteractions,
        showToast, setShowLimitModal, setShowLoginModal,
        refreshAnonInteractions
    } = useTagdeer();

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
            const fingerprint = getDeviceFingerprint();
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            // ── Step 0: Server-side anonymous limit ──
            if (!user) {
                const { count: anonTotal, error: anonErr } = await supabase
                    .from('logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('fingerprint', fingerprint)
                    .gte('created_at', twentyFourHoursAgo);

                if (!anonErr && anonTotal >= 3) {
                    setShowLimitModal(true);
                    setLoading(false);
                    return;
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
                showToast(t.cooldown);
                setLoading(false);
                return;
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
            const weight = calculateVoteWeight(user, safeCount);
            setImpactWeight(weight);

            // ── Step 4: Insert into main logs table ──
            const { error: insertErr } = await supabase.from('logs').insert([{
                business_id: businessId,
                interaction_type: selectedType,
                reason_text: reasonText || null,
                profile_id: user?.id || null,
                fingerprint: fingerprint,
                weight: weight
            }]);

            if (insertErr) {
                console.error("Storefront vote insert error:", insertErr);
                setError(t.error);
                setLoading(false);
                return;
            }

            // ✅ BUG-01 FIX: Award Gader Points atomically via RPC
            if (user?.id) {
                try {
                    const earnedPoints = Math.max(5, Math.min(25, Math.round(weight * 10)));
                    await supabase.rpc('increment_gader_points', {
                        p_profile_id: user.id,
                        p_amount: earnedPoints,
                    });
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

            setSuccess(true);
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
                            className={`flex flex-col items-center justify-center flex-1 py-4 md:py-6 rounded-2xl border-2 transition-all gap-2 ${selectedType === 'recommend'
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
                            className={`flex flex-col items-center justify-center flex-1 py-4 md:py-6 rounded-2xl border-2 transition-all gap-2 ${selectedType === 'complain'
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
