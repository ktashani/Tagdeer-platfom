'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTagdeer } from '@/context/TagdeerContext';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
    const router = useRouter();
    const { supabase, login, lang } = useTagdeer();
    const [statusText, setStatusText] = useState(lang === 'ar' ? 'جاري التحقق...' : 'Verifying...');

    useEffect(() => {
        if (!supabase) return;

        let isMounted = true;
        let authListener;

        const handleAuth = async () => {
            try {
                // Check if we already have a session (Supabase client might have already parsed the hash)
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) throw sessionError;

                if (session?.user?.email) {
                    if (isMounted) setStatusText(lang === 'ar' ? 'تم تسجيل الدخول، جارِ التوجيه...' : 'Logged in, redirecting...');
                    // Automatically log them into our TagdeerContext system
                    await login(session.user.email);
                    if (isMounted) router.push('/');
                    return;
                }

                // If no session yet, listen for the SIGNED_IN event (Supabase might still be parsing the URL)
                const subscription = supabase.auth.onAuthStateChange(async (event, newSession) => {
                    if (event === 'SIGNED_IN' && newSession?.user?.email) {
                        if (isMounted) setStatusText(lang === 'ar' ? 'تم تسجيل الدخول، جارِ التوجيه...' : 'Logged in, redirecting...');
                        await login(newSession.user.email);
                        if (isMounted) router.push('/');
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
    }, [supabase, login, router, lang]);

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
