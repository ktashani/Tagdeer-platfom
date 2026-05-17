'use client';

import React, { useState, useEffect } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { calculateVoteWeight } from '@/lib/trustEngine';
import { useVoteSubmission } from '@/hooks/useVoteSubmission';
import { Navigation } from '@/components/Navigation/Navigation';
import { VoteModal } from '@/components/Modals/VoteModal';
import { PreRegModal } from '@/components/Modals/PreRegModal';
import { LimitModal } from '@/components/Modals/LimitModal';
import { VerifySoonModal } from '@/components/Modals/VerifySoonModal';
import { LoginModal } from '@/components/Auth/LoginModal';
import { CouponAwardModal } from '@/components/consumer/CouponAwardModal';
import { PhoneVerifyPrompt } from '@/components/Auth/PhoneVerifyPrompt';
import { Toast } from '@/components/Toast';
import { BadgeCheck } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Footer } from '@/components/Footer';

export default function ClientLayout({ children }) {
    const {
        lang, setLang, t, isRTL,
        businesses, setBusinesses, supabase,
        anonInteractions, setAnonInteractions,
        showLimitModal, setShowLimitModal,
        toastMessage, setToastMessage, showToast,
        voteModal, setVoteModal,
        voteReason, setVoteReason,
        showVerifySoonModal, setShowVerifySoonModal,
        showPreRegModal, setShowPreRegModal,
        user, setUser
    } = useTagdeer();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [globalImpactBubble, setGlobalImpactBubble] = useState(null);
    const [awardModalData, setAwardModalData] = useState(null);
    const [showPhoneVerify, setShowPhoneVerify] = useState(false);

    useEffect(() => {
        const handleVoteEvent = (e) => {
            setGlobalImpactBubble(e.detail);
            setTimeout(() => setGlobalImpactBubble(null), 2000);
        };
        const handleCouponEvent = (e) => {
            setAwardModalData(e.detail);
        };
        
        window.addEventListener('trust-ledger-vote', handleVoteEvent);
        window.addEventListener('trust-ledger-coupon', handleCouponEvent);
        return () => {
            window.removeEventListener('trust-ledger-vote', handleVoteEvent);
            window.removeEventListener('trust-ledger-coupon', handleCouponEvent);
        };
    }, []);

    const { submitVote } = useVoteSubmission({
        user, supabase, lang,
        anonInteractions, setAnonInteractions,
        setUser, showToast, setShowLimitModal, setBusinesses
    });
    const router = useRouter();
    const pathname = usePathname();

    const currentPage = pathname === '/' ? 'home' : pathname.substring(1);

    const navigateTo = (page) => {
        setIsMobileMenuOpen(false);
        if (page === 'home') router.push('/');
        else router.push(`/${page}`);
    };




    return (
        <div className={`min-h-screen flex flex-col font-sans bg-slate-50 text-slate-800 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
            <Navigation
                lang={lang}
                setLang={setLang}
                t={t}
                isRTL={isRTL}
                currentPage={currentPage}
                navigateTo={navigateTo}
                isMobileMenuOpen={isMobileMenuOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
                setShowVerifySoonModal={setShowVerifySoonModal}
            />

            <main className="flex-grow">
                {children}
            </main>

            <Footer t={t} />

            <VoteModal
                isOpen={voteModal.isOpen}
                onClose={() => setVoteModal({ isOpen: false, businessId: null, type: null })}
                voteReason={voteReason}
                setVoteReason={setVoteReason}
                onSubmit={async () => {
                    const { businessId, type } = voteModal;
                    const targetBusiness = businesses.find(b => b.id === businessId);
                    const result = await submitVote(businessId, type, voteReason, targetBusiness?.isClaimed);
                    setVoteModal({ isOpen: false, businessId: null, type: null });
                    // If phone verification required, show the prompt
                    if (result && result.error === 'phone_verification_required') {
                        setShowPhoneVerify(true);
                    }
                }}
                t={t}
                type={voteModal.type}
                isAnonymous={!user}
                lang={lang}
            />

            {/* Adding a placeholder for PreRegModal state, we'll recreate the state if needed locally or inside modal later */}
            <WrappedPreRegModal
                isOpen={showPreRegModal}
                onClose={() => setShowPreRegModal(false)}
                t={t}
                showToast={showToast}
                supabase={supabase}
            />

            <LimitModal
                isOpen={showLimitModal}
                onClose={() => setShowLimitModal(false)}
                t={t}
            />

            <VerifySoonModal
                isOpen={showVerifySoonModal}
                onClose={() => setShowVerifySoonModal(false)}
                t={t}
            />

            <LoginModal />

            <PhoneVerifyPrompt
                isOpen={showPhoneVerify}
                onClose={() => setShowPhoneVerify(false)}
                onVerified={(verifiedPhone) => {
                    if (user) {
                        setUser(prev => prev ? { ...prev, phone: verifiedPhone, phone_verified: true } : prev);
                    }
                    setShowPhoneVerify(false);
                    showToast(lang === 'ar' ? 'تم التحقق من رقم هاتفك بنجاح! 🎉' : 'Phone verified successfully! 🎉');
                }}
            />

            <Toast message={toastMessage} onClose={() => setToastMessage('')} />

            {/* Impact Bubble Animation */}
            {globalImpactBubble && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] animate-impact-bubble">
                    <div className={`px-5 py-3 rounded-2xl shadow-lg font-bold text-lg flex items-center gap-2 backdrop-blur-sm ${globalImpactBubble.type === 'recommend'
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-rose-500/90 text-white'
                        }`}>
                        <span className="text-2xl">{globalImpactBubble.type === 'recommend' ? '👍' : '👎'}</span>
                        <span>+{globalImpactBubble.weight}x Impact</span>
                    </div>
                </div>
            )}

            {/* Coupon Award Modal */}
            <CouponAwardModal
                isOpen={!!awardModalData}
                onClose={() => setAwardModalData(null)}
                data={awardModalData}
                t={t}
                isRTL={isRTL}
                showToast={showToast}
            />
        </div>
    );
}

function WrappedPreRegModal({ isOpen, onClose, t, showToast, supabase }) {
    const [preRegData, setPreRegData] = useState({ name: '', phone: '', bizName: '' });

    const handleSubmit = async () => {
        if (!preRegData.name || !preRegData.phone || !preRegData.bizName) {
            showToast(t('prereg_fill_all'));
            return;
        }

        if (supabase) {
            try {
                const { error } = await supabase.from('pre_registrations').insert([
                    {
                        owner_name: preRegData.name,
                        phone_number: preRegData.phone,
                        business_name: preRegData.bizName
                    }
                ]);

                if (error) {
                    console.error("Pre-registration error:", error);
                    showToast(t('prereg_error') + ": " + error.message);
                    return;
                }

                showToast(t('prereg_success'));
                onClose();
                setPreRegData({ name: '', phone: '', bizName: '' });
            } catch (err) {
                console.error(err);
                showToast(t('prereg_error'));
            }
        }
    };

    return (
        <PreRegModal
            isOpen={isOpen}
            onClose={onClose}
            preRegData={preRegData}
            setPreRegData={setPreRegData}
            onSubmit={handleSubmit}
            t={t}
        />
    );
}
