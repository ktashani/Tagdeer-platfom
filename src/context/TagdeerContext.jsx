'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { translations } from '../i18n/translations';

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
    const t = (key, fallbackOrVars) => {
        let txt = translations[lang]?.[key];
        if (!txt) return typeof fallbackOrVars === 'string' ? fallbackOrVars : key;
        if (typeof fallbackOrVars === 'object' && fallbackOrVars !== null) {
            Object.entries(fallbackOrVars).forEach(([k, v]) => {
                txt = txt.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
            });
        }
        return txt;
    };
    const isRTL = lang === 'ar';

    const [businesses, setBusinesses] = useState(INITIAL_BUSINESSES);
    const { supabase } = useSupabase();

    // Fix: Initialize directly from localStorage to prevent 0-reset race condition
    const [anonInteractions, setAnonInteractions] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('trust_ledger_interactions');
            return stored ? parseInt(stored) : 0;
        }
        return 0;
    });

    const [showLimitModal, setShowLimitModal] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    const [voteModal, setVoteModal] = useState({ isOpen: false, businessId: null, type: null });
    const [voteReason, setVoteReason] = useState('');

    const [showVerifySoonModal, setShowVerifySoonModal] = useState(false);
    const [showPreRegModal, setShowPreRegModal] = useState(false);

    // Authentication State — starts as undefined (loading/SSR-safe)
    const [user, setUser] = useState(undefined);
    const [loading, setLoading] = useState(true);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // Sync session and handle auth state changes
    useEffect(() => {
        if (!supabase) return;

        // 1. Initial Check: Try to restore session from Supabase SDK
        const checkInitialSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                await syncUserProfile(session.user);
            } else {
                // Background fallback: check localStorage for legacy/mock users
                try {
                    const stored = localStorage.getItem('tagdeer-user');
                    if (stored) setUser(JSON.parse(stored));
                    else setUser(null);
                } catch {
                    setUser(null);
                }
            }
            setLoading(false);
        };

        checkInitialSession();

        // 2. Auth State Listener: React to Magic Links, Logins, Logouts
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("Supabase Auth Event:", event, session?.user?.email);

            if (event === 'SIGNED_IN' && session) {
                await syncUserProfile(session.user);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                localStorage.removeItem('tagdeer-user');
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

    /**
     * Helper to fetch profile and update user state
     */
    const syncUserProfile = async (supabaseUser) => {
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', supabaseUser.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Sync Profile Error (Postgrest):", error);
                // Also log as a string just in case it's not a standard object
                console.error("Sync Profile Error Details:", JSON.stringify(error));
            }

            const userObj = {
                id: supabaseUser.id,
                email: supabaseUser.email,
                phone: profile?.phone || supabaseUser.phone,
                userId: profile?.user_id || `AUTH-${supabaseUser.id.substring(0, 5).toUpperCase()}`,
                gader: profile?.gader_points || 0,
                vipTier: profile?.vip_tier || 'Bronze',
                full_name: profile?.full_name || supabaseUser.email?.split('@')[0] || 'Tagdeer User',
                role: profile?.role || 'consumer',
                isDevBypass: false
            };

            setUser(userObj);
            localStorage.setItem('tagdeer-user', JSON.stringify(userObj));
        } catch (err) {
            console.error("Exception syncing profile:", err);
            if (err.name === 'AbortError') {
                console.warn("Profile sync aborted (likely due to lock/steal).");
            }
            // Fallback: at least allow access as a basic consumer if they have a session
            const fallbackUser = {
                id: supabaseUser.id,
                email: supabaseUser.email,
                role: 'consumer'
            };
            setUser(fallbackUser);
        } finally {
            setLoading(false);
        }
    };

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
                    role: profile.role,
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

        if (data.isNewUser) {
            showToast(lang === 'ar' ? 'مرحباً بك في تقدير! حصلت على +20 نقطة مكافأة' : 'Welcome to Tagdeer! You earned +20 bonus points');
        }
        // Note: setUser is now handled by the onAuthStateChange listener
    };

    const loginWithEmail = async (email) => {
        if (!supabase) {
            showToast(lang === 'ar' ? 'فشل الاتصال بقاعدة البيانات' : 'Database connection failed');
            return;
        }

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin + '/merchant/dashboard',
                },
            });

            if (error) throw error;
            showToast(lang === 'ar' ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' : 'Verification code sent to your email');
        } catch (err) {
            console.error("Email login error:", err);
            showToast(err.message || "Failed to send OTP");
            throw err;
        }
    };

    const verifyEmailOtp = async (email, token) => {
        if (!supabase) return;

        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token,
                type: 'magiclink',
            });

            console.log("Supabase OTP Verify Result:", { data, error, email, token });

            if (error) throw error;

            if (data.user) {
                // Success! onAuthStateChange will handle syncing the profile
                return data.user;
            }
        } catch (err) {
            console.error("OTP Verification Error:", err);
            showToast(err.message || (lang === 'ar' ? 'رمز غير صحيح' : 'Invalid code'));
            throw err;
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
                            owner_id: b.claimed_by,
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
    }, [supabase, lang]);

    useEffect(() => {
        // Sync interactions count from storage on mount (secondary check)
        const storedInteractions = localStorage.getItem('trust_ledger_interactions');
        if (storedInteractions) setAnonInteractions(parseInt(storedInteractions));
    }, []);

    /**
     * Freshly sync anonymous interaction count from Supabase based on device fingerprint.
     * This strengthens the client-side localStorage count.
     */
    const refreshAnonInteractions = async () => {
        if (!supabase) return;

        // Dynamic import to avoid SSR issues if fingerprint lib uses navigator
        const { getDeviceFingerprint } = await import('../lib/fingerprint');
        const fingerprint = getDeviceFingerprint();

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        try {
            const { count, error } = await supabase
                .from('logs')
                .select('*', { count: 'exact', head: true })
                .eq('fingerprint', fingerprint)
                .gte('created_at', twentyFourHoursAgo);

            if (!error && count !== null) {
                setAnonInteractions(count);
                localStorage.setItem('trust_ledger_interactions', count.toString());
                return count;
            }
        } catch (e) {
            console.error("Failed to sync anon interactions:", e);
        }
        return anonInteractions;
    };

    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 4000);
    };

    return (
        <TagdeerContext.Provider value={{
            lang, setLang, t, isRTL,
            businesses, setBusinesses,
            supabase,
            anonInteractions, setAnonInteractions, refreshAnonInteractions,
            showLimitModal, setShowLimitModal,
            toastMessage, setToastMessage, showToast,
            voteModal, setVoteModal,
            voteReason, setVoteReason,
            showVerifySoonModal, setShowVerifySoonModal,
            showPreRegModal, setShowPreRegModal,
            user, setUser, loading, showLoginModal, setShowLoginModal, login, loginWithOtp, loginWithEmail, verifyEmailOtp, logout
        }}>
            {children}
        </TagdeerContext.Provider>
    );
}

export const useTagdeer = () => useContext(TagdeerContext);
