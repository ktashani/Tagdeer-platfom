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
                ) : displayLogs.length > 0 ? (
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
                ) : (
                    /* Ghosted Empty State for Log History */
                    <div className="relative">
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-xl border border-slate-200 shadow-sm">
                            <div className="bg-white p-4 rounded-full shadow-md mb-4">
                                <AlertCircle className="w-10 h-10 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">
                                {lang === 'ar' ? 'لا توجد نشاطات بعد' : 'No Activity Yet'}
                            </h3>
                            <p className="text-slate-600 text-center max-w-sm px-4 font-medium leading-relaxed">
                                {lang === 'ar'
                                    ? 'قم بمسح أي رمز استجابة سريعة لتبدأ في بناء تاريخ تقييماتك!'
                                    : 'Scan any QR code and start evaluating places to build your history!'}
                            </p>
                            <Button className="mt-6 bg-blue-600 hover:bg-blue-700 rounded-full text-white cursor-default">
                                {lang === 'ar' ? 'أمثلة توضيحية أدناه' : 'Examples below'}
                            </Button>
                        </div>

                        <div className="space-y-4 opacity-40 grayscale pointer-events-none select-none blur-[1px]">
                            {/* Fake Log 1 */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex gap-4 items-start w-full">
                                    <div className="p-3 rounded-full mt-1 shrink-0 bg-emerald-100 text-emerald-600">
                                        <BadgeCheck className="w-6 h-6" />
                                    </div>
                                    <div className="flex-grow">
                                        <h3 className="font-bold text-lg text-slate-800">Caffeine Espresso Bar</h3>
                                        <div className="flex items-center gap-3 flex-wrap mt-2">
                                            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded">2 days ago</span>
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-flex items-center gap-1">
                                                <Zap className="w-3 h-3" /> 1.5x Impact
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="font-medium whitespace-nowrap px-3 py-1 rounded-full text-sm bg-emerald-50 text-emerald-700">Recommended</div>
                            </div>
                            {/* Fake Log 2 */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex gap-4 items-start w-full">
                                    <div className="p-3 rounded-full mt-1 shrink-0 bg-rose-100 text-rose-600">
                                        <AlertCircle className="w-6 h-6" />
                                    </div>
                                    <div className="flex-grow">
                                        <h3 className="font-bold text-lg text-slate-800">Local Supermarket</h3>
                                        <div className="flex items-center gap-3 flex-wrap mt-2">
                                            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded">1 week ago</span>
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-flex items-center gap-1">
                                                <Zap className="w-3 h-3" /> 2.0x Impact
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="font-medium whitespace-nowrap px-3 py-1 rounded-full text-sm bg-rose-50 text-rose-700">Complained</div>
                            </div>
                        </div>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="coupons" className="mt-0 outline-none">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {/* Overlay Message */}
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[3px]">
                        <div className="bg-indigo-100 p-4 rounded-full shadow-sm mb-4">
                            <Ticket className="w-8 h-8 text-indigo-600 animate-pulse" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-indigo-900 mb-2">
                            {t('coupons_rewards_title') || 'Coupons & Rewards'}
                        </h2>
                        <p className="text-slate-700 text-center max-w-sm px-6 font-medium mb-6">
                            {lang === 'ar'
                                ? 'نحن نبني محرك مكافآت مذهل. قريباً ستتمكن من استبدال نقاط تقدير بخصومات حصرية!'
                                : 'We are building an incredible rewards engine. Soon you will be able to spend your Gader Points for exclusive discounts!'}
                        </p>
                        <span className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-full font-bold text-sm tracking-widest uppercase shadow-md">
                            {t('coming_soon') || 'Coming Soon'}
                        </span>
                    </div>

                    {/* Ghosted Coupons Background */}
                    <div className="p-8 grid gap-4 opacity-30 grayscale blur-[2px] pointer-events-none select-none">
                        <div className="flex items-center justify-between border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50">
                            <div>
                                <h3 className="font-bold text-xl text-slate-800">15% Off Your Next Meal</h3>
                                <p className="text-sm text-slate-500 mt-1">Valid at participating cafes</p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-extrabold text-indigo-600">1,500</div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gader</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50">
                            <div>
                                <h3 className="font-bold text-xl text-slate-800">Free Coffee Upgrade</h3>
                                <p className="text-sm text-slate-500 mt-1">Any size coffee, anywhere</p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-extrabold text-indigo-600">800</div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Gader</div>
                            </div>
                        </div>
                    </div>
                </div>
            </TabsContent>
        </Tabs>
    );
}
