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
                    /* Clean Minimalist Empty State for Log History */
                    <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50/50 rounded-2xl border border-slate-100 p-8 text-center mt-2">
                        <div className="mb-6 bg-teal-50 p-6 rounded-full inline-flex items-center justify-center">
                            <svg className="w-16 h-16 text-teal-600" fill="currentColor" viewBox="0 0 24 24">
                                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">
                            {lang === 'ar' ? 'ابدأ رحلة تقديرك' : 'Start your Tagdeer journey'}
                        </h3>
                        <p className="text-slate-500 font-medium max-w-sm mb-8 leading-relaxed">
                            {lang === 'ar'
                                ? 'قم بزيارة شركائنا المفضلين، ابدأ في جمع النقاط، وستظهر تقييماتك ونشاطاتك هنا لاحقاً.'
                                : 'Visit our favorite partners, start collecting points, and your reviews and activities will appear here later.'}
                        </p>
                        <Button
                            className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-8 py-6 text-base font-semibold shadow-sm transition-all hover:shadow-md"
                            onClick={() => window.location.href = '/'}
                        >
                            {lang === 'ar' ? 'اكتشف الشركاء' : 'Discover Partners'}
                        </Button>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="coupons" className="mt-0 outline-none">
                <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50/50 rounded-2xl border border-slate-100 p-8 text-center mt-2">
                    <div className="mb-6 bg-amber-50 p-6 rounded-full inline-flex items-center justify-center">
                        <svg className="w-16 h-16 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">
                        {lang === 'ar' ? 'لا توجد مكافآت بعد' : 'No rewards yet'}
                    </h3>
                    <p className="text-slate-500 font-medium max-w-sm mb-8 leading-relaxed">
                        {lang === 'ar'
                            ? 'استمر في دعم شركائك المفضلين لتفتح قسائم حصرية ومكافآت خاصة تظهر هنا.'
                            : 'Continue supporting your favorite partners to unlock exclusive vouchers and special rewards that appear here.'}
                    </p>
                    <Button
                        variant="outline"
                        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-full px-8 py-6 text-base font-semibold shadow-sm transition-all"
                        onClick={() => window.location.href = '/about'}
                    >
                        {lang === 'ar' ? 'كيف أحصل على مكافآت؟' : 'How do I get rewards?'}
                    </Button>
                </div>
            </TabsContent>
        </Tabs>
    );
}
