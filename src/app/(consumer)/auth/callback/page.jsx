'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTagdeer } from '@/context/TagdeerContext';
import { Loader2 } from 'lucide-react';

function AuthCallbackInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { supabase, login, lang } = useTagdeer();
    const [statusText, setStatusText] = useState(lang === 'ar' ? 'جاري التحقق...' : 'Verifying...');

    // Detect if the user came from the merchant login flow
    const fromMerchant = searchParams.get('from') === 'merchant';

    useEffect(() => {
        if (!supabase) return;

        let isMounted = true;
        let authListener;

        // Helper to decide where to redirect based on role + origin
        const getRedirectPath = (role) => {
            if (role === 'admin') return '/admin';
            if (role === 'merchant') return '/merchant/dashboard';
            // User role: if they came from merchant login, send to onboarding
            if (fromMerchant) return '/merchant/onboarding';
            return '/';
        };

        const handleAuth = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) throw sessionError;

                if (session?.user?.email) {
                    if (isMounted) setStatusText(lang === 'ar' ? 'تم تسجيل الدخول، جارِ التوجيه...' : 'Logged in, redirecting...');

                    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();

                    if (isMounted) {
                        router.push(getRedirectPath(profile?.role));
                    }
                    return;
                }

                const subscription = supabase.auth.onAuthStateChange(async (event, newSession) => {
                    if (event === 'SIGNED_IN' && newSession?.user?.email) {
                        if (isMounted) setStatusText(lang === 'ar' ? 'تم تسجيل الدخول، جارِ التوجيه...' : 'Logged in, redirecting...');

                        const { data: profile } = await supabase.from('profiles').select('role').eq('id', newSession.user.id).single();

                        if (isMounted) {
                            router.push(getRedirectPath(profile?.role));
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
