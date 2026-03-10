'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

const INITIAL_BUSINESSES = [
    { id: 1, name: "Al-Madina Tech", region: "Tripoli", category: "Electronics", recommends: 145, complains: 12, isShielded: true, source: "Google", logs: [] },
    {
        id: 2, name: "Benghazi Builders Co.", region: "Benghazi", category: "Construction", recommends: 89, complains: 45, isShielded: false, source: "Facebook",
        logs: [{ id: 101, type: 'recommend', text: 'Fast and reliable building materials. Great service.', date: '2026-02-18' }]
    },
    { id: 3, name: "Tripoli Central Clinic", region: "Tripoli", category: "Healthcare", recommends: 320, complains: 5, isShielded: true, source: "Google", logs: [] },
    {
        id: 4, name: "Omar's Auto Repair", region: "Benghazi", category: "Automotive", recommends: 34, complains: 8, isShielded: false, source: "Manual",
        logs: [{ id: 102, type: 'complain', text: 'Overcharged me for a simple oil change. Needs improvement.', date: '2026-02-20' }]
    },
    { id: 5, name: "Sahara Logistics", region: "Tripoli", category: "Services", recommends: 210, complains: 55, isShielded: true, source: "Google", logs: [] },
];

const BusinessDataContext = createContext();

export function BusinessDataProvider({ children }) {
    const { user, supabase, lang } = useAuth();

    const [businesses, setBusinesses] = useState(
        (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') ? INITIAL_BUSINESSES : []
    );

    useEffect(() => {
        const fetchBusinesses = async () => {
            if (!supabase) return;
            try {
                const ADMIN_ROLES = ['super_admin', 'admin', 'assistant_admin', 'support_agent'];
                const isAdmin = ADMIN_ROLES.includes(user?.role) || user?.userId === 'ADMIN-MOCK' || user?.isDevBypass;

                let query = supabase.from('businesses').select('*, logs(*), storefronts(slug, logo_url, status)').limit(200);
                if (!isAdmin) {
                    query = query.eq('status', 'published');
                }

                const { data, error } = await query;
                const { data: coupons } = await supabase.from('merchant_coupons').select('*').eq('status', 'active');

                let ribbonsMap = {};
                try {
                    const { data: ribbons } = await supabase
                        .from('business_ribbons')
                        .select('*')
                        .eq('is_active', true);
                    if (ribbons) {
                        ribbons.forEach(r => {
                            if (!r.expires_at || new Date(r.expires_at) > new Date()) {
                                if (!ribbonsMap[r.business_id]) ribbonsMap[r.business_id] = r;
                            }
                        });
                    }
                } catch (e) { /* safe to ignore */ }

                if (error) {
                    console.warn('Supabase fetch failed, falling back to mock data.', error);
                    return;
                }
                if (data) {
                    const formattedData = data.map(b => {
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
                                    trust_points: log.trust_points || null,
                                    is_verified: log.is_verified || false,
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
                console.error(err);
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
                                return {
                                    ...b,
                                    logs: [
                                        {
                                            id: newLog.id,
                                            type: newLog.interaction_type,
                                            text: newLog.reason_text || (newLog.interaction_type === 'recommend' ? 'User recommended' : 'User complained'),
                                            date: new Date(newLog.created_at).toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en-US'),
                                            trust_points: newLog.trust_points || null,
                                            is_verified: newLog.is_verified || false,
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
        <BusinessDataContext.Provider value={{ businesses, setBusinesses }}>
            {children}
        </BusinessDataContext.Provider>
    );
}

export const useBusinessData = () => useContext(BusinessDataContext);
