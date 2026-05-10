'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useTagdeer } from '@/context/TagdeerContext';
import { BadgeCheck, ShieldCheck, MapPin, Zap, Gift, Loader2, UserX, CheckCircle2, X, Lock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function VerifyUserPage() {
    const params = useParams();
    const rawId = params.id;
    const { lang, t, user: viewerUser } = useTagdeer();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Merchant direct coupon state
    const [showCouponPicker, setShowCouponPicker] = useState(false);
    const [merchantCoupons, setMerchantCoupons] = useState([]);
    const [loadingCoupons, setLoadingCoupons] = useState(false);
    const [grantingId, setGrantingId] = useState(null);
    const [grantSuccess, setGrantSuccess] = useState(null);

    // Determine if current viewer is a merchant with businesses
    const isMerchant = viewerUser?.role === 'merchant';

    useEffect(() => {
        const fetchProfile = async () => {
            if (!rawId || !supabase) {
                setError(true);
                setLoading(false);
                return;
            }

            try {
                // If the raw ID contains "t=", extract the token payload
                let targetId = rawId;
                if (rawId.startsWith('t=')) {
                    try {
                        const token = rawId.substring(2);
                        const payload = JSON.parse(atob(token));
                        if (Date.now() > payload.exp) {
                            setError(true);
                            setLoading(false);
                            return;
                        }
                        targetId = payload.id;
                    } catch (e) {
                        setError(true);
                        setLoading(false);
                        return;
                    }
                }

                // Try matching by user_id (VIP-XXXXX) first, then by UUID
                let { data, error: err } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', targetId)
                    .single();

                if (err && err.code === 'PGRST116') {
                    const result = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', targetId)
                        .single();
                    data = result.data;
                    err = result.error;
                }

                if (err || !data) {
                    setError(true);
                } else {
                    setProfile(data);
                }
            } catch (e) {
                console.error('Error fetching user:', e);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [rawId]);

    // Fetch merchant's active coupons when coupon picker opens
    useEffect(() => {
        if (!showCouponPicker || !isMerchant || !viewerUser?.id) return;

        const fetchCoupons = async () => {
            setLoadingCoupons(true);
            try {
                // Get businesses claimed by this merchant
                const { data: businesses } = await supabase
                    .from('businesses')
                    .select('id, name')
                    .eq('claimed_by', viewerUser.id);

                if (!businesses || businesses.length === 0) {
                    setMerchantCoupons([]);
                    setLoadingCoupons(false);
                    return;
                }

                const bizIds = businesses.map(b => b.id);

                // Get active campaigns for those businesses
                const { data: campaigns } = await supabase
                    .from('merchant_coupons')
                    .select('*, businesses!inner(name)')
                    .in('business_id', bizIds)
                    .eq('status', 'active')
                    .gt('remaining_quantity', 0);

                setMerchantCoupons(campaigns || []);
            } catch (err) {
                console.error('Error fetching merchant coupons:', err);
            } finally {
                setLoadingCoupons(false);
            }
        };

        fetchCoupons();
    }, [showCouponPicker, isMerchant, viewerUser?.id]);

    const handleGrantCoupon = async (campaign) => {
        if (!profile?.id || !viewerUser?.id) return;
        setGrantingId(campaign.id);

        try {
            const { data, error } = await supabase.rpc('grant_direct_coupon', {
                p_campaign_id: campaign.id,
                p_target_user_id: profile.id,
                p_merchant_id: viewerUser.id
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error);

            setGrantSuccess(data);
            toast.success(lang === 'ar'
                ? `🎟️ تم إرسال الكوبون إلى ${data.user_name}`
                : `🎟️ Coupon sent to ${data.user_name}'s wallet!`);
        } catch (err) {
            toast.error(err.message || 'Failed to grant coupon');
        } finally {
            setGrantingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[70vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-slate-500 font-medium">{lang === 'ar' ? 'جارِ التحميل...' : 'Loading...'}</p>
                </div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="flex justify-center items-center min-h-[70vh] px-4">
                <div className="text-center max-w-md">
                    <div className="bg-red-50 w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center">
                        <UserX className="w-10 h-10 text-red-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">
                        {lang === 'ar' ? 'المستخدم غير موجود' : 'User Not Found'}
                    </h1>
                    <p className="text-slate-500 mb-6">
                        {lang === 'ar'
                            ? 'يبدو أن هذا الرابط غير صالح أو أن المستخدم لم يعد موجوداً.'
                            : 'This link appears to be invalid or the user no longer exists.'}
                    </p>
                    <Link href="/discover" className="inline-flex items-center gap-2 bg-blue-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-800 transition-colors">
                        {lang === 'ar' ? 'العودة للاستكشاف' : 'Back to Discover'}
                    </Link>
                </div>
            </div>
        );
    }

    // Calculate tier info
    const points = profile.gader_points || 0;
    const tierInfo = points >= 20000
        ? { emoji: '💎', name: 'VIP', color: 'from-indigo-600 to-blue-700', badgeBg: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-200' }
        : points >= 5000
            ? { emoji: '🥇', name: 'Gold', color: 'from-yellow-500 to-amber-600', badgeBg: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200' }
            : points >= 1000
                ? { emoji: '🥈', name: 'Silver', color: 'from-slate-400 to-gray-500', badgeBg: 'bg-slate-100 text-slate-700', border: 'border-slate-200' }
                : { emoji: '🥉', name: 'Bronze', color: 'from-amber-600 to-orange-700', badgeBg: 'bg-amber-100 text-amber-700', border: 'border-amber-200' };

    const isLocalGuide = points >= 1000;
    const isPhoneVerified = profile.phone_verified === true;

    return (
        <div className="max-w-lg mx-auto px-4 py-12" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold tracking-wider mb-4">
                    <ShieldCheck className="h-4 w-4" />
                    {lang === 'ar' ? 'ملف ثقة موثّق' : 'Verified Trust Profile'}
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900">
                    {lang === 'ar' ? 'ملف المستخدم العام' : 'Public User Profile'}
                </h1>
            </div>

            {/* Profile Card */}
            <div className={`bg-white rounded-3xl shadow-lg border ${tierInfo.border} overflow-hidden`}>
                {/* Gradient banner */}
                <div className={`bg-gradient-to-r ${tierInfo.color} h-24 relative`}>
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                        <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center text-4xl border-4 border-white">
                            {tierInfo.emoji}
                        </div>
                    </div>
                </div>

                {/* Profile info */}
                <div className="pt-14 pb-6 px-6 text-center">
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-1">
                        {profile.full_name || (lang === 'ar' ? 'عضو تقدير' : 'Tagdeer Member')}
                    </h2>

                    {profile.city && (
                        <div className="flex items-center justify-center gap-1.5 text-slate-500 mb-4">
                            <MapPin className="w-4 h-4" />
                            <span className="text-sm font-medium">{t(profile.city) || profile.city}</span>
                        </div>
                    )}

                    {/* Verified Local Guide Badge */}
                    {isLocalGuide && (
                        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-full mb-6 shadow-sm">
                            <BadgeCheck className="w-5 h-5" />
                            <span className="font-bold text-sm">
                                {lang === 'ar' ? 'دليل محلي موثّق ✨' : 'Verified Local Guide ✨'}
                            </span>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                                {lang === 'ar' ? 'المستوى' : 'Trust Level'}
                            </span>
                            <div className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-sm font-bold ${tierInfo.badgeBg}`}>
                                <span>{tierInfo.emoji}</span>
                                <span>{tierInfo.name}</span>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                                {lang === 'ar' ? 'نقاط القَدْر' : 'Gader Points'}
                            </span>
                            <div className="flex items-center justify-center gap-1.5">
                                <Zap className="w-5 h-5 text-amber-500" />
                                <span className="text-2xl font-black text-slate-800">{points.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Phone verification status */}
                    <div className={`flex items-center justify-center gap-2 text-sm font-semibold mb-4 py-2 px-4 rounded-full ${
                        isPhoneVerified
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-orange-50 text-orange-600 border border-orange-100'
                    }`}>
                        {isPhoneVerified ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        {isPhoneVerified
                            ? (lang === 'ar' ? 'هاتف موثّق' : 'Phone Verified')
                            : (lang === 'ar' ? 'غير موثّق' : 'Not Phone Verified')}
                    </div>

                    {/* Member ID */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-6">
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                            {lang === 'ar' ? 'رقم العضوية' : 'Member ID'}
                        </span>
                        <span className="font-mono text-sm font-bold text-slate-600">{profile.user_id || profile.id}</span>
                    </div>

                    {/* ═══ Grant Reward Section ═══ */}
                    {grantSuccess ? (
                        // Success state
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-emerald-800 mb-1">
                                {lang === 'ar' ? 'تم إرسال الكوبون!' : 'Coupon Sent!'}
                            </h3>
                            <p className="text-sm text-emerald-600 font-medium">
                                {grantSuccess.campaign_name} — {grantSuccess.business_name}
                            </p>
                            <p className="text-xs text-emerald-500 mt-1 font-mono">
                                {grantSuccess.serial}
                            </p>
                        </div>
                    ) : showCouponPicker ? (
                        // Coupon picker
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="p-3 bg-slate-100 border-b flex justify-between items-center">
                                <span className="text-sm font-semibold text-slate-700">
                                    {lang === 'ar' ? 'اختر كوبون لإرساله' : 'Select Coupon to Send'}
                                </span>
                                <button onClick={() => setShowCouponPicker(false)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {!isPhoneVerified && (
                                <div className="p-4 bg-orange-50 border-b border-orange-100 text-sm text-orange-700">
                                    <Lock className="w-4 h-4 inline mr-1" />
                                    {lang === 'ar'
                                        ? 'هذا المستخدم لم يوثّق هاتفه بعد. لا يمكن إرسال كوبون.'
                                        : 'This user has not verified their phone. Cannot send coupon.'}
                                </div>
                            )}

                            {loadingCoupons ? (
                                <div className="p-6 text-center text-slate-500">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                    {lang === 'ar' ? 'جارِ تحميل الكوبونات...' : 'Loading coupons...'}
                                </div>
                            ) : merchantCoupons.length === 0 ? (
                                <div className="p-6 text-center text-slate-500 italic">
                                    {lang === 'ar' ? 'لا توجد كوبونات نشطة' : 'No active coupons available'}
                                </div>
                            ) : (
                                merchantCoupons.map(coupon => {
                                    const couponName = coupon.offer_type === 'free_item'
                                        ? coupon.item_name
                                        : `${coupon.discount_value}${coupon.offer_type === 'percentage' ? '%' : ' LYD'} Off`;

                                    return (
                                        <button
                                            key={coupon.id}
                                            disabled={!isPhoneVerified || grantingId === coupon.id}
                                            onClick={() => handleGrantCoupon(coupon)}
                                            className="w-full flex items-center justify-between p-4 border-b last:border-0 hover:bg-indigo-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <Gift className="w-4 h-4" />
                                                </div>
                                                <div className="text-left">
                                                    <span className="font-semibold text-slate-800 block">{couponName}</span>
                                                    <span className="text-xs text-slate-400">{coupon.businesses?.name}</span>
                                                </div>
                                            </div>
                                            {grantingId === coupon.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                            ) : (
                                                <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
                                                    {coupon.remaining_quantity} {lang === 'ar' ? 'متبقي' : 'left'}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        // Default: Grant Reward button
                        <>
                            {isMerchant ? (
                                <button
                                    onClick={() => setShowCouponPicker(true)}
                                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-bold text-base hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                >
                                    <Gift className="w-5 h-5" />
                                    {lang === 'ar' ? 'منح مكافأة مباشرة' : 'Grant Direct Reward'}
                                </button>
                            ) : (
                                <button
                                    disabled
                                    className="w-full bg-slate-200 text-slate-400 py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 cursor-not-allowed"
                                >
                                    <Gift className="w-5 h-5" />
                                    {lang === 'ar' ? 'للأعمال التجارية فقط' : 'Business Owners Only'}
                                </button>
                            )}
                            <p className="text-xs text-slate-400 mt-2">
                                {isMerchant
                                    ? (lang === 'ar' ? 'أرسل كوبون مباشر من حملاتك النشطة' : 'Push a direct coupon from your active campaigns')
                                    : (lang === 'ar' ? 'سجل دخولك كصاحب عمل لمنح مكافآت' : 'Log in as a business owner to grant rewards')}
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* Powered by Tagdeer */}
            <div className="text-center mt-8">
                <Link href="/" className="text-sm text-slate-400 hover:text-blue-600 font-medium transition-colors">
                    {lang === 'ar' ? 'مدعوم من تقدير 🦌' : 'Powered by Tagdeer 🦌'}
                </Link>
            </div>
        </div>
    );
}
