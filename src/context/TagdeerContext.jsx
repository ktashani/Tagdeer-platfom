'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { translations } from '../i18n/translations';

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

const TagdeerContext = createContext();

export function TagdeerProvider({ children }) {
    const [lang, setLang] = useState('ar');
    const t = (key) => translations[lang]?.[key] || key;
    const isRTL = lang === 'ar';

    const [businesses, setBusinesses] = useState(INITIAL_BUSINESSES);
    const { supabase } = useSupabase();

    const [anonInteractions, setAnonInteractions] = useState(0);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    const [voteModal, setVoteModal] = useState({ isOpen: false, businessId: null, type: null });
    const [voteReason, setVoteReason] = useState('');

    const [showVerifySoonModal, setShowVerifySoonModal] = useState(false);
    const [showPreRegModal, setShowPreRegModal] = useState(false);

    // Mock Authentication State
    const [user, setUser] = useState(null);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const login = (phone) => {
        // Generate a mock VIP userId for QR Code security
        const randomAlphanumeric = Math.random().toString(36).substring(2, 7).toUpperCase();
        const mockUserId = `VIP-${randomAlphanumeric}`;

        setUser({ phone, userId: mockUserId, gader: 50, vipTier: 'Bronze Tier' });
        setShowLoginModal(false);
        showToast(t('login_success') || 'Successfully logged in');
    };

    const logout = () => {
        setUser(null);
        showToast(t('logout_success') || 'Successfully logged out');
    };

    useEffect(() => {
        const fetchBusinesses = async () => {
            if (!supabase) return;
            try {
                const { data, error } = await supabase
                    .from('businesses')
                    .select('*, interactions(*)');

                if (error) {
                    console.warn('Supabase fetch failed, falling back to mock data.', error);
                    return;
                }
                if (data) {
                    const formattedData = data.map(b => {
                        const rawInteractions = b.interactions || [];
                        const derivedRecommends = rawInteractions.filter(i => i.interaction_type === 'recommend').length;
                        const derivedComplains = rawInteractions.filter(i => i.interaction_type === 'complain').length;

                        return {
                            id: b.id,
                            name: b.name,
                            region: b.region,
                            category: b.category,
                            recommends: derivedRecommends,
                            complains: derivedComplains,
                            isShielded: b.is_shielded,
                            source: b.source,
                            external_url: b.external_url,
                            logs: rawInteractions
                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                .map(log => ({
                                    id: log.id,
                                    type: log.interaction_type,
                                    text: log.reason_text || (log.interaction_type === 'recommend' ? 'User recommended' : 'User complained'),
                                    date: new Date(log.created_at).toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en-US'),
                                    trust_points: log.trust_points || null,
                                    is_verified: log.is_verified || false
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
    }, [supabase, lang]);

    useEffect(() => {
        const storedInteractions = localStorage.getItem('trust_ledger_interactions');
        if (storedInteractions) setAnonInteractions(parseInt(storedInteractions));
    }, []);

    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 4000);
    };

    return (
        <TagdeerContext.Provider value={{
            lang, setLang, t, isRTL,
            businesses, setBusinesses,
            supabase,
            anonInteractions, setAnonInteractions,
            showLimitModal, setShowLimitModal,
            toastMessage, setToastMessage, showToast,
            voteModal, setVoteModal,
            voteReason, setVoteReason,
            showVerifySoonModal, setShowVerifySoonModal,
            showPreRegModal, setShowPreRegModal,
            user, setUser, showLoginModal, setShowLoginModal, login, logout
        }}>
            {children}
        </TagdeerContext.Provider>
    );
}

export const useTagdeer = () => useContext(TagdeerContext);
