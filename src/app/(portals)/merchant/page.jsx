'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useTagdeer } from '@/context/TagdeerContext';
import MerchantOnboarding from '@/components/merchant/MerchantOnboarding';
import { calculateBusinessScore } from '@/lib/mathEngine';
import Link from 'next/link';

export default function MerchantDashboard() {
    const { lang } = useTagdeer();
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [profile, setProfile] = useState(null);
    const [business, setBusiness] = useState(null);
    const [stats, setStats] = useState({ votes: 0, couponsRedeemed: 0, activeCampaigns: 0, logs: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) { setLoading(false); return; }

                const { data: prof } = await supabase
                    .from('profiles')
                    .select('id, full_name, phone, role, metadata')
                    .eq('id', session.user.id)
                    .single();

                setProfile(prof);

                if (prof?.role === 'merchant') {
                    const { data: biz } = await supabase
                        .from('businesses')
                        .select('id, name, category, city, address, phone, email, external_url')
                        .eq('claimed_by', session.user.id)
                        .limit(1)
                        .single();

                    setBusiness(biz);

                    if (!prof?.metadata?.onboarding_complete) {
                        setShowOnboarding(true);
                    }

                    if (biz?.id) {
                        const [logsRes, couponsRes, campaignsRes] = await Promise.all([
                            supabase.from('logs').select('id, interaction_type, created_at, is_verified').eq('business_id', biz.id).order('created_at', { ascending: false }).limit(100),
                            supabase.from('user_coupons').select('id').eq('business_id', biz.id).eq('status', 'REDEEMED'),
                            supabase.from('campaigns').select('id').eq('business_id', biz.id).eq('is_active', true),
                        ]);

                        setStats({
                            votes: (logsRes.data || []).length,
                            couponsRedeemed: (couponsRes.data || []).length,
                            activeCampaigns: (campaignsRes.data || []).length,
                            logs: logsRes.data || [],
                        });
                    }
                }
            } catch (e) {
                console.error('Dashboard load error:', e);
            }
            setLoading(false);
        };

        load();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    if (showOnboarding) {
        return (
            <MerchantOnboarding
                business={business}
                profile={profile}
                onComplete={() => setShowOnboarding(false)}
            />
        );
    }

    const { gaderIndex, rawRecommends, rawComplains } = calculateBusinessScore(stats.logs);
    const totalVotes = rawRecommends + rawComplains;
    const safeIndex = totalVotes === 0 ? 50 : (isNaN(gaderIndex) ? 50 : gaderIndex);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">
                        {lang === 'ar' ? `مرحباً، ${business?.name || 'التاجر'}` : `Welcome back, ${business?.name || 'Merchant'}`}
                    </h1>
                    <p className="text-neutral-500 mt-1">
                        {lang === 'ar' ? 'إليك ما يحدث مع نشاطك التجاري اليوم.' : "Here's what's happening with your business today."}
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link href="/merchant/settings" className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors font-medium shadow-sm">
                        {lang === 'ar' ? 'الإعدادات' : 'Settings'}
                    </Link>
                    <Link href="/merchant/campaigns" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm shadow-blue-600/20">
                        {lang === 'ar' ? 'إنشاء حملة' : 'Create Campaign'}
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {[
                    {
                        label: lang === 'ar' ? 'مؤشر القَدْر' : 'Gader Index',
                        value: totalVotes === 0 ? '—' : `${safeIndex}%`,
                        icon: '⚡',
                        bg: 'bg-blue-50 text-blue-600',
                        sub: totalVotes === 0
                            ? (lang === 'ar' ? 'لا توجد تقييمات بعد' : 'No votes yet')
                            : `${totalVotes} ${lang === 'ar' ? 'تقدير' : 'votes'}`,
                    },
                    {
                        label: lang === 'ar' ? 'توصيات / شكاوى' : 'Recommends / Complains',
                        value: `${rawRecommends} / ${rawComplains}`,
                        icon: '👍',
                        bg: 'bg-emerald-50 text-emerald-600',
                        sub: rawRecommends > rawComplains
                            ? (lang === 'ar' ? 'سمعة ممتازة' : 'Great reputation')
                            : (lang === 'ar' ? 'يحتاج تحسين' : 'Needs improvement'),
                    },
                    {
                        label: lang === 'ar' ? 'كوبونات مستخدمة' : 'Coupons Redeemed',
                        value: stats.couponsRedeemed,
                        icon: '🎁',
                        bg: 'bg-amber-50 text-amber-600',
                        sub: lang === 'ar' ? 'إجمالي الاستخدام' : 'Total redeemed',
                    },
                    {
                        label: lang === 'ar' ? 'حملات نشطة' : 'Active Campaigns',
                        value: stats.activeCampaigns,
                        icon: '📢',
                        bg: 'bg-purple-50 text-purple-600',
                        sub: lang === 'ar' ? 'جارية الآن' : 'Running now',
                    },
                ].map((stat, i) => (
                    <div key={i} className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2.5 rounded-xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                                <span className="text-xl">{stat.icon}</span>
                            </div>
                            <h3 className="font-medium text-neutral-600 text-sm">{stat.label}</h3>
                        </div>
                        <div className="text-2xl font-bold text-neutral-900">{stat.value}</div>
                        <div className="mt-1 text-xs font-medium text-neutral-400">{stat.sub}</div>
                    </div>
                ))}
            </div>

            {/* Tips + Checklist */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-lg overflow-hidden relative">
                    <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                    <div className="relative z-10">
                        <span className="bg-white/20 text-blue-50 text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full mb-4 inline-block">
                            {lang === 'ar' ? 'نصيحة' : 'Pro Tip'}
                        </span>
                        <h2 className="text-2xl font-bold mb-2">
                            {lang === 'ar' ? 'زد تقييماتك بنشر رمز QR' : 'Boost reviews by sharing your QR code'}
                        </h2>
                        <p className="text-blue-100 mb-6 max-w-md">
                            {lang === 'ar'
                                ? 'اطبع رمز QR الخاص بك وضعه في المتجر. كل مسحة تساعد في بناء مؤشر القَدْر الخاص بك.'
                                : 'Print your QR code and place it in-store. Every scan helps build your Gader Index.'}
                        </p>
                        <Link href="/merchant/settings" className="bg-white text-blue-600 px-5 py-2.5 rounded-lg font-medium hover:bg-neutral-50 transition-colors shadow-sm inline-block">
                            {lang === 'ar' ? 'إعدادات المتجر' : 'Store Settings'}
                        </Link>
                    </div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-neutral-900 mb-1">
                            {lang === 'ar' ? 'قائمة الاستعداد' : 'Store Checklist'}
                        </h3>
                        <p className="text-sm text-neutral-500 mb-4">
                            {lang === 'ar' ? 'أكمل هذه الخطوات لتحقيق أقصى وصول.' : 'Complete these to maximize reach.'}
                        </p>
                        <ul className="space-y-3">
                            {[
                                { label: lang === 'ar' ? 'تسجيل العمل' : 'Claim store', done: true },
                                { label: lang === 'ar' ? 'إكمال معلومات التواصل' : 'Complete contact info', done: !!(business?.phone && business?.address) },
                                { label: lang === 'ar' ? 'إنشاء أول حملة' : 'Create first campaign', done: stats.activeCampaigns > 0 },
                                { label: lang === 'ar' ? 'مشاركة صفحتك' : 'Share your page', done: false },
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm">
                                    {item.done ? (
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">✓</span>
                                    ) : (
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center text-xs text-slate-400">{i + 1}</span>
                                    )}
                                    <span className={item.done ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}>{item.label}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="mt-6 pt-4 border-t border-neutral-100">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-neutral-500">{lang === 'ar' ? 'اكتمال الملف' : 'Profile Completion'}</span>
                            <span className="font-medium text-emerald-600">
                                {(() => {
                                    const done = [true, !!(business?.phone && business?.address), stats.activeCampaigns > 0, false].filter(Boolean).length;
                                    return `${Math.round((done / 4) * 100)}%`;
                                })()}
                            </span>
                        </div>
                        <div className="w-full bg-neutral-100 rounded-full h-2 mt-2">
                            <div
                                className="bg-emerald-500 h-2 rounded-full transition-all"
                                style={{ width: `${([true, !!(business?.phone && business?.address), stats.activeCampaigns > 0, false].filter(Boolean).length / 4) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Votes */}
            {stats.logs.length > 0 && (
                <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm">
                    <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                        <h3 className="font-bold text-neutral-900">{lang === 'ar' ? 'أحدث التقييمات' : 'Recent Votes'}</h3>
                        <Link href="/merchant/analytics" className="text-xs text-blue-600 font-medium hover:text-blue-700">
                            {lang === 'ar' ? 'عرض الكل →' : 'View all →'}
                        </Link>
                    </div>
                    <div className="divide-y divide-neutral-100">
                        {stats.logs.slice(0, 5).map(log => (
                            <div key={log.id} className="px-6 py-3 flex items-center gap-3">
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                                    log.interaction_type === 'recommend' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                                }`}>
                                    {log.interaction_type === 'recommend' ? '👍' : '👎'}
                                </span>
                                <div className="flex-1">
                                    <span className="text-sm text-neutral-700">
                                        {log.interaction_type === 'recommend'
                                            ? (lang === 'ar' ? 'توصية' : 'Recommendation')
                                            : (lang === 'ar' ? 'شكوى' : 'Complaint')}
                                    </span>
                                    {log.is_verified && (
                                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium mr-2">✓</span>
                                    )}
                                </div>
                                <span className="text-xs text-neutral-400">
                                    {new Date(log.created_at).toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
