"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTagdeer } from '@/context/TagdeerContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MerchantLogin() {
    const [step, setStep] = useState(1); // 1: Email, 2: OTP
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { loginWithEmail, verifyEmailOtp, user, loading } = useTagdeer();

    // Auto-redirect if already logged in as merchant/admin
    useEffect(() => {
        if (!loading && user && (user.role === 'merchant' || user.role === 'admin')) {
            router.push('/merchant/dashboard');
        }
    }, [user, loading, router]);

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        if (!email.includes('@')) {
            toast.error("Please enter a valid email address");
            return;
        }

        setIsLoading(true);
        try {
            await loginWithEmail(email);
            setStep(2);
        } catch (err) {
            // Error handled by context toast
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpChange = (index, value) => {
        if (value.length > 1) return; // Only allow 1 char

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-advance
        if (value !== '' && index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            if (prevInput) prevInput.focus();
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        const code = otp.join('');
        console.log("Submitting code:", code, "for email:", email);
        if (code.length < 6) {
            toast.error("Please enter the full 6-digit code");
            return;
        }

        setIsLoading(true);
        try {
            await verifyEmailOtp(email, code);
            // Redirection is handled by the guard or context, but we can also force it here
            router.push('/merchant/dashboard');
        } catch (err) {
            // Error handled by context toast
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[80vh] px-4 animate-in fade-in duration-500">
            <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden relative">

                {/* Decorative top bar */}
                <div className="h-2 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 absolute top-0 left-0"></div>

                <CardHeader className="pt-10 pb-6 text-center">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/40 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100 dark:border-blue-800">
                        {step === 1 ? <Mail className="w-7 h-7" /> : <KeyRound className="w-7 h-7" />}
                    </div>
                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
                        {step === 1 ? "Welcome Back" : "Check Your Email"}
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-base mt-2">
                        {step === 1
                            ? "Sign in or create an account to manage your business."
                            : `Click the link sent to your email OR enter the 6-digit code below.`}
                    </CardDescription>
                </CardHeader>

                <CardContent className="pb-10 px-8">
                    {step === 1 ? (
                        <form onSubmit={handleEmailSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Business Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        type="email"
                                        placeholder="merchant@example.com"
                                        className="pl-10 h-14 rounded-xl bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-lg"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <Button
                                type="submit"
                                className="w-full h-14 text-lg rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                                    <>Continue with Email <ArrowRight className="w-5 h-5 ml-2" /></>
                                )}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleOtpSubmit} className="space-y-8">
                            <div className="flex justify-between gap-2 sm:gap-4" dir="ltr">
                                {otp.map((digit, index) => (
                                    <Input
                                        key={index}
                                        id={`otp-${index}`}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(index, e.target.value.replace(/[^0-9]/g, ''))}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-black rounded-xl bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-blue-500"
                                        autoFocus={index === 0}
                                    />
                                ))}
                            </div>
                            <div className="space-y-4">
                                <Button
                                    type="submit"
                                    className="w-full h-14 text-lg rounded-xl font-bold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 shadow-xl"
                                    disabled={isLoading || otp.join('').length < 6}
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Verify Code"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => handleEmailSubmit({ preventDefault: () => { } })}
                                    className="w-full text-blue-600 font-bold hover:text-blue-700 hover:bg-blue-50"
                                    disabled={isLoading}
                                >
                                    Resend Magic Link
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setStep(1)}
                                    className="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                >
                                    Use a different email
                                </Button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
