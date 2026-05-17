"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTagdeer } from '@/context/TagdeerContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, KeyRound, Lock, ArrowRight, Loader2, Eye, EyeOff, Info, Facebook } from 'lucide-react';
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
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [fbLoading, setFbLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const {
        loginWithEmail, verifyEmailOtp, loginWithPassword,
        setMerchantPassword, user, loading, logout, supabase, setUser, lang = 'en'
    } = useTagdeer();

    // Detect if user was redirected here because they need a merchant account
    const merchantRequired = searchParams.get('reason') === 'merchant_required';
    // Capture any trial campaign parameter to persist it through the onboarding flow
    const trialCampaign = searchParams.get('trial_campaign');

    const navigateForward = (path) => {
        if (trialCampaign) {
            router.push(`${path}?trial_campaign=${trialCampaign}`);
        } else {
            router.push(path);
        }
    };

    // Auto-redirect if already logged in as merchant (only merchant — not admin or consumer)
    // Uses window.location.href (not router.push) so middleware rewrites
    // /dashboard → /merchant/dashboard on the subdomain.
    // The isRedirecting guard prevents the useEffect from firing multiple times
    // during the auth state machine's SIGNED_IN → syncUserProfile transition.
    useEffect(() => {
        if (isRedirecting) return;
        if (!loading && user && user.role === 'merchant') {
            if (step === 'set-password') return;
            setIsRedirecting(true);
            const dashPath = trialCampaign ? `/dashboard?trial_campaign=${trialCampaign}` : '/dashboard';
            window.location.href = dashPath;
        }
    }, [user, loading, step, trialCampaign, isRedirecting]);

    /**
     * Step 1: Email submit → check if merchant has a password set
     * 
     * CRITICAL LOGIC:
     * - If user has a password → show password step
     * - If user exists but no password → STILL show password step (with "Send code" option)
     * - If user doesn't exist → ALSO show password step for signup flow
     * - NEVER auto-send magic link/OTP from email step (prevents rate limits + redirect confusion)
     * 
     * The user explicitly chooses to receive a code via "Send verification code" button.
     */
    const [hasExistingPassword, setHasExistingPassword] = useState(false);
    const [userExists, setUserExists] = useState(false);

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        if (!email.includes('@')) {
            toast.error("Please enter a valid email address");
            return;
        }

        setIsCheckingPassword(true);
        try {
            const res = await fetch('/api/merchant/check-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = await res.json();
            setHasExistingPassword(data.hasPassword || false);
            setUserExists(data.userExists || false);

            if (data.hasPassword) {
                // User has a password → show password login step
                setStep('password');
            } else if (data.userExists) {
                // User exists but no password → show password step with "Send code" option
                // They can either try a password (if they set one via Supabase) or request a code
                setStep('password');
            } else {
                // Brand new user → send OTP to create their account
                try {
                    await loginWithEmail(email, 'merchant', trialCampaign);
                    setStep('otp');
                    toast.info("We sent a verification code to your email. Check your inbox.");
                } catch (otpErr) {
                    toast.error("Could not send verification code. Please try again.");
                }
            }
        } catch (err) {
            // If API check fails entirely, still show password step (safe fallback)
            setStep('password');
        } finally {
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
            // loginWithPassword signs in via Supabase Auth → onAuthStateChange handles profile sync
            // Then the auto-redirect useEffect above pushes to /merchant/dashboard
        } catch (err) {
            // Error toast handled by context
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * "Send verification code" — explicit user action to request OTP
     * This replaces the old "Forgot password?" → now covers both forgot + no-password scenarios
     */
    const handleSendCode = async () => {
        setIsLoading(true);
        try {
            await loginWithEmail(email, 'merchant', trialCampaign);
            setStep('otp');
            toast.info("Verification code sent to your email.");
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

            // Ensure the user gets merchant role after OTP verification
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                    await fetch('/api/merchant/init-role', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${session.access_token}` }
                    });
                    // Re-sync user profile to pick up the new role
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', session.user.id)
                        .single();
                    if (profile) {
                        setUser(prev => prev ? { ...prev, role: profile.role } : prev);
                    }
                }
            } catch (roleErr) {
                console.error('Failed to init merchant role after OTP:', roleErr);
                // Even if init-role fails, we still proceed — MerchantGuard will re-check
            }

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
        // setMerchantPassword may throw — SetPasswordPrompt catches it
        await setMerchantPassword(newPassword);
        // On success, use hard redirect to sync auth cookies + middleware
        const dashPath = trialCampaign ? `/dashboard?trial_campaign=${trialCampaign}` : '/dashboard';
        window.location.href = dashPath;
    };

    const handleSkipPassword = () => {
        const dashPath = trialCampaign ? `/dashboard?trial_campaign=${trialCampaign}` : '/dashboard';
        window.location.href = dashPath;
    };

    // Show a clean loading state during the redirect to prevent UI flashing
    if (isRedirecting) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Redirecting to dashboard...</p>
                </div>
            </div>
        );
    }

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
                    title: 'Welcome to Tagdeer',
                    description: merchantRequired
                        ? 'Enter a merchant email to sign in or create your account.'
                        : 'Sign in or sign up to manage your business reputation.',
                    titleAr: 'مرحبًا بك في تقدير',
                    descriptionAr: merchantRequired
                        ? 'أدخل بريدك الإلكتروني للدخول إلى حسابك أو إنشاء حساب جديد.'
                        : 'سجل دخولك أو أنشئ حسابًا لإدارة سمعة نشاطك التجاري.',
                };
            case 'password':
                return {
                    title: hasExistingPassword ? 'Enter Your Password' : 'Sign In',
                    description: hasExistingPassword
                        ? 'Enter the password for your merchant account.'
                        : 'Enter your password or request a verification code.',
                    titleAr: hasExistingPassword ? 'أدخل كلمة المرور' : 'تسجيل الدخول',
                    descriptionAr: hasExistingPassword
                        ? 'أدخل كلمة المرور الخاصة بحساب الشريك.'
                        : 'أدخل كلمة المرور أو اطلب رمز التحقق.',
                };
            case 'otp':
                return {
                    title: 'Verification Code',
                    description: `We sent a 6-digit code to ${email}. Enter it below.`,
                    titleAr: 'رمز التحقق',
                    descriptionAr: `أرسلنا رمزًا مكونًا من 6 أرقام إلى ${email}. أدخله أدناه.`,
                };
            default:
                return { title: '', description: '', titleAr: '', descriptionAr: '' };
        }
    };

    const { title, description, titleAr, descriptionAr } = getStepContent();

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB] p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold mb-6 shadow-lg">
                        <Lock className="w-4 h-4" />
                        Merchant Portal
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
                    <p className="text-slate-500">{description}</p>
                </div>

                <Card className="shadow-xl border-0 bg-white">
                    <CardContent className="pt-8 pb-8 px-6">

                        {/* Step 1: Email */}
                        {step === 'email' && (
                            <form onSubmit={handleEmailSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <Input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="your@email.com"
                                            className="pl-11 h-12 text-base border-slate-200"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl"
                                    disabled={isCheckingPassword || !email}
                                >
                                    {isCheckingPassword ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>Continue <ArrowRight className="ml-2 w-4 h-4" /></>
                                    )}
                                </Button>

                                {/* ── Divider ── */}
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                    <span className="text-xs text-slate-400 uppercase font-medium">or</span>
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                </div>

                                {/* ── Facebook Login Button ── */}
                                <button
                                    type="button"
                                    disabled={fbLoading}
                                    onClick={async () => {
                                        setFbLoading(true);
                                        try {
                                            const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
                                            const redirectOrigin = envSiteUrl || window.location.origin;
                                            const callbackUrl = `${redirectOrigin}/auth/callback?from=merchant${trialCampaign ? `&trial_campaign=${trialCampaign}` : ''}`;
                                            const { error: oauthErr } = await supabase.auth.signInWithOAuth({
                                                provider: 'facebook',
                                                options: {
                                                    redirectTo: callbackUrl,
                                                    scopes: 'public_profile,email',
                                                }
                                            });
                                            if (oauthErr) {
                                                console.error('Facebook OAuth error:', oauthErr);
                                                toast.error(oauthErr.message || 'Facebook login failed');
                                                setFbLoading(false);
                                            }
                                        } catch (err) {
                                            console.error('Facebook login exception:', err);
                                            toast.error('Connection error');
                                            setFbLoading(false);
                                        }
                                    }}
                                    className="w-full h-12 flex items-center justify-center gap-2.5 rounded-xl font-bold text-base text-white transition-all shadow-md hover:shadow-lg"
                                    style={{ backgroundColor: '#1877F2' }}
                                >
                                    {fbLoading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Facebook className="h-5 w-5" />
                                    )}
                                    Continue with Facebook
                                </button>
                            </form>
                        )}

                        {/* Step 2a: Password */}
                        {step === 'password' && (
                            <div className="space-y-6">
                                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                    {/* Show which email is being used */}
                                    <div className="bg-slate-50 rounded-lg px-4 py-3 flex items-center gap-3">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm text-slate-600 truncate flex-1">{email}</span>
                                        <button
                                            type="button"
                                            onClick={() => { setStep('email'); setPassword(''); }}
                                            className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                                        >
                                            Change
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Password</label>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Enter your password"
                                                className="pl-11 pr-11 h-12 text-base border-slate-200"
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl"
                                        disabled={isLoading || !password}
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>Sign In <ArrowRight className="ml-2 w-4 h-4" /></>
                                        )}
                                    </Button>
                                </form>

                                {/* Divider */}
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                    <span className="text-xs text-slate-400 uppercase font-medium">or</span>
                                    <div className="flex-1 h-px bg-slate-200"></div>
                                </div>

                                {/* Send verification code button — replaces "Forgot password?" */}
                                <button
                                    onClick={handleSendCode}
                                    disabled={isLoading}
                                    className="w-full h-12 border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Mail className="w-4 h-4" />
                                            Send verification code to my email
                                        </>
                                    )}
                                </button>

                                {!hasExistingPassword && (
                                    <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
                                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>If you haven't set a password yet, use the verification code option above. After verifying, you'll be prompted to set a password.</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 2b: OTP */}
                        {step === 'otp' && (
                            <form onSubmit={handleOtpSubmit} className="space-y-6">
                                {/* Show which email is being used */}
                                <div className="bg-slate-50 rounded-lg px-4 py-3 flex items-center gap-3">
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm text-slate-600 truncate">{email}</span>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700 text-center block">
                                        Enter the 6-digit code from your email
                                    </label>
                                    <div className="flex gap-2 justify-center" dir="ltr">
                                        {otp.map((digit, index) => (
                                            <Input
                                                key={index}
                                                id={`otp-${index}`}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={1}
                                                value={digit}
                                                onChange={(e) => handleOtpChange(index, e.target.value.replace(/\D/g, ''))}
                                                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                                className="w-12 h-14 text-center text-xl font-bold border-slate-200"
                                                autoFocus={index === 0}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl"
                                    disabled={isLoading || otp.join('').length < 6}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>Verify & Continue <ArrowRight className="ml-2 w-4 h-4" /></>
                                    )}
                                </Button>

                                <div className="text-center">
                                    <button
                                        type="button"
                                        onClick={handleSendCode}
                                        disabled={isLoading}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
                                    >
                                        Resend code
                                    </button>
                                    <span className="text-slate-300 mx-2">|</span>
                                    <button
                                        type="button"
                                        onClick={() => { setStep('password'); setOtp(['', '', '', '', '', '']); }}
                                        className="text-sm text-slate-500 hover:text-slate-700 font-medium"
                                    >
                                        Back to password
                                    </button>
                                </div>
                            </form>
                        )}

                    </CardContent>
                </Card>

                {/* Footer info */}
                <div className="text-center mt-6 space-y-3">
                    <p className="text-xs text-slate-400">
                        {lang === 'ar' 
                            ? <>بتسجيل الدخول، فإنك توافق على <a href="/terms" target="_blank" className="text-blue-600 hover:underline font-semibold">شروط الاستخدام</a> و <a href="/privacy" target="_blank" className="text-blue-600 hover:underline font-semibold">سياسة الخصوصية</a>.</>
                            : <>By signing in, you agree to Tagdeer's <a href="/terms" target="_blank" className="text-blue-600 hover:underline font-semibold">Terms of Service</a> and <a href="/privacy" target="_blank" className="text-blue-600 hover:underline font-semibold">Privacy Policy</a>.</>
                        }
                    </p>
                    {step === 'email' && (
                        <p className="text-sm text-slate-500">
                            Not a merchant?{' '}
                            <a href="/" className="text-blue-600 hover:text-blue-700 font-semibold">
                                Go to Consumer Platform
                            </a>
                        </p>
                    )}
                </div>

                {/* Prevent form flash from react hydration */}
                <form className="hidden" onSubmit={(e) => e.preventDefault()}></form>
            </div>
        </div>
    );
}
