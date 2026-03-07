"use client";

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';

export function InlineReviewBlock({ businessId, isRTL, theme }) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [selectedType, setSelectedType] = useState(null);
    const [reasonText, setReasonText] = useState('');

    const t = isRTL ? {
        title: 'قيّم تجربتك',
        desc: 'رأيك يهمنا ويساعد الآخرين',
        recommend: 'أنصح به',
        complain: 'لا أنصح به',
        reasonPlaceholder: 'ما سبب تقييمك؟ (اختياري)',
        submit: 'إرسال التقييم',
        thanks: 'شكراً لمشاركتك!',
        error: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
        sending: 'جاري الإرسال...'
    } : {
        title: 'Rate Your Experience',
        desc: 'Your opinion helps others',
        recommend: 'Recommend',
        complain: 'Complain',
        reasonPlaceholder: 'What is the reason? (Optional)',
        submit: 'Submit Review',
        thanks: 'Thank you for your feedback!',
        error: 'An error occurred. Please try again.',
        sending: 'Sending...'
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedType) return;

        setLoading(true);
        setError('');

        try {
            // First submit the log
            const logRes = await fetch('/api/consumer/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    business_id: businessId,
                    interaction_type: selectedType,
                    reason_text: reasonText || null,
                })
            });

            if (!logRes.ok) throw new Error('Failed to submit log');

            // Then update the business counters
            await fetch(`/api/consumer/business-stats?id=${businessId}&type=${selectedType}`, {
                method: 'POST'
            });

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
                            onClick={() => setSelectedType('recommend')}
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
                            onClick={() => setSelectedType('complain')}
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
