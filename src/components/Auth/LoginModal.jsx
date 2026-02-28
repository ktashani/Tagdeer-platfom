'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Phone, ShieldCheck, Loader2, ArrowLeft, Sparkles, Mail, Timer } from 'lucide-react';

export function LoginModal() {
    const { showLoginModal, setShowLoginModal, loginWithOtp, login, t, lang, isRTL, supabase } = useTagdeer();

    const [step, setStep] = useState('phone'); // 'phone' | 'email' | 'otp'
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [otpChannel, setOtpChannel] = useState('whatsapp'); // 'whatsapp' or 'email'
    const inputRefs = useRef([]);

    // Safely detect localhost on client to avoid Next.js hydration mismatch
    const [isLocalhost, setIsLocalhost] = useState(false);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsLocalhost(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        }
    }, []);

    // Rate-limit cooldown
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    const cooldownRef = useRef(null);

    const startCooldown = useCallback(() => {
        setCooldownSeconds(60);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
            setCooldownSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(cooldownRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

    // Focus first OTP box when switching to OTP step
    useEffect(() => {
        if (step === 'otp' && inputRefs.current[0]) {
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [step]);

    // ── Send OTP via WhatsApp (Edge Function) or Dev Bypass ──
    const handleSendOtp = async (e, forceDevBypass = false) => {
        if (e) e.preventDefault();
        setError('');

        if (cooldownSeconds > 0) {
            setError(lang === 'ar' ? `انتظر ${cooldownSeconds} ثانية` : `Please wait ${cooldownSeconds}s`);
            return;
        }

        const cleanPhone = phone.replace(/\s/g, '');
        if (cleanPhone.length < 9) {
            setError(lang === 'ar' ? 'يرجى إدخال رقم هاتف صحيح' : 'Please enter a valid phone number');
            return;
        }

        setIsLoading(true);
        try {
            const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

            // DEV MODE: Mock Bypass (works in development OR on localhost)
            const isDevEnv = process.env.NODE_ENV === 'development' || (typeof window !== 'undefined' && window.location.hostname === 'localhost');
            if (isDevEnv && (forceDevBypass || phone === '999999999')) {
                // Mock success
                setPhone(formattedPhone);
                setOtpChannel('whatsapp');
                setStep('otp');
                startCooldown();
                setIsLoading(false);
                return;
            }

            // PRODUCTION/REAL MODE: Call Edge Function
            const { data, error: functionError } = await supabase.functions.invoke('whatsapp-otp-send', {
                body: { phone: formattedPhone }
            });

            if (functionError || (data && data.error)) {
                console.error("Edge function error:", functionError || data.error);
                setError((data && data.error) || (lang === 'ar' ? 'فشل إرسال رسالة واتساب' : 'Failed to send WhatsApp message'));
            } else {
                setPhone(formattedPhone);
                setOtpChannel('whatsapp');
                setStep('otp');
                startCooldown();
            }
        } catch (err) {
            console.error('OTP exception:', err);
            setError(lang === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Send OTP via Email (Supabase native) ──
    const handleSendEmailOtp = async (e) => {
        e.preventDefault();
        setError('');

        if (cooldownSeconds > 0) {
            setError(lang === 'ar' ? `انتظر ${cooldownSeconds} ثانية` : `Please wait ${cooldownSeconds}s`);
            return;
        }

        if (!email || !email.includes('@')) {
            setError(lang === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email');
            return;
        }

        setIsLoading(true);
        try {
            const { error: otpError } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`
                }
            });

            if (otpError) {
                setError(otpError.message || (lang === 'ar' ? 'فشل إرسال الرمز' : 'Failed to send code'));
            } else {
                setOtpChannel('email');
                setStep('otp');
                startCooldown();
            }
        } catch (err) {
            console.error('Email OTP exception:', err);
            setError(lang === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error');
        } finally {
            setIsLoading(false);
        }
    };

    // ── OTP digit handlers ──
    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newDigits = [...otpDigits];
        newDigits[index] = value.slice(-1);
        setOtpDigits(newDigits);
        if (value && index < 5) inputRefs.current[index + 1]?.focus();
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length > 0) {
            e.preventDefault();
            const newDigits = [...otpDigits];
            for (let i = 0; i < 6; i++) newDigits[i] = pasted[i] || '';
            setOtpDigits(newDigits);
            inputRefs.current[Math.min(pasted.length, 5)]?.focus();
        }
    };

    // ── Verify OTP ──
    const handleVerifyOtp = async (e, devTokenBypass = null) => {
        e.preventDefault();
        setError('');

        const token = devTokenBypass || otpDigits.join('');
        if (token.length < 6) {
            setError(lang === 'ar' ? 'يرجى إدخال الرمز المكون من 6 أرقام' : 'Please enter the full 6-digit code');
            return;
        }

        // Dev-only master code bypass
        if ((process.env.NODE_ENV === 'development' || isLocalhost) && token === '999999') {
            setIsLoading(true);
            try {
                const identifier = otpChannel === 'email' ? email : phone;
                await login(identifier);
                resetState();
            } catch (err) {
                setError(err.message || 'Dev bypass failed');
            } finally {
                setIsLoading(false);
            }
            return;
        }

        setIsLoading(true);
        try {
            if (otpChannel === 'email') {
                // Verify via Supabase Auth for email
                const { data: authData, error: verifyErr } = await supabase.auth.verifyOtp({
                    email,
                    token,
                    type: 'email'
                });

                if (verifyErr) {
                    throw new Error(verifyErr.message || (lang === 'ar' ? 'رمز غير صحيح' : 'Invalid code'));
                }

                // After email verification, use the login function with email
                await login(email);
            } else {
                // Verify via Edge Function for WhatsApp
                await loginWithOtp(phone, token);
            }
            resetState();
        } catch (err) {
            setError(err.message || (lang === 'ar' ? 'رمز غير صحيح' : 'Invalid code'));
        } finally {
            setIsLoading(false);
        }
    };

    const resetState = () => {
        setTimeout(() => {
            setStep('phone');
            setPhone('');
            setEmail('');
            setOtpDigits(['', '', '', '', '', '']);
            setOtpChannel('whatsapp');
        }, 500);
    };

    const handleClose = (open) => {
        setShowLoginModal(open);
        if (!open) {
            setTimeout(() => {
                setStep('phone');
                setPhone('');
                setEmail('');
                setOtpDigits(['', '', '', '', '', '']);
                setError('');
                setOtpChannel('whatsapp');
            }, 300);
        }
    };

    return (
        <Dialog open={showLoginModal} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                {/* Decorative top gradient */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${step === 'email' ? 'from-blue-400 via-indigo-500 to-purple-500'
                    : step === 'otp' ? 'from-blue-400 via-blue-500 to-indigo-500'
                        : 'from-green-400 via-emerald-500 to-teal-500'
                    }`} />

                <DialogHeader className="pt-2">
                    <div className="mx-auto mb-3">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${step === 'email' ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                            : step === 'otp' ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                : 'bg-gradient-to-br from-green-500 to-emerald-600'
                            }`}>
                            {step === 'phone' ? <Phone className="w-7 h-7 text-white" />
                                : step === 'email' ? <Mail className="w-7 h-7 text-white" />
                                    : <ShieldCheck className="w-7 h-7 text-white" />}
                        </div>
                    </div>
                    <DialogTitle className="text-2xl font-extrabold text-center text-slate-800">
                        {step === 'phone'
                            ? (lang === 'ar' ? 'تسجيل الدخول عبر واتساب' : 'Login with WhatsApp')
                            : step === 'email'
                                ? (lang === 'ar' ? 'تسجيل الدخول عبر البريد' : 'Login with Email')
                                : (lang === 'ar' ? 'تحقق من هويتك' : 'Verify Your Identity')}
                    </DialogTitle>
                    <DialogDescription className="text-center text-slate-500 text-sm leading-relaxed">
                        {step === 'phone'
                            ? (lang === 'ar' ? 'سنرسل لك رمز تحقق مكوّن من 6 أرقام عبر واتساب.' : 'We will send a 6-digit secure code via WhatsApp.')
                            : step === 'email'
                                ? (lang === 'ar' ? 'سنرسل لك رمز تحقق إلى بريدك الإلكتروني.' : 'We will send a 6-digit code to your email.')
                                : otpChannel === 'email'
                                    ? (lang === 'ar' ? `أدخل الرمز المرسل إلى ${email}` : `Enter the code sent to ${email}`)
                                    : (lang === 'ar' ? `أدخل الرمز المرسل إلى ${phone}` : `Enter the code sent to ${phone}`)}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {/* ── Step: Phone Input ── */}
                    {step === 'phone' && (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div className="relative">
                                <Phone className={`absolute top-3.5 ${isRTL ? 'right-3' : 'left-3'} h-5 w-5 text-slate-400`} />
                                <Input
                                    type="tel"
                                    placeholder={lang === 'ar' ? '218 9X XXXXXXX+' : '+218 9X XXXXXXX'}
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className={`h-12 text-lg ${isRTL ? 'pr-10 pl-3' : 'pl-10'}`}
                                    disabled={isLoading}
                                    autoFocus
                                />
                            </div>

                            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                                <svg className="w-5 h-5 text-green-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                <span className="text-xs text-green-700 font-medium">
                                    {lang === 'ar' ? 'سيتم إرسال رمز آمن مكون من 6 أرقام عبر واتساب' : 'A secure 6-digit code will be sent via WhatsApp'}
                                </span>
                            </div>

                            {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

                            <Button
                                type="submit"
                                className="w-full h-12 text-base bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold transition-all shadow-md hover:shadow-lg rounded-xl"
                                disabled={isLoading || !phone || cooldownSeconds > 0}
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {lang === 'ar' ? 'جارِ الإرسال...' : 'Sending...'}</>
                                ) : cooldownSeconds > 0 ? (
                                    <><Timer className="mr-2 h-5 w-5" /> {lang === 'ar' ? `انتظر ${cooldownSeconds} ثانية` : `Wait ${cooldownSeconds}s`}</>
                                ) : (
                                    lang === 'ar' ? 'إرسال رمز التحقق' : 'Send OTP via WhatsApp'
                                )}
                            </Button>

                            {/* Email fallback link */}
                            <button
                                type="button"
                                onClick={() => { setStep('email'); setError(''); }}
                                className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 mt-1 hover:underline"
                            >
                                <Mail className="w-3.5 h-3.5" />
                                {lang === 'ar' ? 'لم يصلك الرمز؟ أرسل عبر البريد الإلكتروني' : "Didn't get the code? Send via Email instead"}
                            </button>

                            {/* DEV BYPASS button on phone screen */}
                            {(process.env.NODE_ENV === 'development' || isLocalhost) && (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={(e) => handleSendOtp(e, true)}
                                        className="w-full flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors rounded-xl px-3 py-2.5"
                                    >
                                        <span className="text-[11px] text-purple-600 font-mono font-bold tracking-wide">
                                            🔧 DEV BYPASS: SKIP WHATSAPP API
                                        </span>
                                    </button>
                                </div>
                            )}
                        </form>
                    )}

                    {/* ── Step: Email Input ── */}
                    {step === 'email' && (
                        <form onSubmit={handleSendEmailOtp} className="space-y-4">
                            <div className="relative">
                                <Mail className={`absolute top-3.5 ${isRTL ? 'right-3' : 'left-3'} h-5 w-5 text-slate-400`} />
                                <Input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={`h-12 text-lg ${isRTL ? 'pr-10 pl-3' : 'pl-10'}`}
                                    disabled={isLoading}
                                    autoFocus
                                />
                            </div>

                            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                                <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                                <span className="text-xs text-blue-700 font-medium">
                                    {lang === 'ar' ? 'سنرسل رمز تحقق مكون من 6 أرقام إلى بريدك' : 'A 6-digit code will be sent to your inbox'}
                                </span>
                            </div>

                            {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

                            <Button
                                type="submit"
                                className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold transition-all shadow-md hover:shadow-lg rounded-xl"
                                disabled={isLoading || !email || cooldownSeconds > 0}
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {lang === 'ar' ? 'جارِ الإرسال...' : 'Sending...'}</>
                                ) : cooldownSeconds > 0 ? (
                                    <><Timer className="mr-2 h-5 w-5" /> {lang === 'ar' ? `انتظر ${cooldownSeconds} ثانية` : `Wait ${cooldownSeconds}s`}</>
                                ) : (
                                    lang === 'ar' ? 'إرسال رمز عبر البريد' : 'Send OTP via Email'
                                )}
                            </Button>

                            <button
                                type="button"
                                onClick={() => { setStep('phone'); setError(''); }}
                                className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 mt-1 hover:underline"
                                disabled={isLoading}
                            >
                                <ArrowLeft className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                                {lang === 'ar' ? 'العودة لواتساب' : 'Back to WhatsApp'}
                            </button>
                        </form>
                    )}

                    {/* ── Step: OTP Verification ── */}
                    {step === 'otp' && (
                        <form onSubmit={handleVerifyOtp} className="space-y-5">
                            <div className="flex justify-center gap-2" dir="ltr">
                                {otpDigits.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => (inputRefs.current[i] = el)}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(i, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                        onPaste={i === 0 ? handleOtpPaste : undefined}
                                        className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 transition-all outline-none
                                            ${digit
                                                ? 'border-blue-500 bg-blue-50 text-blue-800'
                                                : 'border-slate-200 bg-white text-slate-800 focus:border-blue-400 focus:bg-blue-50/50'
                                            }`}
                                        disabled={isLoading}
                                    />
                                ))}
                            </div>

                            {/* Welcome bonus hint */}
                            <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                                <span className="text-xs text-amber-700 font-medium">
                                    {lang === 'ar' ? 'مكافأة ترحيبية +500 نقطة للحسابات الجديدة!' : '+500 point welcome bonus for new accounts!'}
                                </span>
                            </div>

                            {/* Dev skip validation interactive bypass */}
                            {(process.env.NODE_ENV === 'development' || isLocalhost) && (
                                <div className="mt-2 text-center">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOtpDigits(['9', '9', '9', '9', '9', '9']);
                                            setTimeout(() => handleVerifyOtp({ preventDefault: () => { } }, '999999'), 50);
                                        }}
                                        className="text-[11px] text-purple-600 font-mono font-bold hover:underline"
                                    >
                                        🔧 DEV BYPASS: AUTO-FILL & SKIP
                                    </button>
                                </div>
                            )}

                            {/* Cooldown timer */}
                            {cooldownSeconds > 0 && (
                                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                                    <Timer className="w-3.5 h-3.5" />
                                    {lang === 'ar'
                                        ? `يمكنك إعادة الإرسال بعد ${cooldownSeconds} ثانية`
                                        : `You can resend in ${cooldownSeconds}s`}
                                </div>
                            )}

                            {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

                            <Button
                                type="submit"
                                className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold transition-all shadow-md hover:shadow-lg rounded-xl"
                                disabled={isLoading || otpDigits.join('').length < 6}
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {lang === 'ar' ? 'جارِ التحقق...' : 'Verifying...'}</>
                                ) : (
                                    <><ShieldCheck className="mr-2 h-5 w-5" /> {lang === 'ar' ? 'تحقق وسجّل الدخول' : 'Verify & Login'}</>
                                )}
                            </Button>

                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setStep(otpChannel === 'email' ? 'email' : 'phone'); setOtpDigits(['', '', '', '', '', '']); setError(''); }}
                                    className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 hover:underline"
                                    disabled={isLoading}
                                >
                                    <ArrowLeft className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                                    {lang === 'ar' ? 'تغيير الرقم أو البريد' : 'Use a different number or email'}
                                </button>

                                {/* Switch channel fallback */}
                                {otpChannel === 'whatsapp' && (
                                    <button
                                        type="button"
                                        onClick={() => { setStep('email'); setOtpDigits(['', '', '', '', '', '']); setError(''); }}
                                        className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 hover:underline"
                                        disabled={isLoading}
                                    >
                                        <Mail className="w-3 h-3" />
                                        {lang === 'ar' ? 'لم يصلك الرمز؟ جرب البريد الإلكتروني' : "Didn't receive it? Try Email instead"}
                                    </button>
                                )}
                            </div>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
