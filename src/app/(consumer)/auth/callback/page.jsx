'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTagdeer } from '@/context/TagdeerContext';
import { Loader2 } from 'lucide-react';

function AuthCallbackInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { supabase, login, lang, setUser } = useTagdeer();
    const [statusText, setStatusText] = useState(lang === 'ar' ? 'جاري التحقق...' : 'Verifying...');

    // Detect if the user came from the merchant login flow
    const fromMerchant = searchParams.get('from') === 'merchant';
    const nextPath = searchParams.get('next');
    const trialCampaign = searchParams.get('trial_campaign');

    useEffect(() => {
        if (!supabase) return;

        let isMounted = true;
        let authListener;

        // Helper to decide where to redirect based on role + origin
        const getRedirectPath = (role, event) => {
            // If there's an explicit next path (e.g. password reset), use it
            if (nextPath) return nextPath;
            let basePath;
            if (role === 'admin') basePath = '/admin';
            else if (role === 'merchant') basePath = '/merchant/dashboard';
            else if (fromMerchant) basePath = '/merchant/dashboard';
            else basePath = '/';
            // Append trial_campaign if present
            if (trialCampaign && basePath.startsWith('/merchant')) {
                return `${basePath}?trial_campaign=${trialCampaign}`;
            }
            return basePath;
        };

        // Helper to fetch profile with retries (solves race condition with auth triggers)
        const fetchProfileWithRetry = async (userId, maxRetries = 3) => {
            for (let i = 0; i < maxRetries; i++) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
                if (profile) return profile;
                await new Promise(r => setTimeout(r, 500)); // wait 500ms before retry
            }
            return null; // give up after retries
        };

        const handleAuth = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) throw sessionError;

                if (session?.user?.email) {
                    if (isMounted) setStatusText(lang === 'ar' ? 'تم تسجيل الدخول، جارِ التوجيه...' : 'Logged in, redirecting...');

                    // If coming from the merchant portal, ensure role is initialized to merchant
                    if (fromMerchant) {
                        try {
                            const initResp = await fetch('/api/merchant/init-role', {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${session.access_token}`
                                }
                            });
                            const result = await initResp.json();
                            if (!initResp.ok) {
                                console.error('init-role failed:', result);
                                alert(`Failed to assign merchant role: ${result.error}`);
                            } else {
                                console.log('init-role success:', result);
                            }
                        } catch (e) {
                            console.error('Failed to init merchant role:', e);
                        }
                    }

                    const profile = await fetchProfileWithRetry(session.user.id);

                    if (isMounted) {
                        if (profile) {
                            // Update TagdeerContext state with fresh profile so MerchantGuard sees correct role
                            setUser(prev => ({
                                ...prev,
                                id: session.user.id,
                                email: session.user.email,
                                role: profile.role,
                                full_name: profile.full_name || prev?.full_name,
                                status: profile.status || prev?.status,
                            }));
                            router.push(getRedirectPath(profile?.role));
                        } else {
                            // Fallback if profile trigger failed — guess based on 'from' param
                            router.push(getRedirectPath(fromMerchant ? 'merchant' : 'consumer'));
                        }
                    }
                    return;
                }

                const subscription = supabase.auth.onAuthStateChange(async (event, newSession) => {
                    if (event === 'SIGNED_IN' && newSession?.user?.email) {
                        if (isMounted) setStatusText(lang === 'ar' ? 'تم تسجيل الدخول، جارِ التوجيه...' : 'Logged in, redirecting...');

                        // If coming from the merchant portal, ensure role is initialized to merchant
                        if (fromMerchant) {
                            try {
                                const initResp = await fetch('/api/merchant/init-role', {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${newSession.access_token}`
                                    }
                                });
                                const result = await initResp.json();
                                if (!initResp.ok) {
                                    console.error('init-role failed:', result);
                                    alert(`Failed to assign merchant role: ${result.error}`);
                                } else {
                                    console.log('init-role success:', result);
                                }
                            } catch (e) {
                                console.error('Failed to init merchant role:', e);
                            }
                        }

                        const profile = await fetchProfileWithRetry(newSession.user.id);

                        if (isMounted) {
                            if (profile) {
                                // Update TagdeerContext state with fresh profile so MerchantGuard sees correct role
                                setUser(prev => ({
                                    ...prev,
                                    id: newSession.user.id,
                                    email: newSession.user.email,
                                    role: profile.role,
                                    full_name: profile.full_name || prev?.full_name,
                                    status: profile.status || prev?.status,
                                }));
                                router.push(getRedirectPath(profile?.role));
                            } else {
                                router.push(getRedirectPath(fromMerchant ? 'merchant' : 'consumer'));
                            }
                        }
                    }
                });

                authListener = subscription.data.subscription;

            } catch (err) {
                console.error('Error during auth callback:', err);
                if (isMounted) {
                    setStatusText(lang === 'ar' ? 'حدث خطأ أثناء تسجيل الدخول' : 'Error logging in');
                    setTimeout(() => router.push('/'), 3000);
                }
            }
        };

        handleAuth();

        return () => {
            isMounted = false;
            if (authListener) authListener.unsubscribe();
        };
    }, [supabase, login, router, lang, fromMerchant]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <h2 className="text-xl font-bold">{statusText}</h2>
            <p className="text-slate-500 mt-2 text-sm">
                {lang === 'ar' ? 'يرجى الانتظار بينما نقوم بإعداد حسابك...' : 'Please wait while we set up your account...'}
            </p>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <h2 className="text-xl font-bold">Verifying...</h2>
            </div>
        }>
            <AuthCallbackInner />
        </Suspense>
    );
}
