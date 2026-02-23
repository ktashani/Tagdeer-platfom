'use client';
import React, { useState } from 'react';
import { useTagdeer } from '../../context/TagdeerContext';
import { Search, MapPin, Facebook, Share2, BadgeCheck, MessageSquare, ChevronUp, ChevronDown, ThumbsUp, ThumbsDown } from 'lucide-react';
import { calculateBusinessScore } from '../../lib/mathEngine';

const CATEGORIES = [
    "All", "Supermarket", "Pharmacy", "Café & Restaurants", "Bakery",
    "Healthcare", "Electronics", "Tech & Telecommunication", "Construction",
    "Home Maintenance", "Automotive", "Beauty & Salon", "Real Estate",
    "Education", "Travel", "Fashion & Retail", "Services", "Food & Beverage", "Delivery & Shipping"
];
const REGIONS = ["All", "Tripoli", "Benghazi"];

export default function DiscoverRoute() {
    const { t, lang, isRTL, businesses, anonInteractions, showToast, setShowLimitModal, setVoteModal, setVoteReason } = useTagdeer();

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

    const openVoteModal = (businessId, type, isShielded) => {
        if (type === 'complain' && isShielded) {
            showToast(t('shielded_warning'));
            return;
        }
        if (anonInteractions >= 3) {
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
    const { healthScore, rawRecommends, rawComplains } = calculateBusinessScore(business.logs || []);
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
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col">
            <div className="flex items-start gap-4 mb-4">
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
                    </div>
                </div>

                <div className="flex gap-2 shrink-0">
                    <button onClick={() => shareToFacebook(business.name, `Tagdeer Gader Score: ${healthScore}%`)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                        <Share2 className="h-5 w-5" />
                    </button>
                    {business.isShielded && (
                        <div className="bg-blue-50 p-2 rounded-full border border-blue-100">
                            <BadgeCheck className="h-5 w-5 text-blue-600" />
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                <div className="flex justify-between text-sm mb-2 font-medium">
                    <span className="text-slate-600">{t('health_score')}</span>
                    <span className={healthScore > 50 ? 'text-green-600' : 'text-red-500'}>{healthScore}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden flex mb-2">
                    <div className="bg-green-500 h-3" style={{ width: `${healthScore}%` }}></div>
                    <div className="bg-red-400 h-3" style={{ width: `${100 - healthScore}%` }}></div>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                    <span className="text-green-600">{rawRecommends} {t('recommend')}</span>
                    <span className="text-red-500">{rawComplains} {t('complain')}</span>
                </div>
            </div>

            <div className="flex gap-3 mb-6">
                <button onClick={() => openVoteModal(business.id, 'recommend', false)} className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 py-3 rounded-xl font-semibold flex justify-center items-center gap-2">
                    <ThumbsUp className="h-5 w-5" /> {t('recommend')}
                </button>
                <button onClick={() => openVoteModal(business.id, 'complain', business.isShielded)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-3 rounded-xl font-semibold flex justify-center items-center gap-2">
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
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                        {business.logs.map(log => (
                            <div key={log.id} className="bg-slate-50 p-3 rounded-lg text-sm flex justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        {log.type === 'recommend' ? <ThumbsUp className="h-4 w-4 text-green-500" /> : <ThumbsDown className="h-4 w-4 text-red-500" />}
                                        <span className="text-slate-400 text-xs">{log.date}</span>
                                    </div>
                                    <p className="text-slate-700">{log.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div >
    );
}
