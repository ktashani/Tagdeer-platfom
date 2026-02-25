'use client';

import React, { useState } from 'react';
import { useTagdeer } from '../context/TagdeerContext';
import { getDeviceFingerprint } from '../lib/fingerprint';
import { calculateVoteWeight } from '../lib/trustEngine';
import { Navigation } from '../components/Navigation/Navigation';
import { VoteModal } from '../components/Modals/VoteModal';
import { PreRegModal } from '../components/Modals/PreRegModal';
import { LimitModal } from '../components/Modals/LimitModal';
import { VerifySoonModal } from '../components/Modals/VerifySoonModal';
import { LoginModal } from '../components/Auth/LoginModal';
import { Toast } from '../components/Toast';
import { Facebook, Twitter, BadgeCheck } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

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
                <div className="flex flex-col items-center md:items-end gap-2">
                    <Link href="/privacy" className="text-sm hover:text-white transition-colors">
                        Privacy Policy | سياسة الخصوصية
                    </Link>
                    <p className="text-sm">© 2026 Tagdeer Libya.</p>
                </div>
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
        showPreRegModal, setShowPreRegModal,
        user
    } = useTagdeer();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [impactBubble, setImpactBubble] = useState(null); // { weight: number, type: string }
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
        const fingerprint = getDeviceFingerprint();
        let weight = calculateVoteWeight(user, 0); // default for offline

        if (supabase) {
            try {
                // ── Step 1: 24-Hour Same-Business Cooldown ──────────────
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

                // Build the full query in one chain to avoid mutation issues
                const cooldownQuery = user?.id
                    ? supabase.from('logs').select('*', { count: 'exact', head: true })
                        .eq('business_id', businessId)
                        .eq('profile_id', user.id)
                        .gte('created_at', twentyFourHoursAgo)
                    : supabase.from('logs').select('*', { count: 'exact', head: true })
                        .eq('business_id', businessId)
                        .eq('fingerprint', fingerprint)
                        .gte('created_at', twentyFourHoursAgo);

                const { count: recentCount, error: cooldownErr } = await cooldownQuery;

                if (!cooldownErr && recentCount > 0) {
                    showToast(lang === 'ar'
                        ? 'لقد قيّمت هذا النشاط مؤخرًا. يرجى الانتظار 24 ساعة قبل تسجيل تجربة أخرى هنا.'
                        : 'You recently evaluated this business. Please wait 24 hours before logging another experience here.'
                    );
                    setVoteModal({ isOpen: false, businessId: null, type: null });
                    return;
                }

                // ── Step 2: Diminishing Returns (30-day count) ──────────
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

                const diminishingQuery = user?.id
                    ? supabase.from('logs').select('*', { count: 'exact', head: true })
                        .eq('business_id', businessId)
                        .eq('profile_id', user.id)
                        .gte('created_at', thirtyDaysAgo)
                    : supabase.from('logs').select('*', { count: 'exact', head: true })
                        .eq('business_id', businessId)
                        .eq('fingerprint', fingerprint)
                        .gte('created_at', thirtyDaysAgo);

                const { count: pastVoteCount, error: dimErr } = await diminishingQuery;
                const safeCount = (!dimErr && pastVoteCount) ? pastVoteCount : 0;

                // ── Step 3: Calculate Dynamic Weight ────────────────────
                weight = calculateVoteWeight(user, safeCount);

                // ── Step 4: Insert with weight ─────────────────────────
                const { error } = await supabase.from('logs').insert([{
                    business_id: businessId,
                    interaction_type: type,
                    reason_text: voteReason,
                    profile_id: user?.id || null,
                    fingerprint: fingerprint,
                    weight: weight
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

        // Award +10 Gader Points to verified users
        if (user?.id && supabase) {
            try {
                const newPoints = (user.gader || 0) + 10;
                await supabase
                    .from('profiles')
                    .update({ gader_points: newPoints })
                    .eq('id', user.id);
                // Update local state so UI reflects immediately
                user.gader = newPoints;
            } catch (e) {
                console.error('Error awarding points:', e);
            }
        }

        // Only track anonymous vote count for non-verified users
        if (!user) {
            const newCount = anonInteractions + 1;
            setAnonInteractions(newCount);
            localStorage.setItem('trust_ledger_interactions', newCount.toString());
        }

        setBusinesses(businesses.map(b => {
            if (b.id === businessId) {
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

        // Trigger Impact Bubble animation
        setImpactBubble({ weight, type });
        setTimeout(() => setImpactBubble(null), 2000);

        if (user) {
            showToast(lang === 'ar' ? 'تم تسجيل تقييمك بنجاح!' : 'Vote logged successfully!');
        } else {
            const remaining = 3 - anonInteractions - 1;
            showToast(`Successfully logged. (${remaining} anonymous logs remaining)`);
        }
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

            {/* Impact Bubble Animation */}
            {impactBubble && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] animate-impact-bubble">
                    <div className={`px-5 py-3 rounded-2xl shadow-lg font-bold text-lg flex items-center gap-2 backdrop-blur-sm ${impactBubble.type === 'recommend'
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-rose-500/90 text-white'
                        }`}>
                        <span className="text-2xl">{impactBubble.type === 'recommend' ? '👍' : '👎'}</span>
                        <span>+{impactBubble.weight}x Impact</span>
                    </div>
                </div>
            )}
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
