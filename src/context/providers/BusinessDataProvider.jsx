'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

const BusinessDataContext = createContext();

export function BusinessDataProvider({ children }) {
    const { user, supabase, lang } = useAuth();

    const [businesses, setBusinesses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchBusinesses = async () => {
            if (!supabase) return;
            setIsLoading(true);
            try {
                const ADMIN_ROLES = ['super_admin', 'admin', 'assistant_admin', 'support_agent'];
                const isAdmin = ADMIN_ROLES.includes(user?.role) || user?.userId === 'ADMIN-MOCK' || user?.isDevBypass;

                let mainQuery = supabase.from('businesses').select('*, logs(id, interaction_type, reason_text, created_at, helpful_votes, unhelpful_votes, fingerprint, profile_id, business_id), storefronts(slug, logo_url, status)').limit(200);
                if (!isAdmin) {
                    mainQuery = mainQuery.eq('status', 'published');
                }

                let ownedQuery = null;
                let claimsQuery = null;
                if (!isAdmin && user?.id) {
                    ownedQuery = supabase.from('businesses')
                        .select('*, logs(id, interaction_type, reason_text, created_at, helpful_votes, unhelpful_votes, fingerprint, profile_id, business_id), storefronts(slug, logo_url, status)')
                        .eq('claimed_by', user.id)
                        .neq('status', 'published');
                    claimsQuery = supabase.from('business_claims')
                        .select('business_id')
                        .eq('user_id', user.id);
                }

                // Execute primary queries in parallel
                const [mainRes, couponsRes, ribbonsRes, ownedRes, claimsRes] = await Promise.all([
                    mainQuery,
                    supabase.from('merchant_coupons').select('business_id').eq('status', 'active'),
                    supabase.from('business_ribbons').select('*').eq('is_active', true),
                    ownedQuery ? ownedQuery : Promise.resolve({ data: [] }),
                    claimsQuery ? claimsQuery : Promise.resolve({ data: [] })
                ]);

                if (mainRes.error) {
                    console.error('Supabase businesses fetch failed:', mainRes.error);
                    setBusinesses([]);
                    setIsLoading(false);
                    return;
                }

                const data = mainRes.data || [];
                const coupons = couponsRes.data || [];
                const ribbons = ribbonsRes.data || [];
                const ownedData = ownedRes.data || [];
                const claimRows = claimsRes.data || [];

                let ribbonsMap = {};
                ribbons.forEach(r => {
                    if (!r.expires_at || new Date(r.expires_at) > new Date()) {
                        if (!ribbonsMap[r.business_id]) ribbonsMap[r.business_id] = r;
                    }
                });

                let claimInitiatedData = [];
                if (claimRows.length > 0) {
                    const claimBizIds = claimRows.map(c => c.business_id);
                    const existingIds = new Set([
                        ...data.map(b => b.id),
                        ...ownedData.map(b => b.id)
                    ]);
                    const missingIds = claimBizIds.filter(id => !existingIds.has(id));

                    if (missingIds.length > 0) {
                        try {
                            const { data: claimBiz } = await supabase
                                .from('businesses')
                                .select('*, logs(id, interaction_type, reason_text, created_at, helpful_votes, unhelpful_votes, fingerprint, profile_id, business_id), storefronts(slug, logo_url, status)')
                                .in('id', missingIds);
                            claimInitiatedData = claimBiz || [];
                        } catch (e) {
                            console.warn('[BusinessDataProvider] Failed to fetch claim-initiated businesses:', e);
                        }
                    }
                }

                // Merge: published businesses + user's own non-published + claim-initiated businesses
                const mergedData = [...data, ...ownedData, ...claimInitiatedData];

                if (mergedData) {
                    const formattedData = mergedData.map(b => {
                        const rawLogs = b.logs || [];
                        const derivedRecommends = rawLogs.filter(i => i.interaction_type === 'recommend').length;
                        const derivedComplains = rawLogs.filter(i => i.interaction_type === 'complain').length;

                        return {
                            id: b.id,
                            name: b.name,
                            region: b.region,
                            category: b.category,
                            description: b.description || null,
                            phone: b.phone || null,
                            whatsapp: b.whatsapp || null,
                            instagram: b.instagram || null,
                            facebook: b.facebook || null,
                            website: b.website || null,
                            google_maps_url: b.google_maps_url || null,
                            logo_url: b.logo_url || null,
                            hasActiveDiscount: coupons?.some(c => c.business_id === b.id),
                            recommends: b.recommends ?? derivedRecommends,
                            complains: b.complains ?? derivedComplains,
                            shadow_score: b.shadow_score,
                            display_score: b.display_score,
                            isShielded: b.is_shielded,
                            isClaimed: !!b.claimed_by,
                            owner_id: b.claimed_by,
                            shield_level: b.shield_level || 0,
                            source: b.source,
                            status: b.status || 'published',
                            external_url: b.external_url,
                            promotion_multiplier: b.promotion_multiplier || 0,
                            storefront: (Array.isArray(b.storefronts) ? b.storefronts[0] : b.storefronts) || null,
                            activeRibbon: ribbonsMap[b.id] || null,
                            logs: rawLogs
                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                .map(log => ({
                                    id: log.id,
                                    type: log.interaction_type,
                                    text: log.reason_text || (log.interaction_type === 'recommend' ? 'User recommended' : 'User complained'),
                                    date: new Date(log.created_at).toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en-US'),
                                    created_at: log.created_at,
                                    is_verified: !!log.profile_id,
                                    helpful_votes: log.helpful_votes || 0,
                                    unhelpful_votes: log.unhelpful_votes || 0,
                                    fingerprint: log.fingerprint,
                                    profile_id: log.profile_id
                                }))
                        };
                    });
                    setBusinesses(formattedData);
                }
            } catch (err) {
                console.error('[BusinessDataProvider] Fetch error:', err);
                setBusinesses([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchBusinesses();

        if (supabase) {
            const channel = supabase
                .channel('public:businesses')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'businesses' }, (payload) => {
                    const updatedBusiness = payload.new;
                    setBusinesses(prev => prev.map(b =>
                        b.id === updatedBusiness.id
                            ? {
                                ...b,
                                name: updatedBusiness.name,
                                isClaimed: !!updatedBusiness.claimed_by,
                                owner_id: updatedBusiness.claimed_by,
                                isShielded: updatedBusiness.is_shielded,
                                shield_level: updatedBusiness.shield_level || 0,
                                status: updatedBusiness.status || 'published',
                                restriction_reason: updatedBusiness.restriction_reason,
                                recommends: updatedBusiness.recommends ?? b.recommends,
                                complains: updatedBusiness.complains ?? b.complains,
                                shadow_score: updatedBusiness.shadow_score,
                                display_score: updatedBusiness.display_score
                            }
                            : b
                    ));
                })
                .subscribe();

            const logChannel = supabase
                .channel('public:logs')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        const updatedLog = payload.new;
                        setBusinesses(prev => prev.map(b => ({
                            ...b,
                            logs: b.logs.map(log => log.id === updatedLog.id ? {
                                ...log,
                                helpful_votes: updatedLog.helpful_votes,
                                unhelpful_votes: updatedLog.unhelpful_votes
                            } : log)
                        })));
                    } else if (payload.eventType === 'INSERT') {
                        const newLog = payload.new;
                        setBusinesses(prev => prev.map(b => {
                            if (b.id === newLog.business_id) {
                                // Phase 2e fix: Skip if already added by optimistic update
                                if (b.logs.some(l => l.id === newLog.id)) return b;
                                return {
                                    ...b,
                                    logs: [
                                        {
                                            id: newLog.id,
                                            type: newLog.interaction_type,
                                            text: newLog.reason_text || (newLog.interaction_type === 'recommend' ? 'User recommended' : 'User complained'),
                                            date: new Date(newLog.created_at).toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en-US'),
                                            created_at: newLog.created_at,
                                            is_verified: !!newLog.profile_id,
                                            helpful_votes: newLog.helpful_votes || 0,
                                            unhelpful_votes: newLog.unhelpful_votes || 0,
                                            fingerprint: newLog.fingerprint,
                                            profile_id: newLog.profile_id
                                        },
                                        ...b.logs
                                    ]
                                };
                            }
                            return b;
                        }));
                    }
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
                supabase.removeChannel(logChannel);
            };
        }
    }, [supabase, lang, user?.id, user?.role, user?.isDevBypass]);

    return (
        <BusinessDataContext.Provider value={{ businesses, setBusinesses, isLoading }}>
            {children}
        </BusinessDataContext.Provider>
    );
}

export const useBusinessData = () => useContext(BusinessDataContext);
