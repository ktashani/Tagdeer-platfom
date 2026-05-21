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

    // ── Phase 1: Session Sync (SYNCHRONOUS — no database calls) ──
    // CRITICAL: The @supabase/ssr client holds an internal auth lock while the
    // onAuthStateChange callback executes. Any Supabase database query inside
    // here would internally call getSession() to attach the Bearer token,
    // which needs the same lock → permanent deadlock.
    // Solution: Extract user from the session JWT synchronously, set loading=false,
    // then fetch the full profile in Phase 2 (separate useEffect).
    useEffect(() => {
        if (!supabase) return;

        const handleAuthChange = (event, session) => {
            console.log('Supabase Auth Event:', event, session?.user?.email);

            if (session?.user) {
                const su = session.user;
                setUser(prev => {
                    // Don't overwrite an already-enriched profile with minimal data
                    if (prev?.id === su.id && prev?.gader !== undefined) return prev;
                    return {
                        id: su.id,
                        email: su.email,
                        phone: su.phone,
                        role: prev?.id === su.id ? (prev?.role || 'consumer') : 'consumer',
                        full_name: prev?.id === su.id ? (prev?.full_name || su.email?.split('@')[0] || 'User') : (su.email?.split('@')[0] || 'User'),
                        isDevBypass: false,
                    };
                });
                setLoading(false);
            } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
                // SIGNED_OUT or INITIAL_SESSION with no session = not logged in
                setUser(null);
                localStorage.removeItem('tagdeer-user');
                setLoading(false);
            }
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

        // Safety: if no auth event fires within 5s, force-resolve loading
        const safetyTimer = setTimeout(() => {
            setLoading(prev => {
                if (prev) {
                    console.warn('[AuthProvider] No auth event within 5s — forcing loading=false');
                    return false;
                }
                return prev;
            });
        }, 5000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(safetyTimer);
        };
    }, [supabase]);

    // ── Phase 2: Profile Enrichment (ASYNC — runs after auth lock releases) ──
    // This fires when Phase 1 sets user.id. By this time the onAuthStateChange
    // callback has returned and the auth lock is released, so database queries
    // can safely call getSession() internally.
    useEffect(() => {
        if (!supabase || !user?.id) return;
        // Skip if profile is already enriched (has gader data from a previous fetch)
        if (user.gader !== undefined) return;

        let cancelled = false;

        const enrichProfile = async () => {
            try {
                console.log('[AuthProvider] Phase 2: enriching profile for', user.id.substring(0, 8) + '...');
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (cancelled) return;

                if (error && error.code !== 'PGRST116') {
                    console.error('Profile enrichment error:', error);
                }

                if (profile) {
                    setUser(prev => {
                        if (!prev || prev.id !== profile.id) return prev;
                        const enriched = {
                            ...prev,
                            // Sanitize phone: reject string "NULL", empty strings, and too-short values
                            phone: (() => {
                                const p = profile.phone || prev.phone;
                                if (!p || p === 'NULL' || p === 'null' || p === 'undefined' || p.trim() === '' || p.includes('@') || p.trim().length < 8) return null;
                                return p;
                            })(),
                            userId: profile.user_id || `AUTH-${prev.id.substring(0, 5).toUpperCase()}`,
                            gader: profile.gader_points || 0,
                            vipTier: profile.vip_tier || calculateTier(profile.gader_points || 0, lang, platformConfig?.vipThresholds).name,
                            full_name: profile.full_name || prev.email?.split('@')[0] || 'Tagdeer User',
                            role: profile.role || 'consumer',
                            status: profile.status || 'Active',
                            has_password: profile.has_password || false,
                            // STRICT: phone_verified is ONLY true when DB says true AND phone is a real number
                            phone_verified: profile.phone_verified === true && !!profile.phone && profile.phone !== 'NULL' && profile.phone !== 'null' && profile.phone.trim().length >= 8,
                            weekly_log_count: profile.weekly_log_count || 0,
                            coupon_difficulty_level: profile.coupon_difficulty_level || 0,
                            // Milestone tracking
                            unique_businesses_count: profile.unique_businesses_count || 0,
                            current_streak: profile.current_streak || 0,
                            longest_streak: profile.longest_streak || 0,
                            milestones_completed: profile.milestones_completed || {},
                            // Profile extras
                            avatarUrl: profile.avatar_url || prev.avatarUrl,
                            city: profile.city,
                            gender: profile.gender,
                            birth_date: profile.birth_date,
                            profile_email: profile.email || prev.email,
                        };
                        localStorage.setItem('tagdeer-user', JSON.stringify(enriched));
                        return enriched;
                    });
                } else {
                    // No profile row — mark as enriched with defaults so we don't re-fetch
                    setUser(prev => prev ? { ...prev, gader: 0, vipTier: calculateTier(0, lang, platformConfig?.vipThresholds).name } : prev);
                }
            } catch (err) {
                console.error('Profile enrichment exception:', err);
                // Mark as enriched with defaults to prevent infinite re-fetch loop
                if (!cancelled) {
                    setUser(prev => prev ? { ...prev, gader: 0, vipTier: calculateTier(0, lang, platformConfig?.vipThresholds).name } : prev);
                }
            }
        };

        enrichProfile();
        return () => { cancelled = true; };
    }, [supabase, user?.id, user?.gader]);

    // Persist user to localStorage
    useEffect(() => {
        if (user) {
            localStorage.setItem('tagdeer-user', JSON.stringify(user));
        } else {
            localStorage.removeItem('tagdeer-user');
        }
    }, [user]);

    // ── Login Methods ──
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
