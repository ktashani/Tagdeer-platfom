'use client';
import React, { useState } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { Search, MapPin, Facebook, Share2, BadgeCheck, MessageSquare, ChevronUp, ChevronDown, ThumbsUp, ThumbsDown, Zap } from 'lucide-react';
import { calculateBusinessScore } from '@/lib/mathEngine';

const CATEGORIES = [
    "All", "Supermarket", "Pharmacy", "Café & Restaurants", "Bakery",
    "Healthcare", "Electronics", "Tech & Telecommunication", "Construction",
    "Home Maintenance", "Automotive", "Beauty & Salon", "Real Estate",
    "Education", "Travel", "Fashion & Retail", "Services", "Food & Beverage", "Delivery & Shipping"
];
const REGIONS = ["All", "Tripoli", "Benghazi"];

export default function DiscoverRoute() {
    const { t, lang, isRTL, businesses, anonInteractions, showToast, setShowLimitModal, setVoteModal, setVoteReason, user } = useTagdeer();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRegion, setSelectedRegion] = useState('All');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [expandedLogs, setExpandedLogs] = useState({});

    const toggleLogs = (id) => {
        setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const filteredBusinesses = businesses.filter(b => {
        const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRegion = selectedRegion === 'All' || b.region === selectedRegion;
        const matchesCategory = selectedCategory === 'All' || b.category === selectedCategory;
        return matchesSearch && matchesRegion && matchesCategory;
    });

    const openVoteModal = (businessId, type, business) => {
        // Shield Level Checks for Complaints
        if (type === 'complain') {
            if (business.shield_level === 2) {
                // Fatora Level: Requires verified receipt upload (We'll show a toast for MVP)
                showToast(lang === 'ar' ? 'يتطلب هذا النشاط رفع فاتورة لإضافة شكوى.' : 'This business requires a receipt to complain.');
                return;
            } else if (business.shield_level === 1 || business.isShielded) {
                // Trust Level: Requires logged-in verified user
                if (!user) {
                    showToast(t('shielded_warning'));
                    setShowLoginModal(true);
                    return;
                }
            }
        }

        // Only apply the 3-vote global limit to anonymous users
        if (!user && anonInteractions >= 3) {
            setShowLimitModal(true);
            return;
        }
        setVoteModal({ isOpen: true, businessId, type });
        setVoteReason('');
    };

    const shareToFacebook = (title, text) => {
        const url = encodeURIComponent(window.location.href);
        const quote = encodeURIComponent(`${title} - ${text}`);
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`, '_blank');
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <h1 className="text-3xl font-bold text-blue-900 mb-8">{t('discover_title')}</h1>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5`} />
                    <input
                        type="text"
                        placeholder={t('search_placeholder')}
                        className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-4">
                    <select className="px-4 py-3 rounded-xl border border-slate-300 bg-white" value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
                        {REGIONS.map(r => <option key={r} value={r}>{t(r)}</option>)}
                    </select>
                    <select className="px-4 py-3 rounded-xl border border-slate-300 bg-white" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{t(c)}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {filteredBusinesses.map(business => (
                    <BusinessCard
                        key={business.id}
                        business={business}
                        t={t}
                        lang={lang}
                        isRTL={isRTL}
                        openVoteModal={openVoteModal}
                        shareToFacebook={shareToFacebook}
                        expandedLogs={expandedLogs}
                        toggleLogs={toggleLogs}
                    />
                ))}
            </div>
        </div>
    );
}

