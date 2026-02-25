'use client';

import React from 'react';
import { useTagdeer } from '../../context/TagdeerContext';
import { BadgeCheck, HeartHandshake, TrendingUp, BookOpen, Users, ShieldCheck, Clock, Sparkles, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AboutRoute() {
    const { t, lang, setShowPreRegModal } = useTagdeer();
    const router = useRouter();

    const tiers = [
        { emoji: '👤', name: lang === 'ar' ? 'ضيف' : 'Guest', multi: '0.2x', range: lang === 'ar' ? 'غير موثّق' : 'Unverified', color: 'from-slate-100 to-slate-200', text: 'text-slate-600', border: 'border-slate-200' },
        { emoji: '🥉', name: lang === 'ar' ? 'برونزي' : 'Bronze', multi: '1.0x', range: '0 – 999', color: 'from-amber-50 to-orange-100', text: 'text-amber-700', border: 'border-amber-200' },
        { emoji: '🥈', name: lang === 'ar' ? 'فضي' : 'Silver', multi: '1.5x', range: '1,000 – 4,999', color: 'from-slate-50 to-gray-200', text: 'text-slate-600', border: 'border-slate-300' },
        { emoji: '🥇', name: lang === 'ar' ? 'ذهبي' : 'Gold', multi: '2.0x', range: '5,000 – 19,999', color: 'from-yellow-50 to-amber-100', text: 'text-yellow-700', border: 'border-yellow-200' },
        { emoji: '💎', name: 'VIP', multi: '2.5x', range: '20,000+', color: 'from-indigo-50 to-blue-100', text: 'text-indigo-700', border: 'border-indigo-200' },
    ];

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-bold tracking-wider mb-6">
                    <BadgeCheck className="h-4 w-4" /> {lang === 'ar' ? 'أعطيهم تقديرك، واكسب قَدْرك' : 'Give your Tagdeer, earn your Gader'}
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">{t('about_title')}</h1>
                <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                    {t('about_intro_p1')}
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-20">
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                        <HeartHandshake className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">{t('about_concept_title')}</h3>
                    <p className="text-slate-600">{t('about_concept_desc')}</p>
                </div>
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                    <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">{t('about_sat_title')}</h3>
                    <p className="text-slate-600">{t('about_sat_desc')}</p>
                </div>
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
                        <BookOpen className="h-6 w-6 text-indigo-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">{t('about_dict_title')}</h3>
                    <p className="text-slate-600 italic">{t('about_dict_desc')}</p>
                </div>
            </div>

            {/* ── Trust Engine Section ────────────────────────────── */}
            <section id="trust-engine" className="mb-20 scroll-mt-24">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm font-bold tracking-wider mb-6">
                        <ShieldCheck className="h-4 w-4" />
                        {lang === 'ar' ? 'محرك الثقة' : 'Trust Engine'}
                    </div>
                    <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
                        {lang === 'ar' ? 'محرك الثقة من تقدير' : 'The Tagdeer Trust Engine'}
                    </h2>
                    <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                        {lang === 'ar'
                            ? 'نظام ذكي يضمن أن كل تقييم يعكس تجربة حقيقية ويمنع التلاعب.'
                            : 'A smart system that ensures every vote reflects a genuine experience and prevents manipulation.'}
                    </p>
                </div>

                {/* Philosophy Cards */}
                <div className="grid md:grid-cols-2 gap-6 mb-12">
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-blue-100 p-2.5 rounded-xl">
                                <Clock className="w-5 h-5 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {lang === 'ar' ? 'الجودة فوق الكمية' : 'Quality over Quantity'}
                            </h3>
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                            {lang === 'ar'
                                ? 'فترة انتظار 24 ساعة على نفس النشاط التجاري تمنع التصويت المتكرر وتضمن أن كل تقييم يمثل تجربة حقيقية منفصلة.'
                                : 'A 24-hour cooldown on the same business prevents repeat voting and ensures each evaluation represents a separate, genuine experience.'}
                        </p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-purple-100 p-2.5 rounded-xl">
                                <Sparkles className="w-5 h-5 text-purple-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">
                                {lang === 'ar' ? 'وجهات نظر متجددة' : 'Fresh Perspectives'}
                            </h3>
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                            {lang === 'ar'
                                ? 'نظام العوائد المتناقصة يقلل تأثير التصويت المتكرر على نفس النشاط خلال 30 يوماً، مما يمنع التلاعب بالتقييمات.'
                                : 'Diminishing returns reduce the impact of repeated votes on the same business over 30 days, preventing score manipulation and spam.'}
                        </p>
                    </div>
                </div>

                {/* Power Tiers */}
                <h3 className="text-xl font-bold text-slate-800 text-center mb-6">
                    <Zap className="w-5 h-5 inline-block text-amber-500 -mt-1" />
                    {' '}{lang === 'ar' ? 'مستويات التأثير' : 'The Power Tiers'}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {tiers.map((tier) => (
                        <div key={tier.name} className={`bg-gradient-to-b ${tier.color} rounded-2xl p-5 border ${tier.border} text-center shadow-sm hover:shadow-md transition-shadow`}>
                            <span className="text-3xl block mb-2">{tier.emoji}</span>
                            <h4 className={`text-lg font-bold ${tier.text} mb-1`}>{tier.name}</h4>
                            <span className="text-2xl font-black text-slate-800 block mb-1">{tier.multi}</span>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                {lang === 'ar' ? 'تأثير' : 'Impact'}
                            </span>
                            <div className="mt-3 pt-3 border-t border-slate-200/50">
                                <span className="text-xs font-semibold text-slate-400">
                                    {tier.range} {lang === 'ar' ? 'نقطة' : 'pts'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-[40px] p-8 md:p-16 text-white relative overflow-hidden shadow-2xl">
                <div className="relative z-10 max-w-3xl">
                    <div className="flex items-center gap-3 mb-6">
                        <Users className="h-8 w-8 text-blue-300" />
                        <h3 className="text-2xl md:text-3xl font-bold">{lang === 'ar' ? 'رؤيتنا للمستقبل' : 'Our Vision for the Future'}</h3>
                    </div>
                    <p className="text-xl md:text-2xl text-blue-100 leading-relaxed font-medium">
                        {t('about_p2')}
                    </p>
                    <div className="mt-10 flex gap-4">
                        <button onClick={() => router.push('/discover')} className="bg-white text-blue-900 px-8 py-3.5 rounded-2xl font-bold hover:bg-blue-50 transition-colors">
                            {t('find_biz')}
                        </button>
                        <button onClick={() => setShowPreRegModal(true)} className="bg-blue-600/30 border border-white/20 backdrop-blur-md text-white px-8 py-3.5 rounded-2xl font-bold">
                            {lang === 'ar' ? 'سجل عملك' : 'Register Business'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
