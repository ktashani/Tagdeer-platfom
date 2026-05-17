"use client";

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2, SendHorizontal, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useTagdeer } from '@/context/TagdeerContext';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { calculateVoteWeight } from '@/lib/trustEngine';
import { useVoteSubmission } from '@/hooks/useVoteSubmission';

/**
 * InlineReviewBlock — Premium "Share Your Experience" voting component.
 * Visually prominent with themed gradient background, homogeneous with storefront design.
 * Mobile-first responsive layout.
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
        setUser,
        showToast, setShowLimitModal, setBusinesses
    });

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [selectedType, setSelectedType] = useState(null);
    const [reasonText, setReasonText] = useState('');
    const [impactWeight, setImpactWeight] = useState(null);
    const [tosAccepted, setTosAccepted] = useState(false);

    const primaryColor = theme?.primaryColor || '#10b981';

    const t = isRTL ? {
        title: 'شاركنا تقديرك',
        subtitle: 'رأيك يصنع الفرق — ساعد المجتمع باختيارك',
        recommend: 'أنصح به',
        complain: 'لا أنصح به',
        reasonPlaceholder: 'أخبرنا عن تجربتك... (اختياري)',
        submit: 'إرسال التقييم',
        thanks: 'شكراً لمشاركتك!',
        thanksSubtitle: 'تقييمك يساعد المجتمع في اتخاذ قرار أفضل',
        error: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
        sending: 'جاري الإرسال...',
        cooldown: 'لقد قيّمت هذا النشاط مؤخرًا. يرجى الانتظار 24 ساعة.',
        shieldRequired: 'يتطلب هذا النشاط تسجيل الدخول لإضافة شكوى.',
        receiptRequired: 'يتطلب هذا النشاط رفع فاتورة لإضافة شكوى.',
        impact: 'قوة تأثيرك'
    } : {
        title: 'Share Your Experience',
        subtitle: 'Your opinion makes a difference — help the community decide',
        recommend: 'Recommend',
        complain: 'Complain',
        reasonPlaceholder: 'Tell us about your experience... (Optional)',
        submit: 'Submit Review',
        thanks: 'Thank you!',
        thanksSubtitle: 'Your review helps the community make better decisions',
        error: 'An error occurred. Please try again.',
        sending: 'Sending...',
        cooldown: 'You recently rated this business. Please wait 24 hours.',
        shieldRequired: 'This business requires login to complain.',
        receiptRequired: 'This business requires a receipt to complain.',
        impact: 'Your Impact Power'
    };

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
            const result = await executeVote(
                businessId,
                selectedType,
                reasonText || '',
                business?.isClaimed || false
            );

            if (result) {
                const weight = calculateVoteWeight(user, 0);
                setImpactWeight(weight);
                setSuccess(true);
            }
        } catch (err) {
            console.error('Error submitting review:', err);
            setError(t.error);
        } finally {
            setLoading(false);
        }
    };

    // ── Success State ──────────────────────────────────
    if (success) {
        return (
            <div className="mt-8 relative overflow-hidden rounded-3xl">
                <div
                    className="absolute inset-0 opacity-10"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}40)` }}
                />
                <div className="relative p-8 md:p-10 text-center">
                    <div
                        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg"
                        style={{ backgroundColor: `${primaryColor}20` }}
                    >
                        <Sparkles className="w-10 h-10" style={{ color: primaryColor }} />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-2">{t.thanks}</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{t.thanksSubtitle}</p>
                    {impactWeight && (
                        <div
                            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-sm font-bold"
                            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                        >
                            ⚡ {t.impact}: +{impactWeight}x
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── Main Form ──────────────────────────────────────
    return (
        <div className="mt-8 relative overflow-hidden rounded-3xl">
            {/* Themed gradient background */}
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(135deg, ${primaryColor}08, ${primaryColor}04, transparent)`
                }}
            />
            <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-20"
                style={{ backgroundColor: primaryColor }}
            />

            <div className="relative p-6 md:p-8 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl backdrop-blur-sm">
                {/* Header with themed accent */}
                <div className="text-center mb-6">
                    <div
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-3"
                        style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        {isRTL ? 'تقديرك' : 'Your Tagdeer'}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-2">
                        {t.title}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-md mx-auto">
                        {t.subtitle}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-4">
                    {/* Vote Type Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => handleTypeSelect('recommend')}
                            disabled={loading}
                            className={`relative flex flex-col items-center justify-center py-5 md:py-7 rounded-2xl border-2 transition-all duration-300 gap-2.5 ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'} ${selectedType === 'recommend'
                                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/30 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/10'
                                }`}
                        >
                            {selectedType === 'recommend' && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all ${selectedType === 'recommend'
                                    ? 'bg-emerald-100 dark:bg-emerald-800/40 scale-110'
                                    : 'bg-slate-100 dark:bg-slate-700'
                                }`}>
                                👍
                            </div>
                            <span className="font-bold text-sm">{t.recommend}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleTypeSelect('complain')}
                            disabled={loading}
                            className={`relative flex flex-col items-center justify-center py-5 md:py-7 rounded-2xl border-2 transition-all duration-300 gap-2.5 ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'} ${selectedType === 'complain'
                                ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 shadow-lg shadow-rose-100 dark:shadow-rose-900/20'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-500 hover:border-rose-300 hover:bg-rose-50/30 dark:hover:border-rose-800 dark:hover:bg-rose-900/10'
                                }`}
                        >
                            {selectedType === 'complain' && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                            )}
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all ${selectedType === 'complain'
                                    ? 'bg-rose-100 dark:bg-rose-800/40 scale-110'
                                    : 'bg-slate-100 dark:bg-slate-700'
                                }`}>
                                👎
                            </div>
                            <span className="font-bold text-sm">{t.complain}</span>
                        </button>
                    </div>

                    {/* Expandable Review Form */}
                    {selectedType && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <textarea
                                value={reasonText}
                                onChange={(e) => setReasonText(e.target.value)}
                                placeholder={t.reasonPlaceholder}
                                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 resize-none h-24 text-sm dark:text-white placeholder-slate-400 transition-all"
                                style={{ '--tw-ring-color': primaryColor }}
                            />

                            {error && (
                                <p className="text-rose-500 text-sm text-center">{error}</p>
                            )}

                            {/* ═══ LEGAL CONSENT GATE ═══ */}
                            <label className="flex items-start gap-2.5 text-xs text-slate-500 cursor-pointer select-none bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={tosAccepted}
                                    onChange={(e) => setTosAccepted(e.target.checked)}
                                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                                />
                                <span className="leading-relaxed">
                                    {isRTL
                                        ? <>أفهم أن هذا رأيي الشخصي وأتحمل المسؤولية الكاملة عن كلماتي. أوافق على <Link href="/terms" className="text-blue-600 hover:underline font-semibold" target="_blank">شروط الاستخدام</Link>.</>
                                        : <>I understand this is my personal opinion and I take full responsibility for my words. I agree to the <Link href="/terms" className="text-blue-600 hover:underline font-semibold" target="_blank">Terms of Use</Link>.</>
                                    }
                                </span>
                            </label>

                            <button
                                type="submit"
                                disabled={loading || !tosAccepted}
                                className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg hover:shadow-xl disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2.5 active:scale-[0.98]"
                                style={{
                                    backgroundColor: tosAccepted ? primaryColor : '#94a3b8',
                                    boxShadow: tosAccepted ? `0 8px 24px ${primaryColor}30` : 'none'
                                }}
                            >
                                {loading ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> {t.sending}</>
                                ) : (
                                    <><SendHorizontal className="w-5 h-5" /> {t.submit}</>
                                )}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
