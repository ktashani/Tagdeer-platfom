'use client';

import React, { useEffect, useState } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Mail, User, ShieldCheck, Phone, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Toast } from '@/components/Toast';

// Extracted components
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { LogHistory } from '@/components/profile/LogHistory';
import { GaderPassModal } from '@/components/profile/GaderPassModal';

export default function ProfilePage() {
    const { user, logout, t, isRTL, setShowLoginModal, lang } = useTagdeer();

    // Check if we are in a dev/localhost environment for safe bypasses
    const isDevEnv = process.env.NODE_ENV === 'development' ||
        (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('history');
    const [toastMessage, setToastMessage] = useState('');
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);

    // Personal Details State
    const [name, setName] = useState(user?.full_name || '');
    const [dob, setDob] = useState(user?.birth_date || '');
    const [city, setCity] = useState(user?.city || '');
    const [gender, setGender] = useState(user?.gender || '');
    const [isSaving, setIsSaving] = useState(false);

    // Real Log History State
    const [historyLogs, setHistoryLogs] = useState([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(true);

    // Sync state if user loads later
    useEffect(() => {
        if (user) {
            if (user.full_name) setName(user.full_name);
            if (user.birth_date) setDob(user.birth_date);
            if (user.city) setCity(user.city);
            if (user.gender) setGender(user.gender);
        }
    }, [user]);

    // Fetch real log history from Supabase
    useEffect(() => {
        const fetchLogs = async () => {
            if (!supabase || !user?.id) {
                setIsLoadingLogs(false);
                return;
            }

            // Skip Supabase queries for dev bypass users (no native auth session)
            if (isDevEnv && (user.id === 'mock-uuid' || user.isDevBypass)) {
                setIsLoadingLogs(false);
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('logs')
                    .select('*, businesses(name)')
                    .eq('profile_id', user.id)
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    setHistoryLogs(data.map(log => ({
                        id: log.id,
                        business: log.businesses?.name || 'Unknown Business',
                        date: log.created_at,
                        type: log.interaction_type,
                        text: log.reason_text || (log.interaction_type === 'recommend' ? 'Recommended' : 'Complained'),
                        weight: log.weight || 1.0,
                    })));
                }
            } catch (err) {
                console.error('Error fetching log history:', err);
            } finally {
                setIsLoadingLogs(false);
            }
        };
        fetchLogs();
    }, [user]);

    const handleSaveProfile = async () => {
        if (!user || !user.id || (isDevEnv && (user.id === 'mock-uuid' || user.isDevBypass))) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: name || null,
                    birth_date: dob ? dob : null,
                    city: city || null,
                    gender: gender || null,
                    email: email || null
                })
                .eq('id', user.id);

            if (error) {
                console.error("Error updating profile:");
                console.error("Message:", error.message);
                console.error("Details:", error.details);
                console.error("Hint:", error.hint);
                setToastMessage(t('prereg_error') || 'Failed to save profile. Please try again.');
            } else {
                setToastMessage(lang === 'ar' ? 'تم حفظ التغييرات' : 'Profile Updated');
            }
        } catch (err) {
            console.error("Exception saving profile:", err);
            setToastMessage('Connection Error.');
        } finally {
            setIsSaving(false);
            setTimeout(() => setToastMessage(''), 3000);
        }
    };

    // Derive a clean phone number (exclude emails that may leak into profile.phone)
    const safePhone = (user?.phone && !user.phone.includes('@')) ? user.phone : null;

    // Email state — read from DB profile_email first, then auth session fallback
    const savedEmail = user?.profile_email || null;
    const [email, setEmail] = useState(savedEmail || user?.email || '');
    const [emailStep, setEmailStep] = useState(savedEmail ? 'verified' : 'idle'); // idle, otp, saving, verified
    const [emailOtp, setEmailOtp] = useState('');
    const [emailError, setEmailError] = useState('');

    // Protect route
    useEffect(() => {
        if (user === undefined) return; // Still loading context
        if (user === null) {
            router.push('/');
            setTimeout(() => setShowLoginModal(true), 500); // Prompt them to login
        }
    }, [user, router, setShowLoginModal]);

    if (!user) {
        return (
            <div className="flex justify-center items-center h-[70vh]">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 bg-slate-200 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                </div>
            </div>
        );
    }

    // Use real logs, or an empty array to trigger the ghosted UI state
    const displayLogs = historyLogs || [];

    // Helper: Calculate Age from DOB
    const calculateAge = (dobString) => {
        if (!dobString) return '-';
        const birthday = new Date(dobString);
        const ageDifMs = Date.now() - birthday.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    // Helper: Gamification Progress matching /about thresholds
    const getProgressInfo = (points) => {
        let currentTier = "Guest";
        let nextTier = "Bronze";
        let maxPoints = 20;
        let p = points || 0;

        if (p >= 20 && p < 1000) {
            currentTier = "Bronze";
            nextTier = "Silver";
            maxPoints = 1000;
        } else if (p >= 1000 && p < 5000) {
            currentTier = "Silver";
            nextTier = "Gold";
            maxPoints = 5000;
        } else if (p >= 5000 && p < 20000) {
            currentTier = "Gold";
            nextTier = "VIP";
            maxPoints = 20000;
        } else if (p >= 20000) {
            currentTier = "VIP";
            nextTier = "Max";
            maxPoints = p; // already at max
        }

        const percentage = currentTier === "VIP" ? 100 : Math.min(((p) / maxPoints) * 100, 100);
        const pointsNeeded = maxPoints - p;

        return { percentage, pointsNeeded: pointsNeeded > 0 ? pointsNeeded : 0, nextTier };
    };

    const progressInfo = getProgressInfo(user.gader);

    // Step 1: Confirm email → show OTP input
    const handleConfirmEmail = () => {
        if (!email || !email.includes('@')) {
            setEmailError(lang === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Invalid email format');
            return;
        }
        setEmailError('');
        setEmailOtp('');
        setEmailStep('otp');
    };

    // Step 2: Verify OTP → update Auth Vault → then save to profiles DB
    const handleVerifyEmailOtp = async () => {
        if (emailOtp.length < 6) {
            setEmailError(lang === 'ar' ? 'يرجى إدخال الرمز المكون من 6 أرقام' : 'Please enter the full 6-digit code');
            return;
        }
        if (!user || !user.id || (isDevEnv && user.id === 'mock-uuid')) return;

        // Dev bypass: skip supabase.auth.updateUser (no native session)
        const skipAuthVault = isDevEnv && user.isDevBypass;

        setEmailError('');
        setEmailStep('saving');
        try {
            if (!skipAuthVault) {
                // ── Step 1: Register email in Supabase Auth vault ──
                const { data: authData, error: authError } = await supabase.auth.updateUser({ email: email });

                if (authError) {
                    console.error('Auth Update Error:', authError);
                    const isUnique = authError.message?.toLowerCase().includes('already') ||
                        authError.message?.toLowerCase().includes('unique') ||
                        authError.message?.toLowerCase().includes('duplicate');
                    setEmailError(isUnique
                        ? (lang === 'ar' ? 'هذا البريد الإلكتروني مستخدم بالفعل' : 'This email is already in use')
                        : (lang === 'ar' ? 'حدث خطأ أثناء تحديث البريد' : 'Error updating email'));
                    setEmailStep('otp');
                    return;
                }
            }

            // ── Step 2: Update profiles table (only if Step 1 succeeded) ──
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ email: email })
                .eq('id', user.id);

            if (profileError) {
                console.error('DB Update Error:', profileError);
                setEmailError(lang === 'ar' ? 'فشل حفظ البريد الإلكتروني' : 'Failed to save email');
                setEmailStep('otp');
                return;
            }

            // ── Step 3: Both succeeded → show verified state ──
            setEmailStep('verified');
            setToastMessage(lang === 'ar' ? 'تم توثيق البريد الإلكتروني بنجاح' : 'Email verified successfully');
            setTimeout(() => setToastMessage(''), 3000);

        } catch (err) {
            console.error('Exception during email verification:', err);
            setEmailError(lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error');
            setEmailStep('otp');
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-10" dir={isRTL ? 'rtl' : 'ltr'}>

            {/* Account Status Banner (if phone is missing) */}
            {!safePhone && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl mb-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        <p className="text-sm font-medium leading-relaxed">
                            {lang === 'ar'
                                ? '⚠️ حسابك غير مكتمل. للحصول على الصلاحيات الكاملة ونقاط قَدِّر، يرجى ربط وتوثيق رقم هاتفك.'
                                : '⚠️ Your account is incomplete. To get full access and Gader Points, please link and verify your phone number.'}
                        </p>
                    </div>
                </div>
            )}

            {/* ═══ Profile Header Card ═══ */}
            <ProfileHeader
                user={user}
                displayLogs={displayLogs}
                progressInfo={progressInfo}
                isRTL={isRTL}
                t={t}
                lang={lang}
                logout={logout}
                router={router}
            />

            {/* 🛡️ Show My Gader Pass Button */}
            {safePhone ? (
                <button
                    onClick={() => setIsQrModalOpen(true)}
                    className="w-full max-w-md mx-auto mt-4 mb-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all flex justify-center items-center gap-2"
                >
                    🛡️ {lang === 'ar' ? 'عرض بطاقة قَدِّر الرقمية' : 'Show My Gader Pass'}
                </button>
            ) : (
                <button
                    disabled
                    className="w-full max-w-md mx-auto mt-4 mb-8 py-3 bg-gray-300 text-gray-500 rounded-xl font-bold shadow-sm flex justify-center items-center gap-2 cursor-not-allowed"
                >
                    🔒 {lang === 'ar' ? 'وثق رقمك لعرض البطاقة' : 'Verify phone to show card'}
                </button>
            )}

            {/* ═══ Personal Details & Email Section ═══ */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8 p-6 sm:p-10">
                <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                    <User className="w-6 h-6 text-blue-800" />
                    <h2 className="text-2xl font-bold text-slate-800">{t('personal_details') || 'Personal Details'}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="space-y-2">
                        <Label htmlFor="name">{t('full_name') || 'Full Name'}</Label>
                        <Input id="name" value={name} onChange={e => setName(e.target.value)} onBlur={handleSaveProfile} placeholder="Omar Mukhtar" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="city">{t('city') || 'City'}</Label>
                        <select
                            id="city"
                            value={city}
                            onChange={e => setCity(e.target.value)}
                            onBlur={handleSaveProfile}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">{t('select_city') || 'Select City'}</option>
                            <option value="Tripoli">{t('Tripoli') || 'Tripoli'}</option>
                            <option value="Benghazi">{t('Benghazi') || 'Benghazi'}</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="dob">{t('date_of_birth') || 'Date of Birth'}</Label>
                        <div className="flex gap-4">
                            <Input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)} onBlur={handleSaveProfile} className="flex-grow" />
                            <div className="bg-slate-50 border border-slate-200 rounded-md px-4 flex items-center justify-center shrink-0 w-24">
                                <span className="font-semibold text-slate-600">{calculateAge(dob)} {t('age') || 'Age'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>{t('gender') || 'Gender'}</Label>
                        <div className="flex gap-4 h-10 items-center">
                            <label className="flex items-center gap-2">
                                <input type="radio" name="gender" value="male" checked={gender === 'male'} onChange={() => setGender('male')} onBlur={handleSaveProfile} className="w-4 h-4 text-blue-600" />
                                <span>{t('male') || 'Male'}</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="radio" name="gender" value="female" checked={gender === 'female'} onChange={() => setGender('female')} onBlur={handleSaveProfile} className="w-4 h-4 text-blue-600" />
                                <span>{t('female') || 'Female'}</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Phone Verification Row */}
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Phone className="w-5 h-5 text-slate-600" />
                        <h3 className="font-bold text-slate-800">{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</h3>
                        {safePhone && <ShieldCheck className="w-5 h-5 text-emerald-500 ml-auto" />}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-grow space-y-2">
                            <Input
                                type="tel"
                                placeholder="+218..."
                                value={safePhone || ''}
                                readOnly={true}
                                disabled={!!safePhone}
                                className={safePhone ? 'border-emerald-200 bg-emerald-50' : ''}
                            />
                        </div>
                        {safePhone ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold text-sm shrink-0 self-center">
                                <ShieldCheck className="w-4 h-4" /> {lang === 'ar' ? '✅ موثق' : '✅ Verified'}
                            </span>
                        ) : (
                            <button
                                onClick={() => setShowLoginModal(true)}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 shrink-0 font-medium"
                            >
                                {lang === 'ar' ? 'توثيق الرقم' : 'Verify Number'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Email Verification Flow */}
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Mail className="w-5 h-5 text-slate-600" />
                        <h3 className="font-bold text-slate-800">{t('email_address') || 'Email Address'}</h3>
                        {(emailStep === 'verified' || savedEmail) && <ShieldCheck className="w-5 h-5 text-emerald-500 ml-auto" />}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-grow space-y-2">
                            <Input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={e => {
                                    setEmail(e.target.value);
                                    if (emailStep !== 'idle') setEmailStep('idle');
                                    setEmailError('');
                                }}
                                readOnly={!!savedEmail || emailStep === 'otp' || emailStep === 'saving'}
                                disabled={emailStep === 'saving'}
                                className={emailStep === 'verified' || savedEmail ? 'border-emerald-200 bg-emerald-50' : ''}
                            />
                            {emailError && emailStep !== 'otp' && <p className="text-xs text-rose-500">{emailError}</p>}
                        </div>

                        {!savedEmail && emailStep === 'idle' && (
                            <Button onClick={handleConfirmEmail} disabled={!email} className="bg-slate-800 hover:bg-slate-900 text-white shrink-0">
                                {lang === 'ar' ? 'تأكيد' : 'Confirm'}
                            </Button>
                        )}

                        {!savedEmail && emailStep === 'saving' && (
                            <Button disabled className="bg-slate-400 shrink-0">
                                {lang === 'ar' ? 'جارٍ التحقق...' : 'Verifying...'}
                            </Button>
                        )}

                        {(emailStep === 'verified' || savedEmail) && (
                            <span className="inline-flex items-center gap-1.5 text-green-600 font-bold text-sm shrink-0 self-center">
                                ✅ {lang === 'ar' ? 'موثق' : 'Verified'}
                            </span>
                        )}
                    </div>

                    {/* OTP Verification Step */}
                    {emailStep === 'otp' && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg animate-in fade-in slide-in-from-top-2">
                            <p className="text-sm text-blue-700 font-medium mb-3">
                                {lang === 'ar'
                                    ? `تم إرسال رمز التحقق إلى ${email}`
                                    : `A verification code has been sent to ${email}`}
                            </p>
                            <div className="flex gap-3">
                                <Input
                                    type="text"
                                    placeholder="123456"
                                    value={emailOtp}
                                    onChange={e => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    maxLength={6}
                                    className="text-center tracking-widest font-mono flex-grow"
                                />
                                <Button onClick={handleVerifyEmailOtp} disabled={emailOtp.length < 6} className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                                    {lang === 'ar' ? 'تحقق' : 'Verify'}
                                </Button>
                            </div>
                            {emailError && <p className="text-xs text-rose-500 mt-2">{emailError}</p>}
                            <button
                                onClick={() => { setEmailStep('idle'); setEmailOtp(''); setEmailError(''); }}
                                className="text-xs text-blue-500 hover:text-blue-700 mt-2 font-medium"
                            >
                                {lang === 'ar' ? '← تغيير البريد' : '← Change email'}
                            </button>
                        </div>
                    )}

                </div>
            </div>

            {/* ═══ Activity History & Coupons Tabs ═══ */}
            <LogHistory
                user={user}
                displayLogs={displayLogs}
                historyLogs={historyLogs}
                setHistoryLogs={setHistoryLogs}
                isLoadingLogs={isLoadingLogs}
                isRTL={isRTL}
                t={t}
                lang={lang}
                setActiveTab={setActiveTab}
                setToastMessage={setToastMessage}
            />

            {/* ═══ Gader Pass QR Modal ═══ */}
            {isQrModalOpen && (
                <GaderPassModal
                    user={user}
                    lang={lang}
                    onClose={() => setIsQrModalOpen(false)}
                />
            )}

            <Toast message={toastMessage} onClose={() => setToastMessage('')} />
        </div>
    );
}
