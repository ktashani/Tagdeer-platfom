'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useTagdeer } from '@/context/TagdeerContext';
import { BadgeCheck, ShieldCheck, MapPin, Zap, Gift, Loader2, UserX, Check } from 'lucide-react';
import Link from 'next/link';

export default function VerifyUserPage() {
    const params = useParams();
    const userId = params.id;
    const { lang, t } = useTagdeer();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Grant Recognition state
    const [merchantBusiness, setMerchantBusiness] = useState(null);
    const [showGrantForm, setShowGrantForm] = useState(false);
    const [grantDiscount, setGrantDiscount] = useState(10);
    const [grantType, setGrantType] = useState('percentage');
    const [granting, setGranting] = useState(false);
    const [granted, setGranted] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!userId || !supabase) {
                setError(true);
                setLoading(false);
                return;
            }

            try {
                let { data, error: err } = await supabase
                    .from('profiles')
                    .select('id, full_name, city, gader, user_id, phone, avatar_url')
                    .eq('user_id', userId)
                    .single();

                if (err && err.code === 'PGRST116') {
                    const result = await supabase
                        .from('profiles')
                        .select('id, full_name, city, gader, user_id, phone, avatar_url')
                        .eq('id', userId)
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

        const checkMerchant = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: biz } = await supabase
                .from('businesses')
                .select('id, name')
                .eq('claimed_by', session.user.id)
                .limit(1)
                .maybeSingle();

            if (biz) setMerchantBusiness(biz);
        };

        fetchProfile();
        checkMerchant();
    }, [userId]);

    const handleGrant = async () => {
        if (!profile || !merchantBusiness) return;
        setGranting(true);

        try {
            const code = `TAGDEER-${merchantBusiness.name.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

            const { error: insertErr } = await supabase
                .from('user_coupons')
                .insert({
                    user_id: profile.id,
                    business_id: merchantBusiness.id,
                    coupon_code: code,
                    discount_value: grantDiscount,
                    discount_type: grantType,
                    status: 'ACTIVE',
                    source: 'grant_recognition',
                });

            if (insertErr) throw insertErr;
            setGranted(true);
            setShowGrantForm(false);
        } catch (err) {
            alert('فشل في منح المكافأة: ' + err.message);
        }
        setGranting(false);
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

    const points = profile.gader || 0;
    const tierInfo = points >= 20000
        ? { emoji: '💎', name: 'VIP', color: 'from-indigo-600 to-blue-700', badgeBg: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-200' }
        : points >= 5000
            ? { emoji: '🥇', name: 'Gold', color: 'from-yellow-500 to-amber-600', badgeBg: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200' }
            : points >= 1000
                ? { emoji: '🥈', name: 'Silver', color: 'from-slate-400 to-gray-500', badgeBg: 'bg-slate-100 text-slate-700', border: 'border-slate-200' }
                : { emoji: '🥉', name: 'Bronze', color: 'from-amber-600 to-orange-700', badgeBg: 'bg-amber-100 text-amber-700', border: 'border-amber-200' };

    const isLocalGuide = points >= 1000;

    return (
        <div className="max-w-lg mx-auto px-4 py-12" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold tracking-wider mb-4">
                    <ShieldCheck className="h-4 w-4" />
                    {lang === 'ar' ? 'بطاقة قَدِّر الرقمية' : 'Digital Gader Card'}
                </div>
                <h1 className="text-3xl font-extrabold text-slate-900">
                    {lang === 'ar' ? 'ملف الثقة' : 'Trust Profile'}
                </h1>
            </div>

            {/* Profile Card */}
            <div className={`bg-white rounded-3xl shadow-lg border ${tierInfo.border} overflow-hidden`}>
                <div className={`bg-gradient-to-r ${tierInfo.color} h-24 relative`}>
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                        <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center text-4xl border-4 border-white">
                            {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                            ) : (
                                tierInfo.emoji
                            )}
                        </div>
                    </div>
                </div>

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

                    {/* Member ID */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-6">
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                            {lang === 'ar' ? 'رقم العضوية' : 'Member ID'}
                        </span>
                        <span className="font-mono text-sm font-bold text-slate-600">{profile.user_id || profile.id}</span>
                    </div>

                    {/* Grant Recognition Button */}
                    {granted ? (
                        <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2">
                            <Check className="w-5 h-5" />
                            {lang === 'ar' ? 'تم منح المكافأة بنجاح! ✅' : 'Reward Granted! ✅'}
                        </div>
                    ) : merchantBusiness ? (
                        <>
                            {!showGrantForm ? (
                                <button
                                    onClick={() => setShowGrantForm(true)}
                                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-bold text-base hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                >
                                    <Gift className="w-5 h-5" />
                                    {lang === 'ar' ? 'منح تقدير (كوبون)' : 'Grant Recognition'}
                                </button>
                            ) : (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3 text-left animate-in slide-in-from-bottom-2 duration-200">
                                    <p className="text-sm font-bold text-emerald-800">
                                        {lang === 'ar' ? `منح كوبون من ${merchantBusiness.name}` : `Grant coupon from ${merchantBusiness.name}`}
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={grantDiscount}
                                            onChange={(e) => setGrantDiscount(Number(e.target.value))}
                                            className="flex-1 px-3 py-2 border border-emerald-200 rounded-lg text-sm outline-none"
                                            min={1} max={100}
                                        />
                                        <select
                                            value={grantType}
                                            onChange={(e) => setGrantType(e.target.value)}
                                            className="px-3 py-2 border border-emerald-200 rounded-lg text-sm outline-none"
                                        >
                                            <option value="percentage">%</option>
                                            <option value="fixed">LYD</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleGrant}
                                            disabled={granting}
                                            className="flex-1 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                        >
                                            {granting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                                            {lang === 'ar' ? 'تأكيد' : 'Confirm'}
                                        </button>
                                        <button
                                            onClick={() => setShowGrantForm(false)}
                                            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
                                        >
                                            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="w-full bg-slate-100 text-slate-500 py-3.5 rounded-xl font-medium text-sm text-center">
                            {lang === 'ar' ? 'سجّل دخول كتاجر لمنح مكافأة' : 'Sign in as merchant to grant rewards'}
                        </div>
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
