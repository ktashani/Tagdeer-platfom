'use client';
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useTagdeer } from '@/context/TagdeerContext';
import { BadgeCheck, ShieldCheck, MapPin, Zap, Gift, Loader2, UserX } from 'lucide-react';
import Link from 'next/link';

export default function VerifyUserPage() {
    const params = useParams();
    const userId = params.id;
    const { lang, t } = useTagdeer();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!userId || !supabase) {
                setError(true);
                setLoading(false);
                return;
            }

            try {
                // Try matching by user_id (VIP-XXXXX) first, then by UUID
                let { data, error: err } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', userId)
                    .single();

                if (err && err.code === 'PGRST116') {
                    // Try by UUID
                    const result = await supabase
                        .from('profiles')
                        .select('*')
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

        fetchProfile();
    }, [userId]);

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

                    {/* Member ID */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-6">
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                            {lang === 'ar' ? 'رقم العضوية' : 'Member ID'}
                        </span>
                        <span className="font-mono text-sm font-bold text-slate-600">{profile.user_id || profile.id}</span>
                    </div>

                    {/* Grant Reward Button */}
                    <button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl font-bold text-base hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                        <Gift className="w-5 h-5" />
                        {lang === 'ar' ? 'منح مكافأة' : 'Grant Reward'}
                    </button>
                    <p className="text-xs text-slate-400 mt-2">
                        {lang === 'ar' ? 'قريباً: نظام المكافآت الكامل' : 'Coming soon: full rewards system'}
                    </p>
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
