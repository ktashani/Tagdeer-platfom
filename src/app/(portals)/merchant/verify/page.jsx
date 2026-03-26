'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Merchant Coupon Verification Page
 * Scan a coupon QR code or enter coupon ID to verify and redeem.
 */
export default function MerchantVerifyPage() {
    const [couponId, setCouponId] = useState('');
    const [couponData, setCouponData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [recentVerifications, setRecentVerifications] = useState([]);
    const inputRef = useRef(null);

    // Fetch recent verifications
    useEffect(() => {
        const fetchRecent = async () => {
            const { data: user } = await supabase.auth.getUser();
            if (!user?.user) return;

            const { data } = await supabase
                .from('user_coupons')
                .select('id, coupon_code, discount_value, merchant_verified_at, status, created_at')
                .not('merchant_verified_at', 'is', null)
                .order('merchant_verified_at', { ascending: false })
                .limit(10);

            setRecentVerifications(data || []);
        };
        fetchRecent();
    }, [result]);

    // Look up coupon details
    const handleLookup = async () => {
        if (!couponId.trim()) return;
        setLoading(true);
        setError(null);
        setCouponData(null);
        setResult(null);

        try {
            const { data, error: fetchErr } = await supabase
                .from('user_coupons')
                .select('id, coupon_code, discount_value, discount_type, status, merchant_verified_at, created_at, user_id, business_id')
                .eq('id', couponId.trim())
                .maybeSingle();

            if (fetchErr) throw fetchErr;
            if (!data) {
                setError('لم يتم العثور على الكوبون');
                return;
            }
            setCouponData(data);
        } catch (err) {
            setError(err.message || 'خطأ في البحث');
        }
        setLoading(false);
    };

    // Verify and redeem the coupon
    const handleVerify = async () => {
        if (!couponData) return;
        setVerifying(true);
        setError(null);

        try {
            const { data, error: rpcErr } = await supabase.rpc('merchant_verify_coupon', {
                p_coupon_id: couponData.id,
            });
            if (rpcErr) throw rpcErr;

            setResult(data);
            setCouponData(null);
            setCouponId('');
        } catch (err) {
            setError(err.message || 'فشل في التحقق');
        }
        setVerifying(false);
    };

    const statusLabels = {
        ACTIVE: { label: 'نشط', color: 'bg-emerald-100 text-emerald-800' },
        REDEEMED: { label: 'مستخدم', color: 'bg-slate-100 text-slate-600' },
        EXPIRED: { label: 'منتهي', color: 'bg-red-100 text-red-700' },
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">التحقق من الكوبون</h1>
                <p className="text-slate-400 mt-1">أدخل رقم الكوبون أو امسح رمز QR للتحقق</p>
            </div>

            {/* Lookup Input */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">رقم الكوبون</label>
                <div className="flex gap-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={couponId}
                        onChange={(e) => setCouponId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                        placeholder="الصق رقم الكوبون هنا..."
                        className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-mono"
                        dir="ltr"
                    />
                    <button
                        onClick={handleLookup}
                        disabled={loading || !couponId.trim()}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
                    >
                        {loading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        ) : '🔍'} بحث
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                    ⚠️ {error}
                </div>
            )}

            {/* Success Result */}
            {result && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center animate-in zoom-in-95 duration-300">
                    <div className="text-4xl mb-3">✅</div>
                    <h3 className="text-lg font-bold text-emerald-400">تم التحقق بنجاح!</h3>
                    <p className="text-emerald-400/70 text-sm mt-1">
                        {result.business_name} — {new Date(result.verified_at).toLocaleString('ar-LY')}
                    </p>
                </div>
            )}

            {/* Coupon Preview */}
            {couponData && (
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        🎟️ تفاصيل الكوبون
                    </h3>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-400 block mb-1">الكود</span>
                            <span className="text-white font-mono">{couponData.coupon_code || couponData.id.slice(0, 8)}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block mb-1">الخصم</span>
                            <span className="text-white font-bold">
                                {couponData.discount_type === 'percentage'
                                    ? `${couponData.discount_value}%`
                                    : `${couponData.discount_value} LYD`}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 block mb-1">الحالة</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[couponData.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                                {statusLabels[couponData.status]?.label || couponData.status}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 block mb-1">تاريخ الإصدار</span>
                            <span className="text-white text-xs">{new Date(couponData.created_at).toLocaleDateString('ar-LY')}</span>
                        </div>
                    </div>

                    {couponData.merchant_verified_at ? (
                        <div className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                            ⚠️ تم التحقق مسبقاً في {new Date(couponData.merchant_verified_at).toLocaleString('ar-LY')}
                        </div>
                    ) : couponData.status === 'ACTIVE' ? (
                        <button
                            onClick={handleVerify}
                            disabled={verifying}
                            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/20"
                        >
                            {verifying ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            ) : '✓'} تأكيد التحقق واستخدام الكوبون
                        </button>
                    ) : (
                        <div className="text-slate-400 text-sm text-center p-3 bg-slate-700/30 rounded-lg">
                            هذا الكوبون {couponData.status === 'REDEEMED' ? 'مستخدم بالفعل' : 'منتهي الصلاحية'}
                        </div>
                    )}
                </div>
            )}

            {/* Recent Verifications */}
            {recentVerifications.length > 0 && (
                <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-slate-300 mb-3">آخر التحققات</h3>
                    <div className="space-y-2">
                        {recentVerifications.map(v => (
                            <div key={v.id} className="flex items-center justify-between text-xs text-slate-400 py-2 border-b border-slate-700/50 last:border-0">
                                <span className="font-mono text-slate-300">{v.coupon_code || v.id.slice(0, 8)}</span>
                                <span>{v.discount_value}%</span>
                                <span className="text-emerald-400">
                                    {new Date(v.merchant_verified_at).toLocaleDateString('ar-LY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
