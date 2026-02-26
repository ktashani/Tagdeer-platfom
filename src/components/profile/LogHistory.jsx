'use client';

import React from 'react';
import { BadgeCheck, AlertCircle, Trash2, History, Ticket, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabaseClient';

/**
 * LogHistory — the Activity History + Coupons tabs showing
 * user log cards with impact weights and the coming-soon rewards section.
 */
export function LogHistory({ user, displayLogs, historyLogs, setHistoryLogs, isLoadingLogs, isRTL, t, lang, setActiveTab, setToastMessage }) {
    return (
        <Tabs defaultValue="history" onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 h-14 bg-slate-100 p-1 rounded-xl">
                <TabsTrigger value="history" className="text-base rounded-lg font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <History className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('my_history') || 'Activity History'}
                </TabsTrigger>
                <TabsTrigger value="coupons" className="text-base rounded-lg font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Ticket className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('my_rewards') || 'Coupons & Rewards'}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-0 outline-none">
                {/* Dev-only: Reset Cooldowns Button */}
                {process.env.NODE_ENV === 'development' && user?.id && user.id !== 'mock-uuid' && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                        <span className="text-sm text-amber-700 font-medium flex items-center gap-2">
                            <Trash2 className="w-4 h-4" /> Dev Tool: Reset your cooldowns for testing
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-amber-700 border-amber-300 hover:bg-amber-100"
                            onClick={async () => {
                                if (!supabase) return;
                                const { error } = await supabase
                                    .from('logs')
                                    .delete()
                                    .eq('profile_id', user.id);
                                if (!error) {
                                    setHistoryLogs([]);
                                    setToastMessage('Cooldowns reset! All your logs deleted.');
                                    setTimeout(() => setToastMessage(''), 3000);
                                }
                            }}
                        >
                            Reset Logs
                        </Button>
                    </div>
                )}

                {isLoadingLogs ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-pulse flex flex-col items-center gap-3">
                            <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
                            <div className="h-4 w-32 bg-slate-200 rounded"></div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {displayLogs.map((log) => (
                            <div key={log.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-300 transition-colors">
                                <div className="flex gap-4 items-start w-full">
                                    <div className={`p-3 rounded-full mt-1 shrink-0 ${log.type === 'recommend' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                        {log.type === 'recommend' ? <BadgeCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                                    </div>
                                    <div className="flex-grow">
                                        <h3 className="font-bold text-lg text-slate-800">{log.business}</h3>
                                        <p className="text-slate-500 text-sm mt-1 mb-2">{log.text}</p>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded inline-block">
                                                {new Date(log.date).toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </span>
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-flex items-center gap-1">
                                                <Zap className="w-3 h-3" /> {log.weight}x Impact
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`font-medium whitespace-nowrap px-3 py-1 rounded-full text-sm ${log.type === 'recommend' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                    {log.type === 'recommend' ? (t('recommended') || 'Recommended') : (t('complained') || 'Complained')}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </TabsContent>

            <TabsContent value="coupons" className="mt-0 outline-none">
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                    <div className="bg-white p-5 rounded-full shadow-sm mb-6 inline-flex">
                        <Ticket className="w-12 h-12 text-indigo-500 animate-pulse" />
                    </div>
                    <h2 className="text-3xl font-bold text-indigo-900 mb-3">{t('coupons_rewards_title') || 'Coupons & Rewards'}</h2>
                    <p className="text-indigo-600/80 text-lg max-w-md">
                        {t('coupons_rewards_desc') || 'We are building an incredible rewards engine. Soon you will be able to spend your Gader Points for exclusive discounts!'}
                    </p>
                    <div className="mt-8 inline-flex items-center gap-2 bg-indigo-900 text-white px-6 py-2 rounded-full font-medium text-sm tracking-wide uppercase">
                        {t('coming_soon') || 'Coming Soon'}
                    </div>
                </div>
            </TabsContent>
        </Tabs>
    );
}
