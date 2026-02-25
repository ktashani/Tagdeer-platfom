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

    const login = async (phone) => {
        // Temporary mock OTP bypass - we assume phone is verified here for MVP

        if (supabase) {
            try {
                // Check if profile exists
                let { data: profile, error: selectErr } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('phone', phone)
                    .single();

                if (selectErr && selectErr.code !== 'PGRST116') {
                    // Ignore "row not found" error code PGRST116, throw rest
                    console.error("Error fetching profile:", selectErr);
                    showToast(t('prereg_error') || 'Error fetching profile');
                    return;
                }

                if (!profile) {
                    // Create new profile with mock VIP userId
                    const randomAlphanumeric = Math.random().toString(36).substring(2, 7).toUpperCase();
                    const mockUserId = `VIP-${randomAlphanumeric}`;

                    const { data: newProfile, error: insertErr } = await supabase
                        .from('profiles')
                        .insert([{
                            phone,
                            user_id: mockUserId,
                            gader_points: 50,
                            vip_tier: 'Bronze Tier'
                        }])
                        .select()
                        .single();

                    if (insertErr) {
                        console.error("Error creating profile:", insertErr);
                        showToast(t('prereg_error') || 'Error creating profile');
                        return;
                    }
                    profile = newProfile;
                }

                // Set state using actual DB row
                setUser({
                    id: profile.id, // Actual UUID
                    phone: profile.phone,
                    userId: profile.user_id, // The VIP-XXXXX ID
                    gader: profile.gader_points,
                    vipTier: profile.vip_tier,
                    full_name: profile.full_name,
                    city: profile.city,
                    gender: profile.gender,
                    birth_date: profile.birth_date
                });
                setShowLoginModal(false);
                showToast(t('login_success') || 'Successfully logged in');

            } catch (err) {
                console.error("Login exception:", err);
                showToast("Connection failed.");
            }
        } else {
            // Fallback if supabase isn't connected
            const randomAlphanumeric = Math.random().toString(36).substring(2, 7).toUpperCase();
            const mockUserId = `VIP-${randomAlphanumeric}`;
            setUser({ phone, userId: mockUserId, gader: 50, vipTier: 'Bronze Tier', id: 'mock-uuid' });
            setShowLoginModal(false);
            showToast(t('login_success') || 'Successfully logged in (Offline)');
        }
    };

    const loginWithOtp = async (phone, token) => {
        if (!supabase) {
            // Offline fallback — mock login
            const randomAlphanumeric = Math.random().toString(36).substring(2, 7).toUpperCase();
            setUser({ phone, userId: `VIP-${randomAlphanumeric}`, gader: 500, vipTier: 'Bronze Tier', id: 'mock-uuid' });
            setShowLoginModal(false);
            showToast(lang === 'ar' ? 'مرحباً بك في تقدير! حصلت على +500 نقطة' : 'Welcome to Tagdeer! You earned +500 points!');
            return;
        }

        // Call the verify Edge Function
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-otp-verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ phone, code: token }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || (lang === 'ar' ? 'رمز غير صحيح' : 'Invalid verification code'));
        }

        // Set user state from Edge Function response
        const profile = data.profile;
        setUser({
            id: profile.id,
            phone: profile.phone,
            userId: profile.user_id,
            gader: profile.gader_points,
            vipTier: profile.vip_tier,
            full_name: profile.full_name,
            city: profile.city,
            gender: profile.gender,
            birth_date: profile.birth_date
        });
        setShowLoginModal(false);

        if (data.isNewUser) {
            showToast(lang === 'ar'
                ? 'مرحباً بك في تقدير! حصلت على +500 نقطة لتوثيق حسابك 🎉'
                : 'Welcome to Tagdeer! You earned +500 points for verifying your account! 🎉');
        } else {
            showToast(lang === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Successfully logged in');
        }
    };

    const logout = async () => {
        if (supabase) {
            await supabase.auth.signOut().catch(() => { });
        }
        setUser(null);
        showToast(t('logout_success') || 'Successfully logged out');
    };

    useEffect(() => {
        const fetchBusinesses = async () => {
            if (!supabase) return;
            try {
                const { data, error } = await supabase
                    .from('businesses')
                    .select('*, logs(*)');

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
                            recommends: derivedRecommends,
                            complains: derivedComplains,
                            isShielded: b.is_shielded,
                            source: b.source,
                            external_url: b.external_url,
                            logs: rawLogs
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
            user, setUser, showLoginModal, setShowLoginModal, login, loginWithOtp, logout
        }}>
            {children}
        </TagdeerContext.Provider>
    );
}

export const useTagdeer = () => useContext(TagdeerContext);
