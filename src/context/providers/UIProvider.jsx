'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

const UIContext = createContext();

export function UIProvider({ children }) {
    const { supabase } = useAuth();

    const [anonInteractions, setAnonInteractions] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('trust_ledger_interactions');
            return stored ? parseInt(stored) : 0;
        }
        return 0;
    });

    const [showLimitModal, setShowLimitModal] = useState(false);
    const [voteModal, setVoteModal] = useState({ isOpen: false, businessId: null, type: null });
    const [voteReason, setVoteReason] = useState('');
    const [showVerifySoonModal, setShowVerifySoonModal] = useState(false);
    const [showPreRegModal, setShowPreRegModal] = useState(false);

    useEffect(() => {
        const storedInteractions = localStorage.getItem('trust_ledger_interactions');
        if (storedInteractions) setAnonInteractions(parseInt(storedInteractions));
    }, []);

    const refreshAnonInteractions = async () => {
        if (!supabase) return;
        const { getDeviceFingerprint } = await import('../../lib/fingerprint');
        const fingerprint = getDeviceFingerprint();
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        try {
            const { count, error } = await supabase
                .from('logs')
                .select('*', { count: 'exact', head: true })
                .eq('fingerprint', fingerprint)
                .gte('created_at', sevenDaysAgo);

            if (!error && count !== null) {
                setAnonInteractions(count);
                localStorage.setItem('trust_ledger_interactions', count.toString());
                return count;
            }
        } catch (e) {
            console.error("Failed to sync anon interactions:", e);
        }
        return anonInteractions;
    };

    return (
        <UIContext.Provider value={{
            anonInteractions, setAnonInteractions, refreshAnonInteractions,
            showLimitModal, setShowLimitModal,
            voteModal, setVoteModal,
            voteReason, setVoteReason,
            showVerifySoonModal, setShowVerifySoonModal,
            showPreRegModal, setShowPreRegModal,
        }}>
            {children}
        </UIContext.Provider>
    );
}

export const useUI = () => useContext(UIContext);
