'use client';

import React from 'react';
import { useTagdeer } from '../../context/TagdeerContext';
import { BadgeCheck, HeartHandshake, TrendingUp, BookOpen, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AboutRoute() {
    const { t, lang, setShowPreRegModal } = useTagdeer();
    const router = useRouter();

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
