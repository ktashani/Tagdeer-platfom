'use client';

import React from 'react';
import { BadgeCheck, LogOut, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

/**
 * ProfileHeader — displays the user's avatar, tier badge, name,
 * points, log count, and gamification progress bar.
 */
export function ProfileHeader({ user, displayLogs, progressInfo, isRTL, t, lang, logout, router }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
            <div className="bg-blue-800 p-6 sm:p-10 text-white flex flex-col relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10 pointer-events-none">
                    <BadgeCheck className="w-64 h-64" />
                </div>

                <div className="absolute top-4 end-4 sm:top-6 sm:end-6 z-20">
                    <Button
                        variant="ghost"
                        className="text-white hover:bg-white/20 hover:text-white border-white/20"
                        onClick={() => {
                            logout();
                            router.push('/');
                        }}
                    >
                        <LogOut className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {t('logout') || 'Sign Out'}
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 z-10 w-full pt-12 sm:pt-0 sm:pe-32">
                    <div className="bg-white/20 backdrop-blur-sm w-24 h-24 rounded-full flex items-center justify-center text-5xl shrink-0 overflow-hidden border-2 border-white/30 shadow-lg relative">
                        {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
                        ) : (() => {
                            const pts = user.gader || 0;
                            const th = progressInfo?.thresholds || { guest: 20, bronze: 1000, silver: 5000, gold: 20000 };
                            if (pts >= th.gold) return <span>💎</span>;
                            if (pts >= th.silver) return <span>🥇</span>;
                            if (pts >= th.bronze) return <span>🥈</span>;
                            if (pts >= th.guest) return <span>🥉</span>;
                            return <span>👤</span>;
                        })()}
                    </div>

                    <div className="flex flex-col items-center sm:items-start flex-grow text-center sm:text-start">
                        <div className="flex items-center gap-2 bg-blue-900/50 px-3 py-1 rounded-full text-sm font-medium mb-3 backdrop-blur-sm">
                            <BadgeCheck className="w-4 h-4 text-emerald-400" />
                            <span>{user.vipTier}</span>
                        </div>
                        <h1 className="text-3xl font-bold mb-1 font-mono tracking-wider">{user.full_name}</h1>
                        <p className="text-blue-200 text-lg mb-4">{t('member_since') || 'Member since 2026'}</p>

                        <div className="flex gap-6 mt-auto">
                            <div className="flex flex-col">
                                <span className="text-sm text-blue-200 uppercase tracking-wider font-semibold">{t('gader_points') || 'Gader Points'}</span>
                                <span className="text-3xl font-bold text-amber-300">{user.gader}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm text-blue-200 uppercase tracking-wider font-semibold">{t('logs') || 'Logs'}</span>
                                <span className="text-3xl font-bold">{displayLogs.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gamification Progress Bar */}
            <div className="bg-slate-50 border-t border-slate-100 p-6 px-6 sm:px-10">
                <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-600" />
                        <div className="flex flex-col">
                            <span className="font-semibold text-slate-700">{progressInfo.nextTier} {t('tier') || 'Tier'}</span>
                            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t('migdar')}</span>
                        </div>
                    </div>
                    <span className="text-sm font-bold text-indigo-600">{user.gader} / {(user.gader || 0) + progressInfo.pointsNeeded} {t('gader_points') || 'Gader Points'}</span>
                </div>
                <Progress value={progressInfo.percentage} className="h-3 bg-slate-200" indicatorcolor="bg-indigo-600" />
                <p className="text-sm text-slate-500 mt-2 font-medium">
                    {t('points_to_next_tier')?.replace('{points}', progressInfo.pointsNeeded).replace('{tier}', progressInfo.nextTier) || `Only ${progressInfo.pointsNeeded} more Gader Points to reach ${progressInfo.nextTier} Tier!`}
                </p>
            </div>
        </div>
    );
}
