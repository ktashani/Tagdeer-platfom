'use client';

import React, { useState, useMemo } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { Hero } from '@/components/Hero/Hero';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, Check, Crown, ShieldAlert, ThumbsUp, ThumbsDown, TrendingUp, TrendingDown, Store, MapPin } from 'lucide-react';

export default function HomePage() {
    const { t, lang, isRTL, businesses, setShowPreRegModal } = useTagdeer();
    const [searchQuery, setSearchQuery] = useState('');
    const [openFaqIndex, setOpenFaqIndex] = useState(null);

    const router = useRouter();

    const navigateTo = (page) => {
        if (page === 'home') router.push('/');
        else router.push(`/${page}`);
    };

    const toggleFaq = (index) => {
        setOpenFaqIndex(openFaqIndex === index ? null : index);
    };

    const topBusiness = [...businesses]
        .filter(b => !b.isShielded)
        .sort((a, b) => (b.recommends + b.complains) - (a.recommends + a.complains))[0];

    // B: 72-hour leader banners
    const WINDOW = 72 * 3600000;
    const now = Date.now();

    const { topRecommended, topComplained } = useMemo(() => {
        const withRecentActivity = businesses.map(b => {
            const recentLogs = (b.logs || []).filter(l =>
                l.created_at && (now - new Date(l.created_at).getTime()) < WINDOW
            );
            const recentRecommends = recentLogs.filter(l => l.type === 'recommend').length;
            const recentComplains = recentLogs.filter(l => l.type === 'complain').length;
            const latestLog = recentLogs[0] || null;
            return { ...b, recentRecommends, recentComplains, latestLog };
        });

        return {
            topRecommended: withRecentActivity
                .filter(b => b.recentRecommends > 0)
                .sort((a, b) => b.recentRecommends - a.recentRecommends)
                .slice(0, 5),
            topComplained: withRecentActivity
                .filter(b => b.recentComplains > 0)
                .sort((a, b) => b.recentComplains - a.recentComplains)
                .slice(0, 5)
        };
    }, [businesses]);

    const faqItems = [
        { q: t('faq_q1'), a: t('faq_a1') },
        { q: t('faq_q2'), a: t('faq_a2') },
        { q: t('faq_q3'), a: t('faq_a3') },
        { q: t('faq_q4'), a: t('faq_a4') },
        { q: t('faq_q5'), a: t('faq_a5') }
    ];

    return (
        <>
            <Hero
                t={t}
                lang={lang}
                isRTL={isRTL}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                navigateTo={navigateTo}
                topBusiness={topBusiness}
                setShowPreRegModal={setShowPreRegModal}
                faqItems={faqItems}
                openFaqIndex={openFaqIndex}
                toggleFaq={toggleFaq}
            />

            {/* B: Leader Banners — 72hr window, min 3 businesses */}
            {topRecommended.length >= 3 && (
                <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10" dir={isRTL ? 'rtl' : 'ltr'}>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 rounded-lg bg-green-100">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {lang === 'ar' ? '🔥 الأكثر تقديراً هذا الأسبوع' : '🔥 Most Recommended This Week'}
                        </h2>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 snap-x snap-mandatory">
                        {topRecommended.map(b => (
                            <LeaderCard key={b.id} business={b} type="recommend" lang={lang} isRTL={isRTL} />
                        ))}
                    </div>
                </section>
            )}

            {topComplained.length >= 3 && (
                <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6" dir={isRTL ? 'rtl' : 'ltr'}>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 rounded-lg bg-red-100">
                            <TrendingDown className="w-5 h-5 text-red-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {lang === 'ar' ? '⚠️ الأكثر شكاوى هذا الأسبوع' : '⚠️ Most Complained This Week'}
                        </h2>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 snap-x snap-mandatory">
                        {topComplained.map(b => (
                            <LeaderCard key={b.id} business={b} type="complain" lang={lang} isRTL={isRTL} />
                        ))}
                    </div>
                </section>
            )}

            {/* Trust Engine Marketing Banner */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 via-blue-700 to-blue-900 p-8 md:p-12 shadow-xl">
                    {/* Decorative circles */}
                    <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/5 rounded-full pointer-events-none" />
                    <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white/5 rounded-full pointer-events-none" />

                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="bg-white/10 backdrop-blur-sm p-5 rounded-2xl border border-white/20 shrink-0">
                            <ShieldCheck className="w-12 h-12 text-emerald-300" />
                        </div>

                        <div className="flex-1 text-center md:text-start">
                            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3 leading-tight">
                                {lang === 'ar'
                                    ? 'صوتك له وزن، ومجتمعك يثق بك.'
                                    : 'Your Voice Shapes the City.'}
                            </h2>
                            <p className="text-blue-100 text-base md:text-lg leading-relaxed max-w-2xl">
                                {lang === 'ar'
                                    ? 'محرك الثقة الذكي من تقدير يضمن ملاحظات مجتمعية عادلة وحقيقية. وثّق حسابك اليوم لمضاعفة تأثير تصويتك حتى 2.5 ضعف وكن دليلاً محلياً!'
                                    : "Tagdeer's smart Trust Engine ensures fair, real community feedback. Verify your account today to multiply your voting impact up to 2.5x and become a Local Guide!"}
                            </p>
                        </div>

                        <Link
                            href="/about#trust-engine"
                            className="shrink-0 bg-white text-blue-800 px-7 py-3.5 rounded-2xl font-bold text-base hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-lg"
                        >
                            {lang === 'ar' ? 'كيف يعمل نظام تقدير؟' : 'Discover How It Works'}
                            <ArrowRight className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Merchant CTA Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-[32px] p-8 md:p-12 shadow-2xl relative overflow-hidden text-center">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
                    <div className="absolute top-0 left-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>

                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6">
                            {lang === 'ar' ? 'نمّي نشاطك مع تقدير' : 'Grow Your Business with Tagdeer'}
                        </h2>
                        <p className="text-lg md:text-xl text-indigo-100 max-w-2xl mx-auto mb-10">
                            {lang === 'ar'
                                ? 'انضم إلى شبكة التجار الموثوقين. فعّل الدروع الأمنية لمنع التقييمات الوهمية وزد من ولاء عملائك.'
                                : 'Join the network of trusted merchants. Activate security shields to block fake reviews and boost customer loyalty.'}
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                            <Link href="/pricing" className="bg-white hover:bg-slate-100 text-slate-900 px-8 py-4 rounded-full font-bold text-lg shadow-lg transition-transform hover:scale-105 w-full sm:w-auto">
                                {lang === 'ar' ? 'عرض الباقات والأسعار' : 'View Plans & Pricing'}
                            </Link>
                            <Link href="/merchant/login" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-4 rounded-full font-bold text-lg backdrop-blur-sm transition-colors w-full sm:w-auto">
                                {lang === 'ar' ? 'سجل تفاصيل حسابك' : 'Create an Account'}
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

function LeaderCard({ business, type, lang, isRTL }) {
    const totalVotes = (business.recommends || 0) + (business.complains || 0);
    const recommendPct = totalVotes > 0 ? Math.round(((business.recommends || 0) / totalVotes) * 100) : 50;
    const avatarLetter = business.name?.charAt(0).toUpperCase() || '?';

    const hasStorefront = business.storefront?.status === 'published' && business.storefront?.slug;
    const linkHref = hasStorefront ? `/b/${business.storefront.slug}` : `/discover?q=${encodeURIComponent(business.name)}`;

    const isRecommend = type === 'recommend';
    const borderColor = isRecommend ? 'border-green-200 hover:border-green-300' : 'border-red-200 hover:border-red-300';
    const accentBg = isRecommend ? 'bg-green-50' : 'bg-red-50';

    return (
        <Link href={linkHref}
            className={`min-w-[260px] max-w-[300px] snap-start flex-shrink-0 rounded-2xl border ${borderColor} bg-white p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group`}
        >
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                {business.storefront?.logo_url ? (
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                        <img src={business.storefront.logo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-xl shrink-0 bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                        {avatarLetter}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-slate-800 truncate group-hover:text-blue-600 transition-colors">{business.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="w-3 h-3" /> {business.region}
                    </div>
                </div>
            </div>

            {/* Score bar */}
            <div className="w-full rounded-full h-2.5 overflow-hidden flex shadow-inner border border-slate-200 mb-2">
                <div className="bg-gradient-to-r from-green-400 to-green-500 h-full transition-all duration-700"
                    style={{ width: `${Math.max(recommendPct, 5)}%` }} />
                <div className="bg-gradient-to-r from-red-400 to-red-500 h-full transition-all duration-700"
                    style={{ width: `${Math.max(100 - recommendPct, 5)}%` }} />
            </div>

            <div className="flex justify-between text-[10px] font-bold mb-3">
                <span className="text-green-600">👍 {business.recommends || 0}</span>
                <span className="text-red-500">{business.complains || 0} 👎</span>
            </div>

            {/* Latest review */}
            {business.latestLog && (
                <div className={`${accentBg} rounded-lg p-2.5 text-xs text-slate-600 line-clamp-2 leading-relaxed`}>
                    "{business.latestLog.text}"
                </div>
            )}

            {/* CTA */}
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                {hasStorefront && <Store className="w-3.5 h-3.5" />}
                {hasStorefront
                    ? (lang === 'ar' ? 'زيارة صفحة النشاط' : 'Visit Storefront')
                    : (lang === 'ar' ? 'عرض في الاكتشاف' : 'View in Discover')}
                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
            </div>
        </Link>
    );
}
