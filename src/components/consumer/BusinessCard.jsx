'use client';

import React, { useState, memo } from 'react';
import Link from 'next/link';
import { useTagdeer } from '@/context/TagdeerContext';
import { calculateBusinessScore } from '@/lib/mathEngine';
import { Phone, Globe, Instagram, Facebook, MessageCircle, Navigation, Share2, BadgeCheck, MessageSquare, ChevronUp, ChevronDown, ThumbsUp, ThumbsDown, Zap, Store, MapPin } from 'lucide-react';
import LogItem from './LogItem';
import { useVoteSubmission } from '@/hooks/useVoteSubmission';

function BusinessCard({ business, t, lang, isRTL, shareToFacebook, expandedLogs, toggleLogs, inlineVoteType, toggleInlineVote }) {
    const { voteReason, setVoteReason, user, supabase, anonInteractions, setAnonInteractions, setUser, showToast, setShowLimitModal, setBusinesses } = useTagdeer();
    const { submitVote } = useVoteSubmission({ user, supabase, lang, anonInteractions, setAnonInteractions, setUser, showToast, setShowLimitModal, setBusinesses });
    const { rawRecommends, rawComplains } = calculateBusinessScore(business.logs || []);
    const totalVotes = rawRecommends + rawComplains;
    const safeIndex = business.display_score ?? (totalVotes === 0 ? 50 : 50);
    const avatarLetter = business.name ? business.name.charAt(0).toUpperCase() : '?';
    const [inlineSubmitting, setInlineSubmitting] = useState(false);
    const [inlineReason, setInlineReason] = useState('');
    const [inlineConsent, setInlineConsent] = useState(false);

    // Contact icons data
    const contactLinks = [
        business.phone && { icon: Phone, href: `tel:${business.phone}`, label: 'Phone', color: 'text-blue-600' },
        business.whatsapp && { icon: MessageCircle, href: `https://wa.me/${business.whatsapp}`, label: 'WhatsApp', color: 'text-green-600' },
        business.instagram && { icon: Instagram, href: business.instagram.startsWith('http') ? business.instagram : `https://instagram.com/${business.instagram}`, label: 'Instagram', color: 'text-pink-600' },
        business.facebook && { icon: Facebook, href: business.facebook.startsWith('http') ? business.facebook : `https://facebook.com/${business.facebook}`, label: 'Facebook', color: 'text-blue-700' },
        business.website && { icon: Globe, href: business.website.startsWith('http') ? business.website : `https://${business.website}`, label: 'Website', color: 'text-indigo-600' },
        business.google_maps_url && { icon: Navigation, href: business.google_maps_url, label: 'Maps', color: 'text-emerald-600' },
    ].filter(Boolean);

    const getGradient = (category) => {
        const gradients = {
            'Electronics': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            'Tech & Telecommunication': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            'Healthcare': 'linear-gradient(135deg, #10b981, #047857)',
            'Pharmacy': 'linear-gradient(135deg, #10b981, #047857)',
            'Café & Restaurants': 'linear-gradient(135deg, #f59e0b, #b45309)',
            'Bakery': 'linear-gradient(135deg, #f59e0b, #b45309)',
            'Beauty & Salon': 'linear-gradient(135deg, #ec4899, #be185d)',
        };
        return gradients[category] || 'linear-gradient(135deg, #64748b, #334155)';
    };

    const hasStorefront = business.storefront && business.storefront.status === 'published';

    return (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col relative overflow-hidden">

            {/* Dynamic Ribbon for Active Business Ribbons */}
            {business.activeRibbon && (
                <div className={`absolute top-4 -right-8 text-white text-xs font-bold py-1 px-10 transform rotate-45 shadow-md z-10 ${{
                    red: 'bg-gradient-to-r from-red-500 to-rose-600',
                    green: 'bg-gradient-to-r from-emerald-500 to-green-600',
                    blue: 'bg-gradient-to-r from-blue-500 to-indigo-600',
                    amber: 'bg-gradient-to-r from-amber-500 to-orange-600',
                    purple: 'bg-gradient-to-r from-purple-500 to-violet-600',
                    pink: 'bg-gradient-to-r from-pink-500 to-rose-600',
                    orange: 'bg-gradient-to-r from-orange-500 to-red-600'
                }[business.activeRibbon.color] || 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
                    {business.activeRibbon.label}
                </div>
            )}

            {/* TODO: Phase 6 — Move JSON-LD to a server component for proper SEO indexing */}


            <div className="flex items-start gap-4 mb-4 relative z-0">
                {business.storefront?.logo_url ? (
                    <div className="w-16 h-16 rounded-2xl shrink-0 overflow-hidden shadow-sm border border-slate-100 bg-white">
                        <img src={business.storefront.logo_url} alt={`${business.name} logo`} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                ) : (
                    <div
                        className="w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center text-2xl font-bold text-white shadow-inner"
                        style={{ background: getGradient(business.category) }}
                    >
                        {avatarLetter}
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-bold text-slate-800 break-words line-clamp-2 leading-tight">{business.name}</h3>
                        {business.external_url && (
                            <a href={business.external_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1.5 rounded-full shrink-0">
                                <Facebook className="h-5 w-5" />
                            </a>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center text-sm text-slate-500 gap-2 mt-2">
                        <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-slate-400 shrink-0" /> {t(business.region)}</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md truncate">{t(business.category)}</span>

                        {/* Tagdeer Verified Badge logic */}
                        {business.isClaimed && (
                            <span className="flex items-center gap-1 text-blue-600 text-xs font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                <BadgeCheck className="w-3.5 h-3.5" />
                                Verified
                            </span>
                        )}
                    </div>

                    {/* A3: Claimed business description */}
                    {business.isClaimed && business.description && (
                        <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{business.description}</p>
                    )}

                    {/* A3: Contact icons row */}
                    {contactLinks.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                            {contactLinks.map(({ icon: Icon, href, label, color }) => (
                                <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                                    className={`p-1.5 rounded-full bg-slate-50 hover:bg-slate-100 ${color} transition-colors`}
                                    title={label}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-2 shrink-0">
                    <button onClick={() => shareToFacebook(business.name, `Tagdeer Gader Index: ${safeIndex}%`)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                        <Share2 className="h-5 w-5" />
                    </button>
                    {/* The Shield rendering logic: Level 1 (Trust) and Level 2 (Fatora) */}
                    {business.shield_level > 0 && (
                        <div className={`p-2 rounded-full border ${business.shield_level === 2 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`} title={business.shield_level === 2 ? "Fatora Shield (Receipts Required)" : "Trust Shield (SMS Verified)"}>
                            <BadgeCheck className={`h-5 w-5 ${business.shield_level === 2 ? 'text-amber-500' : 'text-slate-500'}`} />
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2 hover:border-blue-200 transition-colors cursor-help">
                <div className="flex justify-between items-end mb-3">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${totalVotes === 0 ? 'bg-slate-100 text-slate-400' : safeIndex >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            <Zap className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-700 font-bold text-lg leading-tight">{t('gader_index')}</span>
                            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t('migdar')}</span>
                        </div>
                    </div>
                    {/* Score label: neutral for zero votes, dual split otherwise */}
                    {totalVotes === 0 ? (
                        <span className="text-sm font-medium text-slate-400 italic">
                            {lang === 'ar' ? 'لا توجد تجارب بعد' : 'No experiences yet'}
                        </span>
                    ) : (
                        <div className="flex items-center gap-1.5 text-sm font-bold">
                            <span className="text-green-600">{safeIndex}%</span>
                            <span className="text-slate-300">/</span>
                            <span className="text-red-500">{100 - safeIndex}%</span>
                        </div>
                    )}
                </div>

                {/* Tug-of-War Progress Bar */}
                {totalVotes === 0 ? (
                    /* Neutral 50/50 bar for zero votes */
                    <div className="w-full rounded-full h-4 overflow-hidden flex shadow-inner border border-slate-200 mb-3">
                        <div className="bg-slate-300 h-4 w-1/2 flex items-center justify-end">
                            <span className="text-[10px] font-bold text-slate-500/70 pr-1.5">⚖️</span>
                        </div>
                        <div className="bg-slate-300 h-4 w-1/2 border-l border-slate-400/30 flex items-center justify-start">
                            <span className="text-[10px] font-bold text-slate-500/70 pl-1.5">⚖️</span>
                        </div>
                    </div>
                ) : (
                    <div className="w-full rounded-full h-4 overflow-hidden flex shadow-inner border border-slate-200 mb-3">
                        <div
                            className="bg-gradient-to-r from-green-400 to-green-500 h-4 transition-all duration-1000 ease-out flex items-center justify-end"
                            style={{ width: `${Math.max(safeIndex, 8)}%` }}
                        >
                            {safeIndex >= 20 && <span className="text-[10px] font-bold text-white/90 pr-1.5">👍</span>}
                        </div>
                        <div
                            className="bg-gradient-to-r from-red-400 to-red-500 h-4 transition-all duration-1000 ease-out flex items-center justify-start"
                            style={{ width: `${Math.max(100 - safeIndex, 8)}%` }}
                        >
                            {(100 - safeIndex) >= 20 && <span className="text-[10px] font-bold text-white/90 pl-1.5">👎</span>}
                        </div>
                    </div>
                )}

                <div className="flex justify-between text-xs font-bold px-1">
                    <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2 py-0.5 rounded">
                        <ThumbsUp className="w-3 h-3" />
                        {rawRecommends} {t('recommend')}
                    </div>
                    <div className="flex items-center gap-1.5 text-red-700 bg-red-50 px-2 py-0.5 rounded">
                        {rawComplains} {t('complain')}
                        <ThumbsDown className="w-3 h-3" />
                    </div>
                </div>
            </div>

            {hasStorefront && (
                <a href={`/b/${business.storefront.slug}`} className="mb-4 w-full bg-slate-50 hover:bg-blue-50 text-blue-600 border border-slate-200 hover:border-blue-200 py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors text-sm">
                    <Store className="w-4 h-4" />
                    {lang === 'ar' ? 'زيارة صفحة النشاط' : 'Visit Storefront'}
                </a>
            )}

            {/* A2: Inline vote buttons — expand section below instead of modal */}
            <div className="flex gap-3 mb-3">
                <button
                    onClick={() => toggleInlineVote(business.id, 'recommend')}
                    disabled={inlineSubmitting}
                    className={`flex-1 py-3 rounded-xl font-semibold flex justify-center items-center gap-2 transition-all border ${inlineSubmitting ? 'opacity-50 cursor-not-allowed' : ''} ${inlineVoteType === 'recommend'
                        ? 'bg-green-100 text-green-800 border-green-300 shadow-inner'
                        : 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200'
                        }`}
                >
                    <ThumbsUp className="h-5 w-5" /> {t('recommend')}
                </button>
                <button
                    onClick={() => toggleInlineVote(business.id, 'complain')}
                    disabled={inlineSubmitting}
                    className={`flex-1 py-3 rounded-xl font-semibold flex justify-center items-center gap-2 transition-all border ${inlineSubmitting ? 'opacity-50 cursor-not-allowed' : ''} ${inlineVoteType === 'complain'
                        ? 'bg-red-100 text-red-800 border-red-300 shadow-inner'
                        : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                        }`}
                >
                    <ThumbsDown className="h-5 w-5" /> {t('complain')}
                </button>
            </div>

            {/* A2: Inline voting expansion panel */}
            {inlineVoteType && (
                <div className={`mb-4 p-4 rounded-xl border transition-all animate-in slide-in-from-top-2 ${inlineVoteType === 'recommend' ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'
                    }`}>
                    <p className="text-sm font-semibold mb-2 text-slate-700">
                        {inlineVoteType === 'recommend'
                            ? (lang === 'ar' ? 'لماذا تنصح بهذا النشاط؟' : 'Why do you recommend this business?')
                            : (lang === 'ar' ? 'ما سبب شكواك؟' : 'What is your complaint about?')}
                    </p>
                    <textarea
                        value={inlineReason}
                        onChange={(e) => setInlineReason(e.target.value)}
                        placeholder={lang === 'ar' ? 'اكتب ملاحظتك هنا... (اختياري)' : 'Write your note here... (optional)'}
                        className="w-full p-3 rounded-lg border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        rows={2}
                        dir={isRTL ? 'rtl' : 'ltr'}
                    />

                    {/* Legal Consent: Reminder for logged-in, mandatory checkbox for anonymous */}
                    {user?.id ? (
                        /* Logged-in: non-blocking reminder */
                        <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                            {lang === 'ar' ? (
                                <>بالإرسال، أقر بأن هذا التقييم يعبّر عن رأيي الشخصي وفقاً <Link href="/terms" target="_blank" className="text-blue-500 underline hover:text-blue-700">لشروط الاستخدام</Link>.</>
                            ) : (
                                <>By submitting, I confirm this is my personal opinion per the <Link href="/terms" target="_blank" className="text-blue-500 underline hover:text-blue-700">Terms of Service</Link>.</>
                            )}
                        </p>
                    ) : (
                        /* Anonymous: mandatory checkbox */
                        <label className="flex items-start gap-2 mt-3 cursor-pointer select-none group">
                            <input
                                type="checkbox"
                                checked={inlineConsent}
                                onChange={(e) => setInlineConsent(e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                            />
                            <span className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-700">
                                {lang === 'ar' ? (
                                    <>أقر بأن هذا التقييم يعبّر عن رأيي الشخصي وأتحمل المسؤولية الكاملة عنه. أوافق على <Link href="/terms" target="_blank" className="text-blue-600 underline hover:text-blue-800">شروط الاستخدام</Link>.</>
                                ) : (
                                    <>I confirm this is my personal opinion and I take full responsibility. I agree to the <Link href="/terms" target="_blank" className="text-blue-600 underline hover:text-blue-800">Terms of Service</Link>.</>
                                )}
                            </span>
                        </label>
                    )}

                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={async () => {
                                setInlineSubmitting(true);
                                setVoteReason(inlineReason);
                                await submitVote(business.id, inlineVoteType, inlineReason, business.isClaimed);
                                setInlineReason('');
                                setInlineConsent(false);
                                toggleInlineVote(business.id, inlineVoteType);
                                setInlineSubmitting(false);
                            }}
                            disabled={inlineSubmitting || (!user?.id && !inlineConsent)}
                            className={`flex-1 py-2.5 rounded-lg font-bold text-sm text-white transition-colors ${inlineVoteType === 'recommend' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                } ${(inlineSubmitting || (!user?.id && !inlineConsent)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {inlineSubmitting
                                ? (lang === 'ar' ? 'جارٍ الإرسال...' : 'Submitting...')
                                : (lang === 'ar' ? 'إرسال' : 'Submit')}
                        </button>
                        <button
                            onClick={() => { setInlineReason(''); setInlineConsent(false); toggleInlineVote(business.id, inlineVoteType); }}
                            className="px-4 py-2.5 rounded-lg font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                    </div>
                </div>
            )}

            <div className="mt-auto border-t border-slate-100 pt-4">
                <button onClick={() => toggleLogs(business.id)} className="w-full flex justify-between items-center font-semibold text-slate-700 mb-3 hover:text-blue-600">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        {t('logs')}
                        <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">{business.logs.length}</span>
                    </div>
                    {expandedLogs[business.id] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>

                {expandedLogs[business.id] && (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {[...business.logs].sort((a, b) => {
                            const aScore = (a.helpful_votes || 0) - (a.unhelpful_votes || 0);
                            const bScore = (b.helpful_votes || 0) - (b.unhelpful_votes || 0);
                            return bScore - aScore;
                        }).map(log => (
                            <LogItem key={log.id} log={log} />
                        ))}
                    </div>
                )}
            </div>

            {/* Phase 5: The Veiled Gader FOMO Trigger */}
            {!business.isClaimed && business.shadow_score > business.display_score && (
                <div className="mt-4 mt-auto p-4 bg-gradient-to-r from-slate-900 to-blue-950 rounded-xl border border-blue-900 shadow-inner relative overflow-hidden group">
                    <div className="absolute -right-10 top-1/2 -translate-y-1/2 opacity-10 blur-md pointer-events-none transition-all group-hover:blur-sm group-hover:opacity-20 text-7xl font-black text-white">
                        {business.shadow_score}%
                    </div>
                    <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                            <h4 className="font-bold text-white flex items-center gap-2">
                                <Zap className="w-4 h-4 text-yellow-400" />
                                Unveil Your Gader
                            </h4>
                            <p className="text-xs text-blue-200 mt-1 max-w-[200px]">
                                Your true score is an Excellent <strong className="text-white">{business.shadow_score}%</strong>. Claim this profile to remove the limit.
                            </p>
                        </div>
                        <a href="/merchant/login" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg whitespace-nowrap transition-colors">
                            Claim Now
                        </a>
                    </div>
                </div>
            )}
        </div >
    );
}

export default memo(BusinessCard);
