'use client';

import React, { useState } from 'react';
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
import { Phone, KeyRound, Loader2 } from 'lucide-react';

export function LoginModal() {
    const { showLoginModal, setShowLoginModal, login, t, isRTL } = useTagdeer();

    const [step, setStep] = useState('phone'); // 'phone' or 'otp'
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendOtp = (e) => {
        e.preventDefault();
        setError('');

        if (phone.length < 9) {
            setError(t('invalid_phone') || 'Please enter a valid phone number');
            return;
        }

        setIsLoading(true);
        // Simulate API call to send OTP
        setTimeout(() => {
            setIsLoading(false);
            setStep('otp');
        }, 1500);
    };

    const handleVerifyOtp = (e) => {
        e.preventDefault();
        setError('');

        if (otp !== '123456') {
            setError(t('invalid_otp') || 'Invalid OTP. Try 123456');
            return;
        }

        setIsLoading(true);
        // Simulate Verification
        setTimeout(() => {
            setIsLoading(false);
            login(phone);
            // Reset state for next time
            setTimeout(() => {
                setStep('phone');
                setPhone('');
                setOtp('');
            }, 500);
        }, 1000);
    };

    const handleClose = (open) => {
        setShowLoginModal(open);
        if (!open) {
            setTimeout(() => {
                setStep('phone');
                setPhone('');
                setOtp('');
                setError('');
            }, 300);
        }
    };

    return (
        <Dialog open={showLoginModal} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center text-blue-800">
                        {step === 'phone'
                            ? (t('login_with_whatsapp') || 'Login with WhatsApp')
                            : (t('verify_your_number') || 'Verify Your Number')}
                    </DialogTitle>
                    <DialogDescription className="text-center text-slate-500">
                        {step === 'phone'
                            ? (t('login_description') || 'Enter your WhatsApp number to receive a one-time password.')
                            : (t('otp_description') || `We sent a code to ${phone}. Enter 123456 to test.`)}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    {step === 'phone' ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div className="relative">
                                <Phone className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} h-5 w-5 text-slate-400`} />
                                <Input
                                    type="tel"
                                    placeholder="+218 9X XXXXXXX"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className={`pl-10 h-12 text-lg ${isRTL ? 'pr-10 pl-3' : ''}`}
                                    disabled={isLoading}
                                />
                            </div>
                            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                            <Button
                                type="submit"
                                className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-all shadow-md hover:shadow-lg"
                                disabled={isLoading || !phone}
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('sending') || 'Sending...'}</>
                                ) : (
                                    t('send_otp') || 'Send OTP via WhatsApp'
                                )}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div className="relative">
                                <KeyRound className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} h-5 w-5 text-slate-400`} />
                                <Input
                                    type="text"
                                    placeholder="123456"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className={`pl-10 h-12 text-lg text-center tracking-[0.5em] font-bold ${isRTL ? 'pr-10 pl-3' : ''}`}
                                    maxLength={6}
                                    disabled={isLoading}
                                />
                            </div>
                            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                            <Button
                                type="submit"
                                className="w-full h-12 text-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold transition-all shadow-md hover:shadow-lg"
                                disabled={isLoading || otp.length < 4}
                            >
                                {isLoading ? (
                                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('verifying') || 'Verifying...'}</>
                                ) : (
                                    t('verify_login') || 'Verify & Login'
                                )}
                            </Button>
                            <button
                                type="button"
                                onClick={() => setStep('phone')}
                                className="w-full text-sm text-slate-500 hover:text-blue-600 mt-2 hover:underline"
                                disabled={isLoading}
                            >
                                {t('use_different_number') || 'Use a different number'}
                            </button>
                        </form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
