'use client';

import React, { useState } from 'react';
import { useTagdeer } from '../context/TagdeerContext';
import { Hero } from '../components/Hero/Hero';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, Users, Store, MessageSquare, TrendingUp, Gift, Search, Star, Zap } from 'lucide-react';

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

    const faqItems = [
        { q: t('faq_q1'), a: t('faq_a1') },
        { q: t('faq_q2'), a: t('faq_a2') },
        { q: t('faq_q3'), a: t('faq_a3') },
        { q: t('faq_q4'), a: t('faq_a4') },
        { q: t('faq_q5'), a: t('faq_a5') }
    ];

    // Live-ish stats from context
    const totalVotes = businesses.reduce((sum, b) => sum + (b.logs?.length || 0), 0);
    const verifiedBusinesses = businesses.filter(b => b.claimed_by || b.isShielded).length;

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

            {/* ═══ Live Platform Stats ═══ */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { icon: Store, label: lang === 'ar' ? 'نشاط تجاري' : 'Businesses', value: businesses.length, color: 'from-blue-500 to-indigo-600' },
                        { icon: ShieldCheck, label: lang === 'ar' ? 'موثق' : 'Verified', value: verifiedBusinesses, color: 'from-emerald-500 to-teal-600' },
                        { icon: MessageSquare, label: lang === 'ar' ? 'تقدير' : 'Tagdeers', value: totalVotes, color: 'from-amber-500 to-orange-600' },
                        { icon: Users, label: lang === 'ar' ? 'مدينة' : 'Cities', value: 2, color: 'from-purple-500 to-pink-600' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 text-center shadow-sm hover:shadow-md transition-shadow">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mx-auto mb-3`}>
                                <stat.icon className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-2xl font-black text-slate-900">{stat.value.toLocaleString()}</div>
                            <div className="text-xs font-medium text-slate-500 mt-1">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══ How It Works ═══ */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12" dir={isRTL ? 'rtl' : 'ltr'}>
                <h2 className="text-3xl font-extrabold text-center text-slate-900 mb-10">
                    {lang === 'ar' ? 'كيف يعمل تقدير؟' : 'How Tagdeer Works'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: Search, title: lang === 'ar' ? 'اكتشف' : 'Discover', desc: lang === 'ar' ? 'تصفح الأعمال التجارية في مدينتك وشاهد مؤشر القَدْر لكل نشاط' : 'Browse businesses in your city and see their Gader Index', color: 'bg-blue-100 text-blue-600' },
                        { icon: Star, title: lang === 'ar' ? 'قيّم' : 'Review', desc: lang === 'ar' ? 'أعطِ تقديرك — أوصِ بالجيد وحذّر من السيء. صوتك يصنع الفرق' : 'Give your Tagdeer — recommend the good, warn about the bad', color: 'bg-amber-100 text-amber-600' },
                        { icon: Gift, title: lang === 'ar' ? 'اكسب' : 'Earn', desc: lang === 'ar' ? 'اكسب نقاط القَدْر واحصل على كوبونات ومكافآت من التجار الموثقين' : 'Earn Gader points and get coupons from verified merchants', color: 'bg-emerald-100 text-emerald-600' },
                    ].map((step, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-sm hover:shadow-md transition-shadow group">
                            <div className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                                <step.icon className="w-7 h-7" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">{step.title}</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══ Trust Engine Marketing Banner ═══ */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 via-blue-700 to-blue-900 p-8 md:p-12 shadow-xl">
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

            {/* ═══ Merchant CTA ═══ */}
            <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12" dir={isRTL ? 'rtl' : 'ltr'}>
                <div className="bg-white rounded-2xl border border-slate-200 p-8 md:p-10 shadow-sm flex flex-col md:flex-row items-center gap-8">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 w-16 h-16 rounded-2xl flex items-center justify-center shrink-0">
                        <TrendingUp className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1 text-center md:text-start">
                        <h3 className="text-xl font-bold text-slate-900 mb-1">
                            {lang === 'ar' ? 'هل أنت صاحب نشاط تجاري؟' : 'Are you a business owner?'}
                        </h3>
                        <p className="text-slate-500 text-sm">
                            {lang === 'ar'
                                ? 'طالب بنشاطك التجاري وابدأ بإدارة سمعتك الرقمية، وامنح عملاءك كوبونات ومكافآت حصرية.'
                                : 'Claim your business, manage your digital reputation, and reward your loyal customers with exclusive coupons.'}
                        </p>
                    </div>
                    <Link
                        href="/merchant/login"
                        className="shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3.5 rounded-2xl font-bold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md flex items-center gap-2"
                    >
                        {lang === 'ar' ? 'ابدأ الآن' : 'Get Started'}
                        <Zap className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
                    </Link>
                </div>
            </section>
        </>
    );
}
