'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { translations } from '../i18n/translations';
import { createClient } from '@supabase/supabase-js';

// --- Gamification Helpers ---
export const calculateTier = (points, lang) => {
    if (!points || points < 20) return { name: lang === 'ar' ? 'ضيف' : 'Guest', emoji: '👤', color: 'text-slate-600', max: 20 };
    if (points < 1000) return { name: lang === 'ar' ? 'برونزي' : 'Bronze', emoji: '🥉', color: 'text-amber-700', max: 1000 };
    if (points < 5000) return { name: lang === 'ar' ? 'فضي' : 'Silver', emoji: '🥈', color: 'text-slate-600', max: 5000 };
    if (points < 20000) return { name: lang === 'ar' ? 'ذهبي' : 'Gold', emoji: '🥇', color: 'text-yellow-700', max: 20000 };
    return { name: 'VIP', emoji: '💎', color: 'text-indigo-700', max: Infinity };
};

export const getRandomCommunityTitle = (lang) => {
    const titles = lang === 'ar' ? [
        'كريم التقدير', 'ولد البلاد', 'بنت البلاد', 'البوصلة', 'الميزان',
        'مدمر البرجر', 'راعي المزاج', 'قناص الشاورما', 'الذوّاق',
        'وحش السوق', 'صياد اللقطات', 'مفتش الجودة',
        'من الأخير', 'كاشف المستور', 'فزّاع المجتمع'
    ] : [
        'The Generous', 'Local Expert', 'The Compass', 'The Fair Judge',
        'Burger Smasher', 'The Vibe Checker', 'Shawarma Sniper', 'Fine Diner',
        'Shopping Monster', 'Deal Hunter', 'Quality Inspector',
        'The Bottom Liner', 'The Myth Buster', 'The Volunteer'
    ];
    return titles[Math.floor(Math.random() * titles.length)];
};
// ----------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

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

    // Authentication State — starts as undefined (loading/SSR-safe)
    const [user, setUser] = useState(undefined);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // Restore user from localStorage on client mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem('tagdeer-user');
            if (stored) {
                setUser(JSON.parse(stored));
            } else {
                setUser(null); // Explicitly no user found
            }
        } catch {
            setUser(null);
        }
    }, []);

    // Persist user state to localStorage whenever it changes
    useEffect(() => {
        if (user) {
            localStorage.setItem('tagdeer-user', JSON.stringify(user));
        } else {
            localStorage.removeItem('tagdeer-user');
        }
    }, [user]);

    const login = async (phone) => {
        // DEV BYPASS: completely bypass Supabase DB for the E2E test phone due to RLS blocks without Auth Session
        const isDevEnv = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
        if (isDevEnv && phone === '+218999999999') {
            setUser({
                phone,
                userId: 'VIP-E2ETST',
                gader: 20,
                vipTier: calculateTier(20, lang).name,
                full_name: getRandomCommunityTitle(lang),
                avatarUrl: '/avatars/default.png',
                id: 'mock-e2e-uuid',
                isDevBypass: true
            });
            setShowLoginModal(false);
            return;
        }

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
                            gader_points: 20,
                            vip_tier: 'Bronze'
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
                    email: profile.email,
                    profile_email: profile.email,
                    userId: profile.user_id,
                    gader: profile.gader_points,
                    vipTier: profile.vip_tier,
                    full_name: profile.full_name,
                    city: profile.city,
                    gender: profile.gender,
                    birth_date: profile.birth_date,
                    isDevBypass: process.env.NODE_ENV === 'development',
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
            setUser({ phone, userId: mockUserId, gader: 20, vipTier: 'Bronze', id: 'mock-uuid', isDevBypass: true });
            setShowLoginModal(false);
            showToast(t('login_success') || 'Successfully logged in (Offline)');
        }
    };

    const loginWithOtp = async (phone, token) => {
        if (!supabase) {
            // Offline fallback — mock login
            const randomAlphanumeric = Math.random().toString(36).substring(2, 7).toUpperCase();
            setUser({
                phone,
                userId: `VIP-${randomAlphanumeric}`,
                gader: 20,
                vipTier: calculateTier(20, lang).name,
                full_name: getRandomCommunityTitle(lang),
                avatarUrl: '/avatars/default.png',
                id: 'mock-uuid'
            });
            setShowLoginModal(false);
            showToast(lang === 'ar' ? 'مرحباً بك في تقدير! حصلت على +20 نقطة' : 'Welcome to Tagdeer! You earned +20 points!');
            return;
        }

        // DEV MODE BYPASS (works in development OR on localhost)
        const isDevEnv = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
        if (isDevEnv && token === '999999') {
            await login(phone);
            return;
        }

        // PRODUCTION/REAL MODE: Verify via Edge Function
        const { data, error: functionError } = await supabase.functions.invoke('whatsapp-otp-verify', {
            body: { phone, code: token }
        });

        if (functionError || !data || data.error) {
            console.error("OTP Verification Error:", functionError || data?.error);
            throw new Error((data && data.error) || (lang === 'ar' ? 'رمز غير صحيح أو منتهي الصلاحية' : 'Invalid or expired code'));
        }

        // Success! Set the user state based on the Edge Function's returned profile
        const fetchedPoints = data.profile.gader_points || 20; // Default to 20 if 0 or null
        const assignedTier = data.profile.vip_tier || calculateTier(fetchedPoints, lang).name;
        const assignedName = data.profile.full_name || getRandomCommunityTitle(lang);

        setUser({
            id: data.profile.id,
            phone: data.profile.phone,
            email: null, // Custom Edge Function doesn't currently attach Auth email
            profile_email: null,
            userId: data.profile.user_id,
            gader: fetchedPoints,
            vipTier: assignedTier,
            full_name: assignedName,
            avatarUrl: data.profile.avatar_url || '/avatars/default.png',
            city: data.profile.city,
            gender: data.profile.gender,
            birth_date: data.profile.birth_date,
            isDevBypass: false,
        });

        setShowLoginModal(false);

        if (data.isNewUser) {
            showToast(lang === 'ar' ? 'مرحباً بك في تقدير! حصلت على +20 نقطة مكافأة' : 'Welcome to Tagdeer! You earned +20 bonus points');
        } else {
            showToast(t('login_success') || 'Successfully logged in');
        }
    };

    const logout = async () => {
        if (supabase) {
            await supabase.auth.signOut().catch(() => { });
        }
        setUser(null); // useEffect will clear localStorage
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
                            recommends: b.recommends ?? derivedRecommends,
                            complains: b.complains ?? derivedComplains,
                            shadow_score: b.shadow_score,
                            display_score: b.display_score,
                            isShielded: b.is_shielded,
                            isClaimed: !!b.claimed_by,
                            shield_level: b.shield_level || 0,
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
                                isShielded: updatedBusiness.is_shielded,
                                shield_level: updatedBusiness.shield_level || 0,
                                recommends: updatedBusiness.recommends ?? b.recommends,
                                complains: updatedBusiness.complains ?? b.complains,
                                shadow_score: updatedBusiness.shadow_score,
                                display_score: updatedBusiness.display_score
                            }
                            : b
                    ));
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
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
