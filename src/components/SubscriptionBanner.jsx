'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * SubscriptionBanner — shows expiry warnings on merchant dashboard.
 * Displays when subscription is "Expiring Soon" or "Expired".
 */
export default function SubscriptionBanner() {
    const [subscription, setSubscription] = useState(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('subscriptions')
                .select('tier, status, expires_at')
                .eq('profile_id', user.id)
                .maybeSingle();

            if (data && (data.status === 'Expiring Soon' || data.status === 'Expired')) {
                setSubscription(data);
            }
        };
        fetch();
    }, []);

    if (!subscription || dismissed) return null;

    const isExpired = subscription.status === 'Expired';
    const daysLeft = subscription.expires_at
        ? Math.max(0, Math.ceil((new Date(subscription.expires_at) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0;

    return (
        <div className={`rounded-xl p-4 mb-6 flex items-center justify-between ${
            isExpired
                ? 'bg-red-500/10 border border-red-500/30'
                : 'bg-amber-500/10 border border-amber-500/30'
        }`}>
            <div className="flex items-center gap-3">
                <span className="text-2xl">{isExpired ? '❌' : '⚠️'}</span>
                <div>
                    <p className={`text-sm font-bold ${isExpired ? 'text-red-400' : 'text-amber-400'}`}>
                        {isExpired
                            ? 'انتهى اشتراكك'
                            : `اشتراكك ينتهي خلال ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'}`}
                    </p>
                    <p className={`text-xs ${isExpired ? 'text-red-400/70' : 'text-amber-400/70'}`}>
                        {isExpired
                            ? `اشتراك ${subscription.tier} انتهى. قم بالترقية لاستعادة ميزاتك.`
                            : `اشتراك ${subscription.tier} ينتهي في ${new Date(subscription.expires_at).toLocaleDateString('ar-LY')}`}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <a href="/merchant/billing"
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                        isExpired
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                >
                    {isExpired ? 'جدّد الآن' : 'ترقية'}
                </a>
                <button
                    onClick={() => setDismissed(true)}
                    className="text-slate-500 hover:text-slate-300 text-xs"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
