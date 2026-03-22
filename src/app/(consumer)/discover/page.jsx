'use client';
import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTagdeer } from '@/context/TagdeerContext';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { Search, MapPin } from 'lucide-react';
import { SkeletonCardGrid } from '@/components/ui/SkeletonLoaders';
import BusinessCard from '@/components/consumer/BusinessCard';
import LogItem from '@/components/consumer/LogItem';

function DiscoverContent() {
    const {
        t, lang, isRTL, businesses, isLoading, anonInteractions, refreshAnonInteractions,
        showToast, setShowLimitModal, setShowLoginModal, setVoteModal, setVoteReason, user,
        categories = [], regions = [], supabase
    } = useTagdeer();

    const displayCategories = ["All", ...categories.map(c => typeof c === 'string' ? c : c.name)];
    const displayRegions = ["All", ...regions.map(r => typeof r === 'string' ? r : r.name)];

    const searchParams = useSearchParams();

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const searchTimerRef = useRef(null);

    const handleSearchChange = useCallback((value) => {
        setSearchQuery(value);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setDebouncedSearch(value);
        }, 300);
    }, []);

    const [selectedRegion, setSelectedRegion] = useState('All');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [expandedLogs, setExpandedLogs] = useState({});
    const [inlineVote, setInlineVote] = useState({}); // { businessId: 'recommend'|'complain' }

    // Infinite scroll state
    const PAGE_SIZE = 12;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const loadMoreRef = useRef(null);

    // Pre-populate search from URL ?q= param (e.g. from Hero search)
    useEffect(() => {
        const q = searchParams.get('q');
        if (q) {
            setSearchQuery(q);
            setDebouncedSearch(q);
        }
    }, [searchParams]);

    const toggleLogs = (id) => {
        setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleInlineVote = async (businessId, type) => {
        // If collapsing (same button clicked again), just toggle off
        if (inlineVote[businessId] === type) {
            setInlineVote(prev => ({ ...prev, [businessId]: null }));
            return;
        }

        // Block merchant accounts from voting
        if (user?.role === 'merchant') {
            if (showToast) showToast(lang === 'ar'
                ? 'حسابات التجار لا يمكنها التصويت. استخدم حساب مستهلك.'
                : 'Merchant accounts cannot vote. Use a consumer account.'
            );
            return;
        }

        // Gate: anonymous vote limit check BEFORE expanding
        if (!user && supabase) {
            try {
                const fingerprint = await getDeviceFingerprint();
                const twentyFourHoursAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const { count, error } = await supabase
                    .from('logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('fingerprint', fingerprint)
                    .gte('created_at', twentyFourHoursAgo);

                if (!error && count >= 3) {
                    setShowLimitModal(true);
                    return; // Block expansion entirely
                }
            } catch (e) {
                console.error('Limit check failed:', e);
            }
        }

        // Safe to expand
        setInlineVote(prev => ({ ...prev, [businessId]: type }));
    };

    // A1: Trending sort — 72-hour activity window
    const trendingScore = useCallback((b) => {
        const now = Date.now();
        const WINDOW = 72 * 3600000; // 72 hours
        const recentLogs = (b.logs || []).filter(l =>
            l.created_at && (now - new Date(l.created_at).getTime()) < WINDOW
        );
        const totalVotes = (b.recommends || 0) + (b.complains || 0);
        return recentLogs.length * 100 + totalVotes; // recent activity weighted heavily
    }, []);

    const filteredBusinesses = businesses
        .filter(b => {
            const matchesSearch = b.name.toLowerCase().includes(debouncedSearch.toLowerCase());
            const matchesRegion = selectedRegion === 'All' || b.region === selectedRegion;
            const matchesCategory = selectedCategory === 'All' || b.category === selectedCategory;
            return matchesSearch && matchesRegion && matchesCategory;
        })
        .sort((a, b) => trendingScore(b) - trendingScore(a));

    // Infinite scroll — visible slice
    const visibleBusinesses = filteredBusinesses.slice(0, visibleCount);
    const hasMore = visibleCount < filteredBusinesses.length;

    // Reset visible count when filters change
    useEffect(() => { setVisibleCount(PAGE_SIZE) }, [debouncedSearch, selectedRegion, selectedCategory]);

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        if (!loadMoreRef.current || !hasMore) return;
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                setVisibleCount(prev => prev + PAGE_SIZE);
            }
        }, { rootMargin: '200px' });
        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [hasMore, visibleCount]);


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
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                </div>
                <div className="flex gap-4">
                    <select className="px-4 py-3 rounded-xl border border-slate-300 bg-white" value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
                        {displayRegions.map(r => <option key={r} value={r}>{t(r)}</option>)}
                    </select>
                    <select className="px-4 py-3 rounded-xl border border-slate-300 bg-white" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                        {displayCategories.map(c => <option key={c} value={c}>{t(c)}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {isLoading ? (
                    <div className="col-span-full"><SkeletonCardGrid count={6} variant="light" /></div>
                ) : visibleBusinesses.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-5">
                            <Search className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                            {lang === 'ar' ? 'لا يوجد نتائج' : 'No results found'}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                            {lang === 'ar' 
                                ? 'لم نتمكن من العثور على أي نشاط تجاري مطابق لبحثك. جرب البحث بكلمات مختلفة أو تغيير الفلتر.' 
                                : 'We couldn\'t find any businesses matching your search. Try adjusting your filters or search terms.'}
                        </p>
                        <button 
                            onClick={() => { setSearchQuery(''); setDebouncedSearch(''); setSelectedRegion('All'); setSelectedCategory('All'); }}
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium px-6 py-2 rounded-xl transition-colors"
                        >
                            {lang === 'ar' ? 'مسح الفلاتر' : 'Clear Filters'}
                        </button>
                    </div>
                ) : visibleBusinesses.map(business => (
                    <BusinessCard
                        key={business.id}
                        business={business}
                        t={t}
                        lang={lang}
                        isRTL={isRTL}
                        shareToFacebook={shareToFacebook}
                        expandedLogs={expandedLogs}
                        toggleLogs={toggleLogs}
                        inlineVoteType={inlineVote[business.id] || null}
                        toggleInlineVote={toggleInlineVote}
                    />
                ))}
            </div>
            {/* Infinite scroll sentinel */}
            {hasMore && (
                <div ref={loadMoreRef} className="flex justify-center py-8">
                    <div className="animate-pulse text-slate-400 text-sm">
                        {lang === 'ar' ? 'جار التحميل...' : 'Loading more...'}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DiscoverRoute() {
    return (
        <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-slate-500">Loading businesses...</div>}>
            <DiscoverContent />
        </Suspense>
    );
}
