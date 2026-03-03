"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTagdeer } from '@/context/TagdeerContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, KeyRound, Lock, ArrowRight, Loader2, Eye, EyeOff, Info } from 'lucide-react';
import { toast } from 'sonner';
import SetPasswordPrompt from '@/components/merchant/SetPasswordPrompt';

export default function MerchantLogin() {
    // Steps: 'email' → 'password' | 'otp' → 'set-password'
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingPassword, setIsCheckingPassword] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const {
        loginWithEmail, verifyEmailOtp, loginWithPassword,
        setMerchantPassword, user, loading, logout
    } = useTagdeer();

    // Detect if user was redirected here because they need a merchant account
    const merchantRequired = searchParams.get('reason') === 'merchant_required';

    // Auto-redirect if already logged in as merchant (only merchant — not admin or consumer)
    useEffect(() => {
        if (!loading && user && user.role === 'merchant') {
            // If they just verified via OTP and don't have a password, show set-password prompt
            if (step === 'set-password') return;
            router.push('/merchant/dashboard');
        }
    }, [user, loading, router, step]);

    /**
     * Step 1: Email submit → check if merchant has a password set
     */
    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        if (!email.includes('@')) {
            toast.error("Please enter a valid email address");
            return;
        }

        setIsCheckingPassword(true);
        try {
            // Check if this email has a password set
            const res = await fetch('/api/merchant/check-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const { hasPassword } = await res.json();

            if (hasPassword) {
                setStep('password');
            } else {
                // No password → go to OTP flow
                setIsLoading(true);
                await loginWithEmail(email, 'merchant');
                setStep('otp');
            }
        } catch (err) {
            // If check fails, fall back to OTP
            try {
                setIsLoading(true);
                await loginWithEmail(email, 'merchant');
                setStep('otp');
            } catch {
                // Error handled by context toast
            }
        } finally {
            setIsLoading(false);
            setIsCheckingPassword(false);
        }
    };

    /**
     * Step 2a: Password login
     */
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!password) {
            toast.error("Please enter your password");
            return;
        }

        setIsLoading(true);
        try {
            await loginWithPassword(email, password);
            router.push('/merchant/dashboard');
        } catch (err) {
            // Error handled by context toast
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * "Forgot password?" → switch to OTP flow
     */
    const handleForgotPassword = async () => {
        setIsLoading(true);
        try {
            await loginWithEmail(email, 'merchant');
            setStep('otp');
            toast.info("Verification code sent. After verifying, you can reset your password.");
        } catch (err) {
            // Error handled by context toast
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * OTP input handling
     */
    const handleOtpChange = (index, value) => {
        if (value.length > 1) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

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

    /**
     * Step 2b: OTP verification → redirect or show set-password prompt
     */
    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length < 6) {
            toast.error("Please enter the full 6-digit code");
            return;
        }

        setIsLoading(true);
        try {
            await verifyEmailOtp(email, code);
            // After OTP verification, show set-password prompt
            setStep('set-password');
        } catch (err) {
            // Error handled by context toast
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Step 3: Set password after first OTP login
     */
    const handleSetPassword = async (newPassword) => {
        await setMerchantPassword(newPassword);
        router.push('/merchant/dashboard');
    };

    const handleSkipPassword = () => {
        router.push('/merchant/dashboard');
    };

    // --- Step 3: Set Password Prompt (full-screen component) ---
    if (step === 'set-password') {
        return (
            <SetPasswordPrompt
                onSetPassword={handleSetPassword}
                onSkip={handleSkipPassword}
            />
        );
    }

    // --- Utility: get step title & description ---
    const getStepContent = () => {
        switch (step) {
            case 'email':
                return {
                    icon: <Mail className="w-7 h-7" />,
                    title: 'Welcome Back',
                    description: 'Sign in or create an account to manage your business.',
                    iconBg: 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 border-blue-100 dark:border-blue-800',
                };
            case 'password':
                return {
                    icon: <Lock className="w-7 h-7" />,
                    title: 'Enter Your Password',
                    description: `Signing in as ${email}`,
                    iconBg: 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 border-indigo-100 dark:border-indigo-800',
                };
            case 'otp':
                return {
                    icon: <KeyRound className="w-7 h-7" />,
                    title: 'Check Your Email',
                    description: 'Click the link sent to your email OR enter the 6-digit code below.',
                    iconBg: 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 border-blue-100 dark:border-blue-800',
                };
            default:
                return { icon: null, title: '', description: '', iconBg: '' };
        }
    };

    const { icon, title, description, iconBg } = getStepContent();

    return (
        <div className="flex items-center justify-center min-h-[80vh] px-4 animate-in fade-in duration-500">
            <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden relative">

                {/* Decorative top bar */}
                <div className="h-2 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 absolute top-0 left-0"></div>

                <CardHeader className="pt-10 pb-6 text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${iconBg}`}>
                        {icon}
                    </div>
                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
                        {title}
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-base mt-2">
                        {description}
                    </CardDescription>
                </CardHeader>

                <CardContent className="pb-10 px-8">

                    {/* Info banner when redirected from a protected merchant route */}
                    {merchantRequired && step === 'email' && (
                        <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Merchant Account Required</p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Please sign in with your merchant email to access the business portal. Admin and consumer accounts cannot be used here.</p>
                                {user && (
                                    <button
                                        onClick={() => logout()}
                                        className="mt-2 text-xs font-bold text-blue-700 dark:text-blue-300 underline hover:text-blue-900"
                                    >
                                        Sign out of current account first
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ========== STEP: EMAIL ========== */}
                    {step === 'email' && (
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
                                        id="merchant-email"
                                    />
                                </div>
                            </div>
                            <Button
                                type="submit"
                                className="w-full h-14 text-lg rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                                disabled={isLoading || isCheckingPassword}
                                id="merchant-email-submit"
                            >
                                {(isLoading || isCheckingPassword) ? (
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                ) : (
                                    <>Continue with Email <ArrowRight className="w-5 h-5 ml-2" /></>
                                )}
                            </Button>
                        </form>
                    )}

                    {/* ========== STEP: PASSWORD ========== */}
                    {step === 'password' && (
                        <form onSubmit={handlePasswordSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        className="pl-10 pr-12 h-14 rounded-xl bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-lg"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoFocus
                                        id="merchant-password"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <Button
                                type="submit"
                                className="w-full h-14 text-lg rounded-xl font-bold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 shadow-xl"
                                disabled={isLoading}
                                id="merchant-password-submit"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Sign In"}
                            </Button>
                            <div className="space-y-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleForgotPassword}
                                    className="w-full text-blue-600 font-bold hover:text-blue-700 hover:bg-blue-50"
                                    disabled={isLoading}
                                    id="forgot-password"
                                >
                                    Forgot password?
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => { setStep('email'); setPassword(''); }}
                                    className="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    id="use-different-email"
                                >
                                    Use a different email
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* ========== STEP: OTP ========== */}
                    {step === 'otp' && (
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
                                    id="otp-submit"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Verify Code"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => handleEmailSubmit({ preventDefault: () => { } })}
                                    className="w-full text-blue-600 font-bold hover:text-blue-700 hover:bg-blue-50"
                                    disabled={isLoading}
                                    id="resend-otp"
                                >
                                    Resend Magic Link
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); }}
                                    className="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    id="change-email"
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
