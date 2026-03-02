'use client';

import React, { useState } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { Hero } from '@/components/Hero/Hero';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, Check, Crown, ShieldAlert } from 'lucide-react';

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
