'use client';

import React, { useState, useMemo } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { Hero } from '@/components/Hero/Hero';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, Check, Crown, ShieldAlert, ThumbsUp, ThumbsDown, TrendingUp, TrendingDown, Store, MapPin, HeartHandshake, BadgeCheck, Sparkles, HelpCircle, ChevronUp, ChevronDown } from 'lucide-react';
import LeaderCard from '@/components/consumer/LeaderCard';

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

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-8">
          {topBusiness && (
            <div className="bg-gradient-to-br from-white to-blue-50 p-8 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden">
              <div className={`absolute -top-10 ${isRTL ? '-left-10' : '-right-10'} text-blue-100 opacity-50`}><ThumbsUp className="h-40 w-40" /></div>
              <div className="relative z-10">
                <h3 className="text-xl font-bold text-blue-800 mb-1">{t('top_biz_title')}</h3>
                <p className="text-sm text-slate-500 mb-6">{t('top_biz_subtitle')}</p>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-2xl font-bold text-slate-800">{topBusiness.name}</h4>
                      <span className="text-sm text-slate-500 flex items-center gap-1 mt-1"><MapPin className="h-4 w-4" /> {t(topBusiness.region)}</span>
                    </div>
                    <div className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-lg text-lg">
                      {topBusiness.recommends + topBusiness.complains} Votes
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => navigateTo('discover')} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors">
                      {lang === 'ar' ? 'عرض الملف' : 'View Profile'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-slate-900 to-blue-900 p-8 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden text-white">
            <div className={`absolute -bottom-10 ${isRTL ? '-left-10' : '-right-10'} text-white/5`}><ShieldAlert className="h-48 w-48" /></div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4 border border-green-500/30">
                <BadgeCheck className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{t('promo_shield_title')}</h3>
              <p className="text-blue-100 leading-relaxed mb-6">{t('promo_shield_desc')}</p>
              <button
                onClick={() => setShowPreRegModal(true)}
                className="bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-green-500/30"
              >
                {lang === 'ar' ? 'التسجيل المسبق للشركات' : 'Pre-Register Business'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-blue-900 mb-4">{t('how_it_works')}</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">{t('how_subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-blue-700"><HeartHandshake className="h-7 w-7" /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">{lang === 'ar' ? 'مساعدة الآخرين' : 'Help Others'}</h3>
              <p className="text-slate-600">{lang === 'ar' ? 'ملاحظاتك ترشد الآخرين في مجتمعك لاتخاذ خيارات أفضل ودعم الشركات التي تستحق ذلك.' : 'Your feedback guides others in your community to make better choices and support deserving businesses.'}</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-blue-700"><ThumbsUp className="h-7 w-7" /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">{lang === 'ar' ? 'تحسين مستوى الخدمة' : 'Elevate Service Quality'}</h3>
              <p className="text-slate-600">{lang === 'ar' ? 'التصويت الحقيقي يعطي أصحاب الأعمال رؤية واضحة حول أدائهم، مما يدفعهم لتحسين خدماتهم.' : 'Authentic votes give business owners a clear view of their performance, pushing them to improve their services.'}</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className={`absolute top-0 ${isRTL ? 'left-0 rounded-br-full' : 'right-0 rounded-bl-full'} w-24 h-24 bg-green-500 opacity-10 group-hover:scale-110 transition-transform`}></div>
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6 text-green-700"><BadgeCheck className="h-7 w-7" /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">{lang === 'ar' ? 'بيئة محمية وآمنة' : 'Protected & Safe Environment'}</h3>
              <p className="text-slate-600">{lang === 'ar' ? 'من خلال اشتراط التحقق من الهوية والفواتير في الشركات المحمية، نضمن خلو المجتمع من التقييمات الوهمية.' : 'By requiring verification and receipts for shielded companies, we ensure the community is free from fake reviews.'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-20 bg-gradient-to-br from-indigo-50 via-white to-blue-50 border-t border-indigo-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 relative">
            <div className="absolute top-0 left-1/4 animate-bounce hidden md:block opacity-50"><Sparkles className="h-8 w-8 text-yellow-400" /></div>
            <div className="absolute top-10 right-1/4 animate-pulse hidden md:block opacity-50"><HelpCircle className="h-10 w-10 text-indigo-300" /></div>

            <h2 className="text-3xl md:text-4xl font-extrabold text-indigo-900 mb-4 tracking-tight">
              {t('faq_title')}
            </h2>
            <p className="text-lg text-indigo-600/80 max-w-2xl mx-auto font-medium">
              {t('faq_subtitle')}
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md ${isOpen ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-slate-200'}`}
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex justify-between items-center p-6 text-left focus:outline-none"
                  >
                    <h3 className={`text-lg font-bold pr-4 ${isOpen ? 'text-indigo-700' : 'text-slate-800'}`}>
                      {item.q}
                    </h3>
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${isOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                      {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </button>

                  <div
                    className={`px-6 transition-all duration-300 ease-in-out ${isOpen ? 'max-h-60 pb-6 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
                  >
                    <p className="text-slate-600 leading-relaxed border-t border-indigo-50 pt-4">
                      {item.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>


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

