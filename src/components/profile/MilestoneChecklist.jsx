'use client';

import React from 'react';
import { Trophy, Star, Flame, Phone, User, Lock, CheckCircle2 } from 'lucide-react';

/**
 * MilestoneChecklist — shows the user's milestone progress toward
 * the Gader barrier and reward eligibility, using brand-aligned terminology.
 */
const MILESTONES = [
    {
        key: 'phone_verified',
        icon: Phone,
        bonus: 25,
        labelEn: 'Verify Phone Number',
        labelAr: 'توثيق رقم الهاتف',
        check: (user) => !!user?.phone_verified
    },
    {
        key: 'profile_complete',
        icon: User,
        bonus: 10,
        labelEn: 'Complete Profile (Name, City, Gender)',
        labelAr: 'أكمل ملفك الشخصي (الاسم، المدينة، الجنس)',
        check: (user) => !!(user?.full_name && user?.city && user?.gender)
    },
    {
        key: 'unique_5',
        icon: Star,
        bonus: 5,
        labelEn: 'Vote on 5 unique businesses',
        labelAr: 'قيّم 5 أنشطة تجارية مختلفة',
        check: (user) => (user?.unique_businesses_count || 0) >= 5 || user?.milestones_completed?.unique_5
    },
    {
        key: 'unique_15',
        icon: Star,
        bonus: 10,
        labelEn: 'Vote on 15 unique businesses',
        labelAr: 'قيّم 15 نشاطاً تجارياً مختلفاً',
        check: (user) => (user?.unique_businesses_count || 0) >= 15 || user?.milestones_completed?.unique_15
    },
    {
        key: 'unique_30',
        icon: Trophy,
        bonus: 15,
        labelEn: 'Vote on 30 unique businesses',
        labelAr: 'قيّم 30 نشاطاً تجارياً مختلفاً',
        check: (user) => (user?.unique_businesses_count || 0) >= 30 || user?.milestones_completed?.unique_30
    },
    {
        key: 'streak_7',
        icon: Flame,
        bonus: 10,
        labelEn: '7-day voting streak',
        labelAr: 'سلسلة تقييمات لمدة 7 أيام متتالية',
        check: (user) => (user?.longest_streak || 0) >= 7 || user?.milestones_completed?.streak_7
    },
    {
        key: 'streak_30',
        icon: Flame,
        bonus: 25,
        labelEn: '30-day voting streak',
        labelAr: 'سلسلة تقييمات لمدة 30 يوماً متتالية',
        check: (user) => (user?.longest_streak || 0) >= 30 || user?.milestones_completed?.streak_30
    },
];

export function MilestoneChecklist({ user, lang = 'en', barrierProgress }) {
    const isRTL = lang === 'ar';
    const completedCount = MILESTONES.filter(m => m.check(user)).length;
    const totalBonus = MILESTONES.filter(m => m.check(user)).reduce((sum, m) => sum + m.bonus, 0);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
            {/* Barrier Progress Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-amber-300" />
                            {isRTL ? 'حاجز المكافآت' : 'Reward Barrier'}
                        </h3>
                        <p className="text-indigo-200 text-sm mt-1">
                            {isRTL
                                ? `اجمع ${barrierProgress?.required || 200} قدر لتفتح المكافآت`
                                : `Collect ${barrierProgress?.required || 200} Gader to unlock rewards`}
                        </p>
                    </div>
                    <div className="text-right">
                        <span className="text-3xl font-black text-amber-300">{barrierProgress?.current || 0}</span>
                        <span className="text-indigo-200 text-lg font-medium"> / {barrierProgress?.required || 200}</span>
                    </div>
                </div>

                {/* Barrier progress bar */}
                <div className="relative h-4 bg-white/20 rounded-full overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-300 to-amber-400 transition-all duration-700 rounded-full"
                        style={{ width: `${barrierProgress?.percentage || 0}%` }}
                    />
                </div>

                {/* Status badges */}
                <div className="flex gap-3 mt-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                        barrierProgress?.meetsBarrier ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/10 text-indigo-200'
                    }`}>
                        {barrierProgress?.meetsBarrier ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {isRTL ? 'حاجز القدر' : 'Gader Barrier'}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                        barrierProgress?.meetsPhone ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/10 text-indigo-200'
                    }`}>
                        {barrierProgress?.meetsPhone ? <CheckCircle2 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {isRTL ? 'توثيق الهاتف' : 'Phone Verified'}
                    </span>
                </div>
            </div>

            {/* Milestone list */}
            <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-slate-700">
                        {isRTL ? 'الإنجازات' : 'Milestones'}
                    </h4>
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                        {completedCount}/{MILESTONES.length} • +{totalBonus} {isRTL ? 'قدر' : 'Gader'}
                    </span>
                </div>

                <div className="space-y-3">
                    {MILESTONES.map((milestone) => {
                        const completed = milestone.check(user);
                        const Icon = milestone.icon;

                        return (
                            <div
                                key={milestone.key}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                                    completed
                                        ? 'bg-emerald-50 border border-emerald-100'
                                        : 'bg-slate-50 border border-slate-100'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                    completed ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                                }`}>
                                    {completed ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                                </div>
                                <span className={`flex-grow text-sm font-medium ${
                                    completed ? 'text-emerald-700 line-through' : 'text-slate-600'
                                }`}>
                                    {isRTL ? milestone.labelAr : milestone.labelEn}
                                </span>
                                <span className={`text-xs font-bold shrink-0 ${
                                    completed ? 'text-emerald-500' : 'text-amber-500'
                                }`}>
                                    +{milestone.bonus} {isRTL ? 'قدر' : 'Gader'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
