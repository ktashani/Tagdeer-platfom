'use client';

import React, { useState } from 'react';
import { useTagdeer } from '../context/TagdeerContext';
import { Navigation } from '../components/Navigation/Navigation';
import { VoteModal } from '../components/Modals/VoteModal';
import { PreRegModal } from '../components/Modals/PreRegModal';
import { LimitModal } from '../components/Modals/LimitModal';
import { VerifySoonModal } from '../components/Modals/VerifySoonModal';
import { LoginModal } from '../components/Auth/LoginModal';
import { Toast } from '../components/Toast';
import { Facebook, Twitter, BadgeCheck } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

function Footer({ t }) {
    return (
        <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-2">
                    <BadgeCheck className="h-8 w-8 text-green-500" />
                    <span className="font-bold text-xl text-white">Tagdeer</span>
                </div>
                <div className="flex gap-4 items-center">
                    <a href="#" className="hover:text-white"><Facebook className="h-5 w-5" /></a>
                    <a href="#" className="hover:text-white"><Twitter className="h-5 w-5" /></a>
                </div>
                <p className="text-sm">© 2026 Tagdeer Libya.</p>
            </div>
        </footer>
    );
}

export function ClientLayout({ children }) {
    const {
        lang, setLang, t, isRTL,
        businesses, setBusinesses, supabase,
        anonInteractions, setAnonInteractions,
        showLimitModal, setShowLimitModal,
        toastMessage, setToastMessage, showToast,
        voteModal, setVoteModal,
        voteReason, setVoteReason,
        showVerifySoonModal, setShowVerifySoonModal,
        showPreRegModal, setShowPreRegModal
    } = useTagdeer();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    const currentPage = pathname === '/' ? 'home' : pathname.substring(1);

    const navigateTo = (page) => {
        setIsMobileMenuOpen(false);
        if (page === 'home') router.push('/');
        else router.push(`/${page}`);
    };

    const submitVote = async () => {
        const { businessId, type } = voteModal;

        if (supabase) {
            try {
                const { error } = await supabase.from('interactions').insert([{
                    business_id: businessId,
                    interaction_type: type,
                    reason_text: voteReason
                }]);

                if (error) {
                    console.error("Supabase insert error:", error);
                    showToast(lang === 'ar' ? "حدث خطأ: " + error.message : "Error: " + error.message);
                    return;
                }
            } catch (err) {
                console.error("Supabase insert exception:", err);
                showToast("Connection failed.");
                return;
            }
        }

        const newCount = anonInteractions + 1;
        setAnonInteractions(newCount);
        localStorage.setItem('trust_ledger_interactions', newCount.toString());

        setBusinesses(businesses.map(b => {
            if (b.id === businessId) {
                // Will be updated with math engine correctly, but for now simple fallback
                const newLog = {
                    id: Date.now(),
                    type: type,
                    text: voteReason || (type === 'recommend' ? 'User recommended' : 'User complained'),
                    date: new Date().toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en-US')
                };
                return {
                    ...b,
                    recommends: type === 'recommend' ? b.recommends + 1 : b.recommends,
                    complains: type === 'complain' ? b.complains + 1 : b.complains,
                    logs: [newLog, ...b.logs]
                };
            }
            return b;
        }));

        setVoteModal({ isOpen: false, businessId: null, type: null });
        showToast(`Successfully logged. (${3 - newCount} anonymous logs remaining)`);
    };

    const submitPreRegistration = async (preRegData, setPreRegData) => {
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
                setShowPreRegModal(false);
                setPreRegData({ name: '', phone: '', bizName: '' });
            } catch (err) {
                console.error(err);
                showToast(t('prereg_error'));
            }
        }
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
                onSubmit={submitVote}
                t={t}
                type={voteModal.type}
            />

            {/* Adding a placeholder for PreRegModal state, we'll recreate the state if needed locally or inside modal later */}
            <WrappedPreRegModal
                isOpen={showPreRegModal}
                onClose={() => setShowPreRegModal(false)}
                submitPreRegistration={submitPreRegistration}
                t={t}
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

            <Toast message={toastMessage} onClose={() => setToastMessage('')} />
        </div>
    );
}

function WrappedPreRegModal({ isOpen, onClose, submitPreRegistration, t }) {
    const [preRegData, setPreRegData] = useState({ name: '', phone: '', bizName: '' });

    return (
        <PreRegModal
            isOpen={isOpen}
            onClose={onClose}
            preRegData={preRegData}
            setPreRegData={setPreRegData}
            onSubmit={() => submitPreRegistration(preRegData, setPreRegData)}
            t={t}
        />
    );
}
