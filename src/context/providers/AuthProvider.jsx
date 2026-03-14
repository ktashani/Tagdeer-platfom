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
    // We rely solely on onAuthStateChange rather than getSession().
    // Reason: @supabase/ssr shares an internal auth lock between getSession()
    // and onAuthStateChange, causing a mutual deadlock on the SSR client.
    // The INITIAL_SESSION event provides the same session data synchronously
    // on subscription, without the lock contention.
    useEffect(() => {
        if (!supabase) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('Supabase Auth Event:', event, session?.user?.email);

                if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    if (session?.user) {
                        await syncUserProfile(session.user);
                    } else {
                        // No session — clear user state
                        setUser(null);
                        localStorage.removeItem('tagdeer-user');
                        setLoading(false);
                    }
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    localStorage.removeItem('tagdeer-user');
                    setLoading(false);
                }
            }
        );

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
