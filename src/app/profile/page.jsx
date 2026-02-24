'use client';

import React, { useEffect, useState } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { BadgeCheck, LogOut, History, Ticket, AlertCircle, Mail, User, ShieldCheck, Target } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Toast } from '@/components/Toast';

export default function ProfilePage() {
    const { user, logout, t, isRTL, setShowLoginModal, lang } = useTagdeer();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('history');
    const [toastMessage, setToastMessage] = useState('');

    // Personal Details State
    const [name, setName] = useState(user?.full_name || '');
    const [dob, setDob] = useState(user?.birth_date || '');
    const [city, setCity] = useState(user?.city || '');
    const [gender, setGender] = useState(user?.gender || '');
    const [isSaving, setIsSaving] = useState(false);

    // Sync state if user loads later
    useEffect(() => {
        if (user) {
            if (user.full_name) setName(user.full_name);
            if (user.birth_date) setDob(user.birth_date);
            if (user.city) setCity(user.city);
            if (user.gender) setGender(user.gender);
        }
    }, [user]);

    // Handle Profile Update
    const handleSaveProfile = async () => {
        if (!user || !user.id || user.id === 'mock-uuid') return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: name || null,
                    birth_date: dob ? dob : null,
                    city: city || null,
                    gender: gender || null
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

    // Email OTP Flow State
    const [email, setEmail] = useState('');
    const [emailStep, setEmailStep] = useState('idle'); // idle, sending, otp, verified
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

    // Mock Data for History
    const mockHistoryLogs = [
        { id: 1, business: "Al-Madina Tech", date: "2026-02-23", type: "recommend", text: "Excellent customer service and repair." },
        { id: 2, business: "Omar's Auto Repair", date: "2026-02-20", type: "complain", text: "Long waiting times to get an appointment." },
        { id: 3, business: "Tripoli Central Clinic", date: "2026-02-15", type: "recommend", text: "Very clean facilities and professional doctors." }
    ];

    // Helper: Calculate Age from DOB
    const calculateAge = (dobString) => {
        if (!dobString) return '-';
        const birthday = new Date(dobString);
        const ageDifMs = Date.now() - birthday.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    // Helper: Gamification Progress
    const getProgressInfo = (points) => {
        let currentTier = "Bronze";
        let nextTier = "Silver";
        let maxPoints = 100;
        let p = points || 0;

        if (p > 100 && p <= 500) {
            currentTier = "Silver";
            nextTier = "Gold";
            maxPoints = 500;
            p = p - 100;
        } else if (p > 500) {
            currentTier = "Gold";
            nextTier = "Diamond"; // Future tier
            maxPoints = 1000;
            p = p - 500;
        }

        const percentage = Math.min((p / (currentTier === "Bronze" ? 100 : 400)) * 100, 100);
        const pointsNeeded = maxPoints - (points || 0);

        return { percentage, pointsNeeded, nextTier };
    };

    const progressInfo = getProgressInfo(user.gader);

    // Mock Email OTP Methods
    const handleSendEmailOtp = () => {
        if (!email.includes('@')) {
            setEmailError('Invalid email format');
            return;
        }
        setEmailError('');
        setEmailStep('sending');
        setTimeout(() => setEmailStep('otp'), 1500);
    };

    const handleVerifyEmailOtp = () => {
        if (emailOtp === '123456') {
            setEmailError('');
            setEmailStep('verified');
        } else {
            setEmailError(t('invalid_otp') || 'Invalid OTP');
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-10" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Header Profile Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
                <div className="bg-blue-800 p-6 sm:p-10 text-white flex flex-col relative overflow-hidden">
                    {/* Decorative background element */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 opacity-10 pointer-events-none">
                        <BadgeCheck className="w-64 h-64" />
                    </div>

                    <div className="absolute top-4 end-4 sm:top-6 sm:end-6 z-20">
                        <Button
                            variant="ghost"
                            className="text-white hover:bg-white/20 hover:text-white border-white/20"
                            onClick={() => {
                                logout();
                                router.push('/');
                            }}
                        >
                            <LogOut className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                            {t('logout') || 'Sign Out'}
                        </Button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 z-10 w-full pt-12 sm:pt-0 sm:pe-32">
                        <div className="bg-white p-2 rounded-xl shadow-inner shrink-0 transition-transform hover:scale-105">
                            <QRCode
                                value={user.userId || `tagdeer-user-${user.phone}`}
                                size={120}
                                bgColor="#ffffff"
                                fgColor="#1e40af"
                                level="Q"
                            />
                        </div>

                        <div className="flex flex-col items-center sm:items-start flex-grow text-center sm:text-start">
                            <div className="flex items-center gap-2 bg-blue-900/50 px-3 py-1 rounded-full text-sm font-medium mb-3 backdrop-blur-sm">
                                <BadgeCheck className="w-4 h-4 text-emerald-400" />
                                <span>{user.vipTier}</span>
                            </div>
                            <h1 className="text-3xl font-bold mb-1 font-mono tracking-wider">{user.phone}</h1>
                            <p className="text-blue-200 text-lg mb-4">{t('member_since') || 'Member since 2026'}</p>

                            <div className="flex gap-6 mt-auto">
                                <div className="flex flex-col">
                                    <span className="text-sm text-blue-200 uppercase tracking-wider font-semibold">{t('gader_points') || 'Gader Points'}</span>
                                    <span className="text-3xl font-bold text-amber-300">{user.gader}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm text-blue-200 uppercase tracking-wider font-semibold">{t('logs') || 'Logs'}</span>
                                    <span className="text-3xl font-bold">{mockHistoryLogs.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Gamification Progress Bar */}
                <div className="bg-slate-50 border-t border-slate-100 p-6 px-6 sm:px-10">
                    <div className="flex justify-between items-end mb-2">
                        <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-indigo-600" />
                            <div className="flex flex-col">
                                <span className="font-semibold text-slate-700">{progressInfo.nextTier} {t('tier') || 'Tier'}</span>
                                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t('migdar')}</span>
                            </div>
                        </div>
                        <span className="text-sm font-bold text-indigo-600">{user.gader} / {(user.gader || 0) + progressInfo.pointsNeeded} {t('gader_points') || 'Gader Points'}</span>
                    </div>
                    <Progress value={progressInfo.percentage} className="h-3 bg-slate-200" indicatorcolor="bg-indigo-600" />
                    <p className="text-sm text-slate-500 mt-2 font-medium">
                        {t('points_to_next_tier')?.replace('{points}', progressInfo.pointsNeeded).replace('{tier}', progressInfo.nextTier) || `Only ${progressInfo.pointsNeeded} more Gader Points to reach ${progressInfo.nextTier} Tier!`}
                    </p>
                </div>
            </div>

            {/* Personal Details & Email Section */}
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

                {/* Email Verification Flow */}
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Mail className="w-5 h-5 text-slate-600" />
                        <h3 className="font-bold text-slate-800">{t('email_address') || 'Email Address'}</h3>
                        {emailStep === 'verified' && <ShieldCheck className="w-5 h-5 text-emerald-500 ml-auto" />}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-grow space-y-2">
                            <Input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={e => {
                                    setEmail(e.target.value);
                                    if (emailStep === 'verified') setEmailStep('idle');
                                }}
                                disabled={emailStep === 'sending' || emailStep === 'otp'}
                                className={emailStep === 'verified' ? 'border-emerald-200 bg-emerald-50' : ''}
                            />
                            {emailError && emailStep === 'idle' && <p className="text-xs text-rose-500">{emailError}</p>}
                        </div>

                        {emailStep === 'idle' && (
                            <Button onClick={handleSendEmailOtp} disabled={!email} className="bg-slate-800 hover:bg-slate-900 text-white shrink-0">
                                {t('verify') || 'Verify'}
                            </Button>
                        )}

                        {emailStep === 'sending' && (
                            <Button disabled className="bg-slate-400 shrink-0">
                                {t('sending') || 'Sending...'}
                            </Button>
                        )}

                        {emailStep === 'verified' && (
                            <Button disabled className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shrink-0">
                                {t('verified') || 'Verified ✅'}
                            </Button>
                        )}
                    </div>

                    {emailStep === 'otp' && (
                        <div className="mt-4 flex gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex-grow space-y-2">
                                <Input
                                    type="text"
                                    placeholder="123456"
                                    value={emailOtp}
                                    onChange={e => setEmailOtp(e.target.value)}
                                    maxLength={6}
                                    className="text-center tracking-widest font-mono"
                                />
                                {emailError && <p className="text-xs text-rose-500">{emailError}</p>}
                            </div>
                            <Button onClick={handleVerifyEmailOtp} className="bg-blue-600 hover:bg-blue-700 shrink-0">
                                {t('verify') || 'Verify'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="history" onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8 h-14 bg-slate-100 p-1 rounded-xl">
                    <TabsTrigger value="history" className="text-base rounded-lg font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <History className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {t('my_history') || 'Activity History'}
                    </TabsTrigger>
                    <TabsTrigger value="coupons" className="text-base rounded-lg font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Ticket className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {t('my_rewards') || 'Coupons & Rewards'}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="history" className="mt-0 outline-none">
                    <div className="space-y-4">
                        {mockHistoryLogs.map((log) => (
                            <div key={log.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-300 transition-colors">
                                <div className="flex gap-4 items-start w-full">
                                    <div className={`p-3 rounded-full mt-1 shrink-0 ${log.type === 'recommend' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                        {log.type === 'recommend' ? <BadgeCheck className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                                    </div>
                                    <div className="flex-grow">
                                        <h3 className="font-bold text-lg text-slate-800">{log.business}</h3>
                                        <p className="text-slate-500 text-sm mt-1 mb-2">{log.text}</p>
                                        <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded inline-block">
                                            {new Date(log.date).toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                                <div className={`font-medium whitespace-nowrap px-3 py-1 rounded-full text-sm ${log.type === 'recommend' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                    {log.type === 'recommend' ? (t('recommended') || 'Recommended') : (t('complained') || 'Complained')}
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="coupons" className="mt-0 outline-none">
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                        <div className="bg-white p-5 rounded-full shadow-sm mb-6 inline-flex">
                            <Ticket className="w-12 h-12 text-indigo-500 animate-pulse" />
                        </div>
                        <h2 className="text-3xl font-bold text-indigo-900 mb-3">{t('coupons_rewards_title') || 'Coupons & Rewards'}</h2>
                        <p className="text-indigo-600/80 text-lg max-w-md">
                            {t('coupons_rewards_desc') || 'We are building an incredible rewards engine. Soon you will be able to spend your Gader Points for exclusive discounts!'}
                        </p>
                        <div className="mt-8 inline-flex items-center gap-2 bg-indigo-900 text-white px-6 py-2 rounded-full font-medium text-sm tracking-wide uppercase">
                            {t('coming_soon') || 'Coming Soon'}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            <Toast message={toastMessage} onClose={() => setToastMessage('')} />
        </div>
    );
}
