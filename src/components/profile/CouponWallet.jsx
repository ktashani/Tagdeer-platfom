'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Gift, Tag, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

/**
 * CouponWallet — displays user's coupons from grant recognition + campaigns.
 * Located in the consumer profile page.
 */
export default function CouponWallet({ userId, lang }) {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) { setLoading(false); return; }

        const fetchCoupons = async () => {
            const { data, error } = await supabase
                .from('user_coupons')
                .select('id, coupon_code, discount_value, discount_type, status, source, expires_at, created_at, businesses(name)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (!error && data) setCoupons(data);
            setLoading(false);
        };

        fetchCoupons();
    }, [userId]);

    const handleRedeem = async (couponId) => {
        const { error } = await supabase
            .from('user_coupons')
            .update({ status: 'REDEEMED', redeemed_at: new Date().toISOString() })
            .eq('id', couponId);

        if (!error) {
            setCoupons(prev => prev.map(c => c.id === couponId ? { ...c, status: 'REDEEMED' } : c));
        }
    };

    const isExpired = (expiresAt) => expiresAt && new Date(expiresAt) < new Date();

    const statusConfig = {
        ACTIVE: { label: lang === 'ar' ? 'نشط' : 'Active', bg: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
        REDEEMED: { label: lang === 'ar' ? 'مستخدم' : 'Redeemed', bg: 'bg-blue-100 text-blue-700', icon: CheckCircle },
        EXPIRED: { label: lang === 'ar' ? 'منتهي' : 'Expired', bg: 'bg-slate-100 text-slate-500', icon: XCircle },
    };

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            </div>
        );
    }

    if (coupons.length === 0) {
        return (
            <div className="text-center py-10">
                <div className="bg-slate-100 w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <Gift className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 text-sm font-medium">
                    {lang === 'ar' ? 'لا توجد كوبونات بعد' : 'No coupons yet'}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                    {lang === 'ar' ? 'ستظهر هنا عندما يمنحك تاجر مكافأة' : 'Coupons from merchants will appear here'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {coupons.map(coupon => {
                const expired = isExpired(coupon.expires_at);
                const effectiveStatus = expired && coupon.status === 'ACTIVE' ? 'EXPIRED' : coupon.status;
                const config = statusConfig[effectiveStatus] || statusConfig.ACTIVE;
                const StatusIcon = config.icon;

                return (
                    <div
                        key={coupon.id}
                        className={`relative bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                            effectiveStatus === 'ACTIVE' ? 'border-emerald-200 hover:shadow-md' : 'border-slate-200 opacity-75'
                        }`}
                    >
                        {/* Coupon tear line */}
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-l-2xl" />

                        <div className="pl-5 pr-4 py-4 flex items-center gap-4">
                            {/* Discount badge */}
                            <div className="shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex flex-col items-center justify-center text-white shadow-sm">
                                <span className="text-xl font-black leading-none">
                                    {coupon.discount_value}
                                </span>
                                <span className="text-[10px] font-bold opacity-80">
                                    {coupon.discount_type === 'percentage' ? '%' : 'LYD'}
                                </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-slate-800 text-sm truncate">
                                        {coupon.businesses?.name || (lang === 'ar' ? 'تاجر' : 'Merchant')}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.bg}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {config.label}
                                    </span>
                                </div>
                                <div className="font-mono text-xs text-slate-500 tracking-wider mb-1">
                                    {coupon.coupon_code}
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Tag className="w-3 h-3" />
                                        {coupon.source === 'grant_recognition'
                                            ? (lang === 'ar' ? 'تقدير' : 'Recognition')
                                            : (lang === 'ar' ? 'حملة' : 'Campaign')
                                        }
                                    </span>
                                    {coupon.expires_at && (
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(coupon.expires_at).toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Redeem button */}
                            {effectiveStatus === 'ACTIVE' && (
                                <button
                                    onClick={() => handleRedeem(coupon.id)}
                                    className="shrink-0 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                    {lang === 'ar' ? 'استخدام' : 'Redeem'}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