function BusinessCard({ business, t, lang, isRTL, openVoteModal, shareToFacebook, expandedLogs, toggleLogs }) {
    const { rawRecommends, rawComplains } = calculateBusinessScore(business.logs || []);
    const totalVotes = rawRecommends + rawComplains;
    const safeIndex = business.display_score ?? (totalVotes === 0 ? 50 : 50);
    const avatarLetter = business.name ? business.name.charAt(0).toUpperCase() : '?';

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

    return (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col relative overflow-hidden">

            {/* Dynamic Ribbon for Active Discounts */}
            {business.hasActiveDiscount && (
                <div className="absolute top-4 -right-8 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xs font-bold py-1 px-10 transform rotate-45 shadow-md z-10">
                    {t('discount_active', 'Discount Active!')}
                </div>
            )}

            {/* SEO: JSON-LD Review Schema Injection for Google Stars */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "LocalBusiness",
                        "name": business.name,
                        "address": {
                            "@type": "PostalAddress",
                            "addressLocality": business.region,
                            "addressCountry": "LY"
                        },
                        "aggregateRating": {
                            "@type": "AggregateRating",
                            "ratingValue": (safeIndex / 20).toFixed(1), // Convert 0-100 to 0.0-5.0
                            "bestRating": "5",
                            "worstRating": "1",
                            "ratingCount": totalVotes > 0 ? totalVotes : 1
                        }
                    })
                }}
            />

            <div className="flex items-start gap-4 mb-4 relative z-0">
                <div
                    className="w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center text-2xl font-bold text-white shadow-inner"
                    style={{ background: getGradient(business.category) }}
                >
                    {avatarLetter}
                </div>

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

            <div className="flex gap-3 mb-6">
                <button onClick={() => openVoteModal(business.id, 'recommend', business)} className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 py-3 rounded-xl font-semibold flex justify-center items-center gap-2">
                    <ThumbsUp className="h-5 w-5" /> {t('recommend')}
                </button>
                <button onClick={() => openVoteModal(business.id, 'complain', business)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-3 rounded-xl font-semibold flex justify-center items-center gap-2">
                    <ThumbsDown className="h-5 w-5" /> {t('complain')}
                </button>
            </div>

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

function LogItem({ log }) {
    const { t, showToast } = useTagdeer();
    const [isExpanded, setIsExpanded] = useState(false);

    // Fallbacks since our mock logs might not have these yet
    const isVerifiedAuthor = log.is_verified_author ?? false;
    const authorName = log.author_name || (log.profile_id ? 'VIP User' : 'Anonymous');
    const textLimit = 150;
    const isLong = log.text.length > textLimit;
    const displayText = isExpanded ? log.text : log.text.substring(0, textLimit) + (isLong ? '...' : '');

    const handleVote = (voteType) => {
        showToast(t('vote_mock_toast', `Thanks! You voted ${voteType}. This will affect the author's Gader points.`));
    };

    return (
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm flex flex-col gap-2 relative">
            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        {log.type === 'recommend' ? <ThumbsUp className="h-4 w-4 text-green-500" /> : <ThumbsDown className="h-4 w-4 text-red-500" />}
                        {isVerifiedAuthor && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 uppercase" title="Verified Tagdeer Consumer">
                                <BadgeCheck className="w-3 h-3" /> VIP
                            </div>
                        )}
                        <span className="text-slate-700 font-bold">{authorName}</span>
                        <span className="text-slate-400 text-[10px] ml-2">{log.date}</span>
                    </div>
                </div>

                {log.receipt_url && (
                    <div className="flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded text-[10px] font-bold" title="Verified Purchase">
                        📎 Receipt Attached
                    </div>
                )}
            </div>

            <p className="text-slate-600 leading-relaxed mt-1">
                {displayText}
                {isLong && (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="text-blue-600 font-bold ml-1 hover:underline">
                        {isExpanded ? t('show_less', 'Show Less') : t('see_more', 'See More')}
                    </button>
                )}
            </p>

            <div className="flex items-center gap-2 mt-2 pt-3 border-t border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-2">Community</span>
                <button onClick={() => handleVote('up')} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-green-600 hover:bg-green-50 px-2 py-1.5 rounded transition-colors group">
                    <ThumbsUp className="w-3.5 h-3.5 group-hover:fill-green-100" />
                    <span className={log.helpful_votes > 0 ? "text-green-600" : ""}>{log.helpful_votes || 0}</span>
                </button>
                <div className="w-px h-3 bg-slate-200"></div>
                <button onClick={() => handleVote('down')} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded transition-colors group">
                    <ThumbsDown className="w-3.5 h-3.5 group-hover:fill-red-100" />
                    <span className={log.unhelpful_votes > 0 ? "text-red-600" : ""}>{log.unhelpful_votes || 0}</span>
                </button>
                <span className="ml-auto text-xs text-slate-400 italic">Does this help?</span>
            </div>
        </div>
    );
}
