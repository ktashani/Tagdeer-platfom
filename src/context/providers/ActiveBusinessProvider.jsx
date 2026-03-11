'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';

const ActiveBusinessContext = createContext();

export function ActiveBusinessProvider({ children }) {
    const { user, businesses, loading } = useTagdeer();
    const [selectedBusinessId, setSelectedBusinessId] = useState(null);

    // Businesses are loading if:
    // 1. Auth is still loading (user hasn't resolved), OR
    // 2. Auth resolved but businesses array is still empty AND we haven't
    //    had enough time for BusinessDataProvider to fetch.
    // We use a simple heuristic: if user exists and businesses is empty,
    // assume loading for a grace period.
    const [businessFetchGrace, setBusinessFetchGrace] = useState(true);

    useEffect(() => {
        if (!user || businesses.length > 0) {
            setBusinessFetchGrace(false);
            return;
        }
        // Give BusinessDataProvider up to 3s to fetch before we consider
        // the empty array as "user truly has no businesses"
        const timer = setTimeout(() => setBusinessFetchGrace(false), 3000);
        return () => clearTimeout(timer);
    }, [user, businesses.length]);

    const isLoadingBusinesses = loading || (!!user && businesses.length === 0 && businessFetchGrace);

    // Filter to businesses owned/claimed by the current user
    const myBusinesses = useMemo(() => {
        if (!businesses || !user) return [];
        return businesses.filter(b => b.owner_id === user.id || b.claimed_by === user?.id);
    }, [businesses, user]);

    // Auto-select first business when list populates and nothing is selected
    useEffect(() => {
        if (myBusinesses.length > 0 && !selectedBusinessId) {
            setSelectedBusinessId(myBusinesses[0].id);
        }
    }, [myBusinesses, selectedBusinessId]);

    // Derive the active business object from the selected ID
    const activeBusiness = useMemo(() => {
        return myBusinesses.find(b => b.id === selectedBusinessId) || myBusinesses[0] || null;
    }, [myBusinesses, selectedBusinessId]);

    return (
        <ActiveBusinessContext.Provider value={{
            activeBusiness,
            myBusinesses,
            selectedBusinessId,
            setSelectedBusinessId,
            isLoadingBusinesses
        }}>
            {children}
        </ActiveBusinessContext.Provider>
    );
}

export const useActiveBusiness = () => useContext(ActiveBusinessContext);
