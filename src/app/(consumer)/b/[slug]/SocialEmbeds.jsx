"use client";

import { InstagramEmbed, FacebookEmbed } from 'react-social-media-embed';
import { Instagram, Facebook, ChevronRight } from 'lucide-react';

export function InstagramBlock({ url, isRTL }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 md:p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-sm shrink-0">
                        <Instagram className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white leading-tight">Instagram</p>
                        <p className="text-xs text-slate-500">{isRTL ? 'مشاركات الحساب' : 'Recent Posts'}</p>
                    </div>
                </div>
                <a href={url} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold text-pink-600 dark:text-pink-400 bg-pink-500/10 hover:bg-pink-500/20 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                    {isRTL ? 'زيارة الحساب' : 'View Profile'} <ChevronRight className="w-3 h-3" />
                </a>
            </div>
            <div className="w-full flex justify-center -mx-4 sm:mx-0 max-w-full overflow-hidden" suppressHydrationWarning>
                <InstagramEmbed url={url} width="100%" />
            </div>
        </div>
    );
}

export function FacebookBlock({ url, isRTL }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 md:p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
                        <Facebook className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white leading-tight">Facebook</p>
                        <p className="text-xs text-slate-500">{isRTL ? 'مشاركات الصفحة' : 'Recent Posts'}</p>
                    </div>
                </div>
                <a href={url} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
                    {isRTL ? 'زيارة الصفحة' : 'View Page'} <ChevronRight className="w-3 h-3" />
                </a>
            </div>
            <div className="w-full flex justify-center -mx-4 sm:mx-0 max-w-full overflow-hidden" suppressHydrationWarning>
                <FacebookEmbed url={url} width="100%" />
            </div>
        </div>
    );
}
