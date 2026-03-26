'use client';

import React, { memo } from 'react';
import Link from 'next/link';
import { MapPin, Store, ArrowRight } from 'lucide-react';

function LeaderCard({ business, type, lang, isRTL }) {
    const totalVotes = (business.recommends || 0) + (business.complains || 0);
    const recommendPct = totalVotes > 0 ? Math.round(((business.recommends || 0) / totalVotes) * 100) : 50;
    const avatarLetter = business.name?.charAt(0).toUpperCase() || '?';

    const hasStorefront = business.storefront?.status === 'published' && business.storefront?.slug;
    const linkHref = hasStorefront ? `/b/${business.storefront.slug}` : `/discover?q=${encodeURIComponent(business.name)}`;

    const isRecommend = type === 'recommend';
    const borderColor = isRecommend ? 'border-green-200 hover:border-green-300' : 'border-red-200 hover:border-red-300';
    const accentBg = isRecommend ? 'bg-green-50' : 'bg-red-50';

    return (
        <Link href={linkHref}
            className={`min-w-[260px] max-w-[300px] snap-start flex-shrink-0 rounded-2xl border ${borderColor} bg-white p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group`}
        >
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                {business.storefront?.logo_url ? (
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-100">
                        <img src={business.storefront.logo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-xl shrink-0 bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                        {avatarLetter}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-slate-800 truncate group-hover:text-blue-600 transition-colors">{business.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="w-3 h-3" /> {business.region}
                    </div>
                </div>
            </div>

            {/* Score bar */}
            <div className="w-full rounded-full h-2.5 overflow-hidden flex shadow-inner border border-slate-200 mb-2">
                <div className="bg-gradient-to-r from-green-400 to-green-500 h-full transition-all duration-700"
                    style={{ width: `${Math.max(recommendPct, 5)}%` }} />
                <div className="bg-gradient-to-r from-red-400 to-red-500 h-full transition-all duration-700"
                    style={{ width: `${Math.max(100 - recommendPct, 5)}%` }} />
            </div>

            <div className="flex justify-between text-[10px] font-bold mb-3">
                <span className="text-green-600">👍 {business.recommends || 0}</span>
                <span className="text-red-500">{business.complains || 0} 👎</span>
            </div>

            {/* Latest review */}
            {business.latestLog && (
                <div className={`${accentBg} rounded-lg p-2.5 text-xs text-slate-600 line-clamp-2 leading-relaxed`}>
                    "{business.latestLog.text}"
                </div>
            )}

            {/* CTA */}
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                {hasStorefront && <Store className="w-3.5 h-3.5" />}
                {hasStorefront
                    ? (lang === 'ar' ? 'زيارة صفحة النشاط' : 'Visit Storefront')
                    : (lang === 'ar' ? 'عرض في الاكتشاف' : 'View in Discover')}
                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
            </div>
        </Link>
    );
}

export default memo(LeaderCard);
