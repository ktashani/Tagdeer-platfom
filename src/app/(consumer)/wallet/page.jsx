"use client";

import { useTagdeer } from "@/context/TagdeerContext";
import { useEffect } from "react";
import { WalletTab } from "@/components/profile/WalletTab";
import { Wallet } from "lucide-react";

export default function WalletPage() {
    const { user, lang, setShowLoginModal } = useTagdeer();

    useEffect(() => {
        if (user === null) {
            // Give context time to load, then prompt login if still null
            const timer = setTimeout(() => {
                setShowLoginModal(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [user, setShowLoginModal]);

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
                <Wallet className="w-16 h-16 text-slate-300 mb-4" />
                <h2 className="text-xl font-bold mb-2">
                    {lang === 'ar' ? 'سجل الدخول لعرض محفظتك' : 'Log in to view your wallet'}
                </h2>
                <p className="text-slate-500 mb-6">
                    {lang === 'ar' ? 'يجب تسجيل الدخول لرؤية القسائم الخاصة بك.' : 'You must be logged in to see your coupons.'}
                </p>
                <button 
                    onClick={() => setShowLoginModal(true)}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                    {lang === 'ar' ? 'تسجيل الدخول' : 'Log In'}
                </button>
            </div>
        );
    }

    return (
        <div className="container max-w-4xl mx-auto py-8 px-4">
            <WalletTab />
        </div>
    );
}

