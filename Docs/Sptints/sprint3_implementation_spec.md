# Sprint 3 — Architecture & Scalability: File-by-File Implementation Specification

**Date:** 2026-03-11
**Author:** Lead Systems Architect
**Sprint Duration:** Week 5-6
**Dependencies:** Sprint 2 (committed at `bfb84d0`) must be deployed first.
**Scope:** 5 tasks — ARCH-01, ARCH-02, ARCH-03, ARCH-04, INFRA-03

---

## Table of Contents

1. [TASK 1: ARCH-01 — TagdeerContext God Component Refactor (5 new + 2 modify)](#task-1-arch-01--tagdeercontext-god-component-refactor)
2. [TASK 2: ARCH-02 — Business Listing Pagination (SQL + 2 files)](#task-2-arch-02--business-listing-pagination)
3. [TASK 3: ARCH-03 — Consumer Discover Page SSR/SEO (2 files)](#task-3-arch-03--consumer-discover-page-ssrseo)
4. [TASK 4: ARCH-04 — Migration Squash + CI Guard (shell + 1 new file)](#task-4-arch-04--migration-squash--ci-guard)
5. [TASK 5: INFRA-03 — Root Test File Cleanup (delete + .gitignore)](#task-5-infra-03--root-test-file-cleanup)
6. [Verification Plan](#verification-plan)

---

## Critical Rules for the Implementer

1. **Do NOT rename, delete, or reorganize** any file not explicitly listed in the task.
2. **Preserve all existing behavior** — every existing import, response shape, and status code must remain unchanged unless the task explicitly says otherwise.
3. **Do NOT run any `git` commands.** Write code only.
4. **Do NOT add placeholder comments** like `// ... existing code`. Write the complete, functional file content for every modification.
5. **Execute tasks in order.** TASK 2 depends on TASK 1. TASK 3 depends on TASK 2.
6. **The `useTagdeer()` hook must continue to work identically** from all 44+ consumer files. The refactor is internal — the public API (exported values from `useTagdeer()`) must not change.

---

## TASK 1: ARCH-01 — TagdeerContext God Component Refactor

**Root Cause:** `TagdeerContext.jsx` is 757 lines mixing authentication (lines 94-518), business data fetching (lines 520-692), UI state (lines 85-93, 731-734), gamification helpers (lines 8-33), and platform config (line 74). Changes to any concern re-render the entire tree.

**Fix strategy:** Split into 3 focused context providers + a thin compatibility shim. The `useTagdeer()` hook continues to export the same combined object so **zero consumer files need changes**.

**Affected files:**
- `src/context/providers/AuthProvider.jsx` — **NEW**
- `src/context/providers/BusinessDataProvider.jsx` — **NEW**
- `src/context/providers/UIProvider.jsx` — **NEW**
- `src/context/TagdeerContext.jsx` — **MODIFY** (replace 757 lines with ~80-line shim)
- `src/context/TagdeerContext.test.jsx` — **MODIFY** (update imports)

---

### TASK 1A: New File `src/context/providers/AuthProvider.jsx`

**File:** `src/context/providers/AuthProvider.jsx` — **NEW**

This provider owns: `user`, `setUser`, `loading`, `showLoginModal`, `setShowLoginModal`, `login`, `loginWithOtp`, `loginWithEmail`, `verifyEmailOtp`, `loginWithPassword`, `setMerchantPassword`, `logout`, `syncUserProfile`.

```jsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSupabase } from '../../hooks/useSupabase';
import { usePlatformConfig } from '../../hooks/usePlatformConfig';
import { translations } from '../../i18n/translations';
import { calculateTier, getRandomCommunityTitle } from '../helpers/gamification';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const { supabase } = useSupabase();
    const platformConfig = usePlatformConfig();
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

    // Authentication State
    const [user, setUser] = useState(undefined);
    const [loading, setLoading] = useState(true);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // Toast (needed by auth methods — shared via context)
    const [toastMessage, setToastMessage] = useState('');
    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 4000);
    };

    // ── Session Sync ──
    useEffect(() => {
        if (!supabase) return;

        const checkInitialSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                await syncUserProfile(session.user);
            } else {
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

    const syncUserProfile = async (supabaseUser) => {
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', supabaseUser.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Sync Profile Error (Postgrest):", error);
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
                status: profile?.status || 'Active',
                has_password: profile?.has_password || false,
                weekly_log_count: profile?.weekly_log_count || 0,
                coupon_difficulty_level: profile?.coupon_difficulty_level || 0,
                isDevBypass: false
            };

            setUser(userObj);
            localStorage.setItem('tagdeer-user', JSON.stringify(userObj));
        } catch (err) {
            console.error("Exception syncing profile:", err);
            if (err.name === 'AbortError') {
                console.warn("Profile sync aborted (likely due to lock/steal).");
            }
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

    // Persist user to localStorage
    useEffect(() => {
        if (user) {
            localStorage.setItem('tagdeer-user', JSON.stringify(user));
        } else {
            localStorage.removeItem('tagdeer-user');
        }
    }, [user]);

    // ── Login Methods ──
    // Copy lines 199-518 from current TagdeerContext.jsx EXACTLY:
    // login, loginWithOtp, loginWithEmail, verifyEmailOtp, loginWithPassword,
    // setMerchantPassword, logout — all referencing the local `supabase`,
    // `setUser`, `showToast`, `lang`, `t`, `platformConfig` variables.
    // Do NOT change any logic. Only move the functions here.

    const login = async (phone) => {
        const isDevEnv = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
        if (isDevEnv && phone === '+218999999999') {
            setUser({
                phone,
                userId: 'VIP-E2ETST',
                gader: 20,
                vipTier: calculateTier(20, lang, platformConfig?.vipThresholds).name,
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
                let { data: profile, error: selectErr } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('phone', phone)
                    .single();

                if (selectErr && selectErr.code !== 'PGRST116') {
                    console.error("Error fetching profile:", selectErr);
                    showToast(t('prereg_error') || 'Error fetching profile');
                    return;
                }

                if (!profile) {
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

                setUser({
                    id: profile.id,
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
                    weekly_log_count: profile.weekly_log_count || 0,
                    coupon_difficulty_level: profile.coupon_difficulty_level || 0,
                    isDevBypass: process.env.NODE_ENV === 'development',
                });
                setShowLoginModal(false);
                showToast(t('login_success') || 'Successfully logged in');

            } catch (err) {
                console.error("Login exception:", err);
                showToast("Connection failed.");
            }
        } else {
            const randomAlphanumeric = Math.random().toString(36).substring(2, 7).toUpperCase();
            const mockUserId = `VIP-${randomAlphanumeric}`;
            setUser({ phone, userId: mockUserId, gader: 20, vipTier: 'Bronze', id: 'mock-uuid', isDevBypass: true });
            setShowLoginModal(false);
            showToast(t('login_success') || 'Successfully logged in (Offline)');
        }
    };

    const loginWithOtp = async (phone, token) => {
        if (!supabase) {
            const randomAlphanumeric = Math.random().toString(36).substring(2, 7).toUpperCase();
            setUser({
                phone,
                userId: `VIP-${randomAlphanumeric}`,
                gader: 20,
                vipTier: calculateTier(20, lang, platformConfig?.vipThresholds).name,
                full_name: getRandomCommunityTitle(lang),
                avatarUrl: '/avatars/default.png',
                id: 'mock-uuid'
            });
            setShowLoginModal(false);
            showToast(lang === 'ar' ? 'مرحباً بك في تقدير! حصلت على +20 نقطة' : 'Welcome to Tagdeer! You earned +20 points!');
            return;
        }

        const isDevEnv = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
        if (isDevEnv && token === '999999') {
            await login(phone);
            return;
        }

        const { data, error: functionError } = await supabase.functions.invoke('whatsapp-otp-verify', {
            body: { phone, code: token }
        });

        if (functionError || !data || data.error) {
            console.error("OTP Verification Error:", functionError || data?.error);
            throw new Error((data && data.error) || (lang === 'ar' ? 'رمز غير صحيح أو منتهي الصلاحية' : 'Invalid or expired code'));
        }

        const profile = data.profile;
        if (profile) {
            setUser({
                id: profile.id,
                phone: profile.phone,
                email: profile.email,
                profile_email: profile.email,
                userId: profile.user_id,
                gader: profile.gader_points ?? 20,
                vipTier: profile.vip_tier || calculateTier(profile.gader_points ?? 20, lang).name,
                full_name: profile.full_name || getRandomCommunityTitle(lang),
                city: profile.city,
                gender: profile.gender,
                birth_date: profile.birth_date,
                role: profile.role,
                weekly_log_count: profile.weekly_log_count || 0,
                coupon_difficulty_level: profile.coupon_difficulty_level || 0,
            });
            setShowLoginModal(false);

            if (data.isNewUser) {
                showToast(lang === 'ar' ? 'مرحباً بك في تقدير! حصلت على +20 نقطة مكافأة' : 'Welcome to Tagdeer! You earned +20 bonus points');
            } else {
                showToast(lang === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Successfully logged in');
            }
        } else {
            throw new Error(lang === 'ar' ? 'لم يتم العثور على الملف الشخصي' : 'Profile not found after verification');
        }
    };

    const loginWithEmail = async (email, redirectFrom, trialCampaign) => {
        if (!supabase) {
            showToast(lang === 'ar' ? 'فشل الاتصال بقاعدة البيانات' : 'Database connection failed');
            return;
        }

        try {
            const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
            let rootOrigin;
            if (envSiteUrl) {
                rootOrigin = envSiteUrl;
            } else {
                const hostname = window.location.hostname;
                const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1');
                rootOrigin = isLocalhost
                    ? window.location.origin
                    : window.location.protocol + '//' + hostname.replace(/^(admin|merchant|business)\./, '');
            }

            let callbackUrl = rootOrigin + '/auth/callback';
            const params = new URLSearchParams();
            if (redirectFrom) params.set('from', redirectFrom);
            if (trialCampaign) params.set('trial_campaign', trialCampaign);
            if (params.toString()) callbackUrl += '?' + params.toString();

            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: callbackUrl },
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
            const otpTypes = ['email', 'magiclink', 'signup'];
            let lastError = null;
            let resultData = null;

            for (const otpType of otpTypes) {
                try {
                    const { data, error } = await supabase.auth.verifyOtp({
                        email, token, type: otpType,
                    });

                    if (!error && data?.user) {
                        resultData = data;
                        lastError = null;
                        break;
                    }
                    if (error) lastError = error;
                } catch (e) {
                    lastError = e;
                }
            }

            if (lastError && !resultData) throw lastError;
            if (resultData?.user) return resultData.user;
        } catch (err) {
            console.error("OTP Verification Error:", err);
            showToast(err.message || (lang === 'ar' ? 'رمز غير صحيح أو منتهي الصلاحية' : 'Invalid or expired code'));
            throw err;
        }
    };

    const loginWithPassword = async (email, password) => {
        if (!supabase) {
            showToast(lang === 'ar' ? 'فشل الاتصال بقاعدة البيانات' : 'Database connection failed');
            throw new Error('No database connection');
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return data.user;
        } catch (err) {
            console.error('Password login error:', err);
            showToast(err.message || (lang === 'ar' ? 'فشل تسجيل الدخول' : 'Login failed'));
            throw err;
        }
    };

    const setMerchantPassword = async (password) => {
        if (!user?.email && !user?.profile_email) {
            throw new Error('No email found for this user. Please set an email first.');
        }

        const email = user.email || user.profile_email;

        try {
            const res = await fetch('/api/merchant/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to set password');

            setUser(prev => prev ? { ...prev, has_password: true } : prev);
            showToast(lang === 'ar' ? 'تم تعيين كلمة المرور بنجاح' : 'Password set successfully!');
        } catch (err) {
            console.error('Set password error:', err);
            throw err;
        }
    };

    const logout = async () => {
        if (supabase) {
            await supabase.auth.signOut().catch(() => { });
        }
        setUser(null);
        showToast(t('logout_success') || 'Successfully logged out');
    };

    return (
        <AuthContext.Provider value={{
            lang, setLang, t, isRTL,
            user, setUser, loading, showLoginModal, setShowLoginModal,
            login, loginWithOtp, loginWithEmail, verifyEmailOtp, loginWithPassword, setMerchantPassword, logout,
            supabase,
            toastMessage, setToastMessage, showToast,
            ...platformConfig
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
```

**Constraints:**
- Every login method must be **character-identical** to the current `TagdeerContext.jsx` logic.
- The `syncUserProfile` helper must produce the exact same `userObj` shape.
- `lang`, `setLang`, `t`, `isRTL` live here because auth methods depend on them.
- `showToast` lives here because login/logout methods call it. It is also re-exported so UIProvider does not duplicate it.

---

### TASK 1B: New File `src/context/providers/BusinessDataProvider.jsx`

**File:** `src/context/providers/BusinessDataProvider.jsx` — **NEW**

This provider owns: `businesses`, `setBusinesses`, and the realtime subscription channels. It reads `user`, `supabase`, and `lang` from `AuthProvider`.

```jsx
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
        process.env.NODE_ENV === 'development' ? INITIAL_BUSINESSES : []
    );

    // ── Copy lines 520-692 from current TagdeerContext.jsx EXACTLY ──
    // The fetchBusinesses useEffect and both realtime channel subscriptions.
    // Replace references to context variables with the ones from useAuth().
    useEffect(() => {
        const fetchBusinesses = async () => {
            if (!supabase) return;
            try {
                const ADMIN_ROLES = ['super_admin', 'admin', 'assistant_admin', 'support_agent'];
                const isAdmin = ADMIN_ROLES.includes(user?.role) || user?.userId === 'ADMIN-MOCK' || user?.isDevBypass;

                let query = supabase.from('businesses').select('*, logs(*), storefronts(slug, logo_url, status)');
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
```

**Constraints:**
- The business data formatting and realtime subscription logic must be **identical** to the current implementation.
- The `useEffect` dependency array `[supabase, lang, user?.id, user?.role, user?.isDevBypass]` must remain the same.

---

### TASK 1C: New File `src/context/providers/UIProvider.jsx`

**File:** `src/context/providers/UIProvider.jsx` — **NEW**

This provider owns anonymous interaction tracking and modal state.

```jsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

const UIContext = createContext();

export function UIProvider({ children }) {
    const { supabase } = useAuth();

    const [anonInteractions, setAnonInteractions] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('trust_ledger_interactions');
            return stored ? parseInt(stored) : 0;
        }
        return 0;
    });

    const [showLimitModal, setShowLimitModal] = useState(false);
    const [voteModal, setVoteModal] = useState({ isOpen: false, businessId: null, type: null });
    const [voteReason, setVoteReason] = useState('');
    const [showVerifySoonModal, setShowVerifySoonModal] = useState(false);
    const [showPreRegModal, setShowPreRegModal] = useState(false);

    useEffect(() => {
        const storedInteractions = localStorage.getItem('trust_ledger_interactions');
        if (storedInteractions) setAnonInteractions(parseInt(storedInteractions));
    }, []);

    const refreshAnonInteractions = async () => {
        if (!supabase) return;
        const { getDeviceFingerprint } = await import('../../lib/fingerprint');
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

    return (
        <UIContext.Provider value={{
            anonInteractions, setAnonInteractions, refreshAnonInteractions,
            showLimitModal, setShowLimitModal,
            voteModal, setVoteModal,
            voteReason, setVoteReason,
            showVerifySoonModal, setShowVerifySoonModal,
            showPreRegModal, setShowPreRegModal,
        }}>
            {children}
        </UIContext.Provider>
    );
}

export const useUI = () => useContext(UIContext);
```

---

### TASK 1D: New File `src/context/helpers/gamification.js`

**File:** `src/context/helpers/gamification.js` — **NEW**

Extract the two pure helper functions so both providers can import them without circular deps.

```javascript
// --- Gamification Helpers ---
export const calculateTier = (points, lang, vipThresholds) => {
    const thresholds = vipThresholds || { guest: 20, bronze: 1000, silver: 5000, gold: 20000 };

    if (!points || points < thresholds.guest) return { name: lang === 'ar' ? 'ضيف' : 'Guest', emoji: '👤', color: 'text-slate-600', max: thresholds.guest };
    if (points < thresholds.bronze) return { name: lang === 'ar' ? 'برونزي' : 'Bronze', emoji: '🥉', color: 'text-amber-700', max: thresholds.bronze };
    if (points < thresholds.silver) return { name: lang === 'ar' ? 'فضي' : 'Silver', emoji: '🥈', color: 'text-slate-600', max: thresholds.silver };
    if (points < thresholds.gold) return { name: lang === 'ar' ? 'ذهبي' : 'Gold', emoji: '🥇', color: 'text-yellow-700', max: thresholds.gold };
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
```

---

### TASK 1E: Modify `src/context/TagdeerContext.jsx` — Compatibility Shim

**Replace entire file with:**

```jsx
'use client';

import React, { createContext, useContext } from 'react';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { BusinessDataProvider, useBusinessData } from './providers/BusinessDataProvider';
import { UIProvider, useUI } from './providers/UIProvider';

// Re-export gamification helpers for backward compatibility
export { calculateTier, getRandomCommunityTitle } from './helpers/gamification';

const TagdeerContext = createContext();

/**
 * Compatibility shim: combines all three providers into one context
 * so that all 44+ consumer files can continue using `useTagdeer()`
 * without any changes.
 */
function TagdeerBridge({ children }) {
    const auth = useAuth();
    const businessData = useBusinessData();
    const ui = useUI();

    return (
        <TagdeerContext.Provider value={{
            ...auth,
            ...businessData,
            ...ui,
        }}>
            {children}
        </TagdeerContext.Provider>
    );
}

export function TagdeerProvider({ children }) {
    return (
        <AuthProvider>
            <BusinessDataProvider>
                <UIProvider>
                    <TagdeerBridge>
                        {children}
                    </TagdeerBridge>
                </UIProvider>
            </BusinessDataProvider>
        </AuthProvider>
    );
}

export const useTagdeer = () => useContext(TagdeerContext);
```

**Constraints:**
- `TagdeerProvider` and `useTagdeer` must remain the only two public exports (plus `calculateTier` and `getRandomCommunityTitle`).
- The spread order (`...auth`, `...businessData`, `...ui`) determines precedence — auth values take priority (matches current behavior since auth owns `supabase`, `lang`, etc.).
- **Zero consumer files need changes.** This is the critical constraint.

---

### TASK 1F: Modify `src/context/TagdeerContext.test.jsx`

**Replace the import mock and add a provider nesting test:**

**Current line 4:**
```javascript
import { TagdeerProvider, useTagdeer } from './TagdeerContext';
```

**No change needed** — the import path is the same. The test should continue to pass because `TagdeerProvider` still wraps everything.

**Add one new test at line 85 (before the closing `});`):**

```javascript
    it('provides all expected context keys from the bridge', () => {
        function KeyChecker() {
            const ctx = useTagdeer();
            const requiredKeys = [
                'lang', 'setLang', 't', 'isRTL',
                'businesses', 'setBusinesses',
                'supabase',
                'user', 'setUser', 'loading',
                'showLoginModal', 'setShowLoginModal',
                'login', 'loginWithOtp', 'loginWithEmail',
                'anonInteractions', 'setAnonInteractions',
                'showLimitModal', 'setShowLimitModal',
                'voteModal', 'setVoteModal',
                'toastMessage', 'showToast',
            ];
            const missingKeys = requiredKeys.filter(k => !(k in ctx));
            return <span data-testid="missing-keys">{missingKeys.join(',') || 'none'}</span>;
        }

        render(
            <TagdeerProvider>
                <KeyChecker />
            </TagdeerProvider>
        );

        expect(screen.getByTestId('missing-keys').textContent).toBe('none');
    });
```

---

## TASK 2: ARCH-02 — Business Listing Pagination

**Root Cause:** The current `select *` in `BusinessDataProvider` (originally in `TagdeerContext`) fetches ALL businesses with ALL logs on every page load. At ~500 businesses this crashes the page.

> [!IMPORTANT]
> **Design Decision:** We implement **client-side infinite scroll with server-side page-size limits** rather than full cursor-based pagination. The Discover page already has an `IntersectionObserver`-based infinite scroll (lines 111-120 of `discover/page.jsx`). We add a `LIMIT 200` cap on the initial fetch and defer the pagination RPC to a future sprint when business count exceeds 200. This minimizes risk while solving the immediate crash.

**Affected files:**
- `src/context/providers/BusinessDataProvider.jsx` — MODIFY (1 line change)

### TASK 2A: Modify `BusinessDataProvider.jsx`

**What to change:** Add `.limit(200)` to the businesses query.

**Find this line in the `fetchBusinesses` function:**
```javascript
                let query = supabase.from('businesses').select('*, logs(*), storefronts(slug, logo_url, status)');
```

**Replace with:**
```javascript
                let query = supabase.from('businesses').select('*, logs(*), storefronts(slug, logo_url, status)').limit(200);
```

**Constraints:**
- Do NOT change the `select` columns.
- Do NOT change the admin bypass logic.
- The client-side `PAGE_SIZE = 12` infinite scroll in `discover/page.jsx` remains unchanged.

---

## TASK 3: ARCH-03 — Consumer Discover Page SSR/SEO

**Root Cause:** `discover/page.jsx` starts with `'use client'`, making it invisible to search engines. Google cannot index any business listings.

> [!IMPORTANT]
> **Design Decision:** The `b/[slug]/page.jsx` storefront page is **already SSR** (no `'use client'`). The Discover page cannot be trivially converted to SSR because it deeply depends on `useTagdeer()` for realtime data, auth state, voting modals, and interactive filters. Instead, we add **static SEO metadata** and a **server-rendered `<noscript>` fallback** with a plain business list for crawlers. This gives us SEO without breaking the interactive UI.

**Affected files:**
- `src/app/(consumer)/discover/layout.jsx` — **NEW**
- `src/app/(consumer)/discover/page.jsx` — MODIFY (add 1 line)

### TASK 3A: New File `src/app/(consumer)/discover/layout.jsx`

**File:** `src/app/(consumer)/discover/layout.jsx` — **NEW**

This is a server component that provides metadata and a `<noscript>` fallback.

```jsx
import { createClient } from '@supabase/supabase-js';

export const metadata = {
    title: 'Discover Businesses — Tagdeer تقدير',
    description: 'Find and review trusted businesses in Tripoli, Benghazi, and across Libya. Read real community reviews and share your experience on Tagdeer.',
    openGraph: {
        title: 'Discover Businesses — Tagdeer',
        description: 'Find and review trusted businesses across Libya.',
        type: 'website',
    },
};

// ISR: Revalidate every 5 minutes for SEO crawlers
export const revalidate = 300;

async function getBusinessesForSEO() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return [];

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await supabase
        .from('businesses')
        .select('id, name, region, category, recommends, complains, storefronts(slug)')
        .eq('status', 'published')
        .order('recommends', { ascending: false })
        .limit(50);

    return data || [];
}

export default async function DiscoverLayout({ children }) {
    const businesses = await getBusinessesForSEO();

    return (
        <>
            {children}
            {/* SEO fallback for crawlers that don't execute JavaScript */}
            <noscript>
                <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
                    <h1>Discover Businesses on Tagdeer</h1>
                    <p>Community-verified business reviews in Libya</p>
                    <ul>
                        {businesses.map(b => {
                            const slug = Array.isArray(b.storefronts) && b.storefronts[0]?.slug;
                            return (
                                <li key={b.id}>
                                    {slug ? (
                                        <a href={`/b/${slug}`}>{b.name}</a>
                                    ) : (
                                        <span>{b.name}</span>
                                    )}
                                    {' — '}{b.category}, {b.region}
                                    {' ('}{b.recommends || 0}{' recommends, '}{b.complains || 0}{' complains)'}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </noscript>
        </>
    );
}
```

### TASK 3B: Modify `src/app/(consumer)/discover/page.jsx`

**No changes to the existing code.** The page continues to work as a `'use client'` component. The new `layout.jsx` wraps it with SEO metadata and the noscript fallback.

**Constraints:**
- Do NOT remove `'use client'` from `page.jsx`.
- Do NOT modify any of the 684 lines in `page.jsx`.
- The layout metadata is automatically merged by Next.js App Router.

---

## TASK 4: ARCH-04 — Migration Squash + CI Guard

**Root Cause:** 67 migrations with no squashing creates onboarding friction and increases risk of schema drift.

> [!WARNING]
> **Migration squashing is a destructive operation.** This task only creates tooling and documentation. The actual squash must be performed by the Lead Architect on a clean staging environment, NOT by the junior developer.

**Affected files:**
- `scripts/squash-migrations.sh` — **NEW** (documentation script)
- `supabase/migrations/README.md` — **NEW**

### TASK 4A: New File `scripts/squash-migrations.sh`

```bash
#!/bin/bash
# ============================================================
# Migration Squash Script — TO BE RUN BY LEAD ARCHITECT ONLY
# This script is documentation, not automation.
# ============================================================

set -euo pipefail

echo "⚠️  This script squashes all migrations into a single baseline."
echo "    Run this ONLY on a clean staging environment."
echo "    Press Ctrl+C to abort, or Enter to continue."
read

# Step 1: Generate current schema snapshot
echo "📸 Dumping current schema..."
supabase db dump --local > supabase/migrations/00000000000000_baseline.sql

# Step 2: Archive old migrations
echo "📦 Archiving old migrations..."
mkdir -p supabase/migrations/_archive
for f in supabase/migrations/202*.sql; do
    [ "$f" = "supabase/migrations/00000000000000_baseline.sql" ] && continue
    mv "$f" supabase/migrations/_archive/
done

# Step 3: Verify
echo "🧪 Testing schema from baseline..."
supabase db reset

echo "✅ Squash complete. Verify the schema, then commit."
```

### TASK 4B: New File `supabase/migrations/README.md`

```markdown
# Supabase Migrations

## Current State
- **67 migrations** accumulated from initial development through Sprint 2.
- All migrations are idempotent where possible (using `IF NOT EXISTS`, `CREATE OR REPLACE`).

## Squash Policy
When migration count exceeds 80, the Lead Architect will run `scripts/squash-migrations.sh` to consolidate into a baseline.

## Rules for New Migrations
1. **Naming:** `YYYYMMDD_short_description.sql` (e.g., `20260311_gader_points_atomic.sql`)
2. **Idempotency:** Use `CREATE OR REPLACE` for functions, `IF NOT EXISTS` for tables/indexes.
3. **Testing:** Run `supabase db reset` locally before submitting.
4. **Never modify** an existing migration that has been deployed to staging/production.
```

---

## TASK 5: INFRA-03 — Root Test File Cleanup

**Root Cause:** 23 debugging scripts (`test_*.js`, `test_*.mjs`, `kill_locks.js`) clutter the project root. They contain hardcoded credentials and connection strings.

**Affected files:**
- 23 files to **DELETE** (listed below)
- `.gitignore` — **MODIFY**

### TASK 5A: Delete Root Test Files

**Delete the following 23 files:**

```
test_anon.js
test_anon_cjs.js
test_anon_lock.js
test_anon_lock3.js
test_anon_lock4.js
test_anon_lock_correct.js
test_auth_rls.js
test_biz_fetch.js
test_db_search.js
test_r2.js
test_rls.mjs
test_rls2.mjs
test_sql.mjs
test_sql2.mjs
test_sql3.mjs
test_sql4.js
test_supabase.js
test_supabase2.js
test_supabase3.js
test_upsert.js
test_upsert2.js
test_upsert_correct.js
kill_locks.js
```

### TASK 5B: Modify `.gitignore`

**Append the following lines at the end of the file:**

```gitignore

# Debug/test scripts (prevent future accumulation)
test_*.js
test_*.mjs
kill_locks.js
```

**Constraints:**
- Do NOT modify any existing lines in `.gitignore`.
- Only append at the end.

---

## Verification Plan

### Automated Tests

**Context Refactor (TASK 1) — run with vitest:**

```bash
cd /Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom
npx vitest run src/context/TagdeerContext.test.jsx
```

This test covers:
- Default state (no user logged in)
- Offline login flow (VIP-XXXXX userId generation)
- Business data availability from mock data
- **NEW:** All required context keys present in the bridge

### Build Verification

```bash
cd /Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom
npm run build
```

The build must exit with code 0. All consumer pages, portal pages, and API routes must compile without errors.

### Manual Verification (Post-Deploy)

**1. Context Refactor (TASK 1):**
- Navigate to `/discover` — verify businesses load, voting works, toasts appear.
- Log in via WhatsApp OTP — verify user state persists across page navigation.
- Navigate to `/profile` — verify user data displays correctly.
- Open merchant portal — verify login, dashboard, and coupon features still work.

**2. Business Limit (TASK 2):**
- Verify the Discover page loads max 200 businesses (check Network tab → Supabase request).

**3. SEO (TASK 3):**
- View source of `/discover` — confirm `<title>` and `<meta>` tags are present.
- Disable JavaScript in browser — confirm the `<noscript>` business list renders.

**4. Root Cleanup (TASK 5):**
- Verify `ls test_*.js test_*.mjs kill_locks.js 2>/dev/null` returns empty.
- Verify `git status` shows the deletions.
