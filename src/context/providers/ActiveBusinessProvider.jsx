'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';

const ActiveBusinessContext = createContext();

export function ActiveBusinessProvider({ children }) {
    const { user, businesses } = useTagdeer();
    const [selectedBusinessId, setSelectedBusinessId] = useState(null);

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
            setSelectedBusinessId
        }}>
            {children}
        </ActiveBusinessContext.Provider>
    );
}

export const useActiveBusiness = () => useContext(ActiveBusinessContext);
