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
import { Phone, ShieldCheck, Loader2, Timer, Sparkles } from 'lucide-react';

/**
 * PhoneVerifyPrompt — shown to Facebook/OAuth users who haven't verified their phone.
 * Allows them to add + verify a phone number via WhatsApp OTP to unlock full features
 * (submitting complaints with shields, redeeming rewards).
 */
export function PhoneVerifyPrompt({ isOpen, onClose, onVerified }) {
    const { supabase, lang, isRTL, user } = useTagdeer();

    const [step, setStep] = useState('phone'); // 'phone' | 'otp'
    const [phone, setPhone] = useState('');
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const inputRefs = useRef([]);

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

    // Focus first OTP box
    useEffect(() => {
        if (step === 'otp' && inputRefs.current[0]) {
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [step]);

    // Send OTP via WhatsApp
    const handleSendOtp = async (e) => {
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

            const { data, error: functionError } = await supabase.functions.invoke('whatsapp-otp-send', {
                body: { phone: formattedPhone }
            });

            if (functionError || (data && data.error)) {
                setError((data && data.error) || (lang === 'ar' ? 'فشل إرسال رسالة واتساب' : 'Failed to send WhatsApp message'));
            } else {
                setPhone(formattedPhone);
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

    // OTP digit handlers
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

    // Verify OTP and update phone in profile
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');

        const token = otpDigits.join('');
        if (token.length < 6) {
            setError(lang === 'ar' ? 'يرجى إدخال الرمز المكون من 6 أرقام' : 'Please enter the full 6-digit code');
            return;
        }

        setIsLoading(true);
        try {
            // Verify OTP via edge function
            const { data, error: verifyError } = await supabase.functions.invoke('whatsapp-otp-verify', {
                body: { phone, otp: token }
            });

            if (verifyError || (data && data.error)) {
                throw new Error((data && data.error) || (lang === 'ar' ? 'رمز غير صحيح' : 'Invalid code'));
            }

            // OTP verified! Update the profile with phone + phone_verified = true
            const { error: updateErr } = await supabase
                .from('profiles')
                .update({ phone, phone_verified: true })
                .eq('id', user.id);

            if (updateErr) {
                console.error('Profile phone update error:', updateErr);
                throw new Error(lang === 'ar' ? 'فشل تحديث الملف الشخصي' : 'Failed to update profile');
            }

            // Success — notify parent
            if (onVerified) onVerified(phone);
            handleClose(false);
        } catch (err) {
            setError(err.message || (lang === 'ar' ? 'رمز غير صحيح' : 'Invalid code'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = (open) => {
        if (!open) {
            onClose();
            setTimeout(() => {
                setStep('phone');
                setPhone('');
                setOtpDigits(['', '', '', '', '', '']);
                setError('');
            }, 300);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                {/* Decorative top gradient */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

                <DialogHeader className="pt-2">
                    <div className="mx-auto mb-3">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-amber-500 to-orange-600">
                            {step === 'phone' ? <Phone className="w-7 h-7 text-white" /> : <ShieldCheck className="w-7 h-7 text-white" />}
                        </div>
                    </div>
                    <DialogTitle className="text-2xl font-extrabold text-center text-slate-800">
                        {lang === 'ar' ? 'تحقق من رقم هاتفك' : 'Verify Your Phone'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-slate-500 text-sm leading-relaxed">
                        {step === 'phone'
                            ? (lang === 'ar'
                                ? 'أضف رقم هاتفك وتحقق منه عبر واتساب لفتح جميع المميزات — استبدال المكافآت وتسجيل التجارب الموثّقة.'
                                : 'Add and verify your phone via WhatsApp to unlock all features — redeeming rewards and submitting verified logs.')
                            : (lang === 'ar'
                                ? `أدخل الرمز المرسل إلى ${phone}`
                                : `Enter the code sent to ${phone}`)}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {/* Phone Input Step */}
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

                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                                <span className="text-xs text-amber-700 font-medium">
                                    {lang === 'ar'
                                        ? 'التحقق من الهاتف مطلوب لاستبدال المكافآت وتسجيل الشكاوى الموثّقة'
                                        : 'Phone verification is required to redeem rewards and submit verified complaints'}
                                </span>
                            </div>

                            {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}

                            <Button
                                type="submit"
                                className="w-full h-12 text-base bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold transition-all shadow-md hover:shadow-lg rounded-xl"
                                disabled={isLoading || !phone || cooldownSeconds > 0}
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {lang === 'ar' ? 'جارِ الإرسال...' : 'Sending...'}</>
                                ) : cooldownSeconds > 0 ? (
                                    <><Timer className="mr-2 h-5 w-5" /> {lang === 'ar' ? `انتظر ${cooldownSeconds} ثانية` : `Wait ${cooldownSeconds}s`}</>
                                ) : (
                                    lang === 'ar' ? 'إرسال رمز التحقق عبر واتساب' : 'Send Verification Code via WhatsApp'
                                )}
                            </Button>

                            <button
                                type="button"
                                onClick={() => handleClose(false)}
                                className="w-full text-sm text-slate-400 hover:text-slate-600 mt-1"
                            >
                                {lang === 'ar' ? 'لاحقاً' : 'Maybe later'}
                            </button>
                        </form>
                    )}

                    {/* OTP Verification Step */}
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
                                                ? 'border-amber-500 bg-amber-50 text-amber-800'
                                                : 'border-slate-200 bg-white text-slate-800 focus:border-amber-400 focus:bg-amber-50/50'
                                            }`}
                                        disabled={isLoading}
                                    />
                                ))}
                            </div>

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
                                className="w-full h-12 text-base bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold transition-all shadow-md hover:shadow-lg rounded-xl"
                                disabled={isLoading || otpDigits.join('').length < 6}
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {lang === 'ar' ? 'جارِ التحقق...' : 'Verifying...'}</>
                                ) : (
                                    <><ShieldCheck className="mr-2 h-5 w-5" /> {lang === 'ar' ? 'تحقق وفعّل رقمك' : 'Verify & Activate Phone'}</>
                                )}
                            </Button>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
