'use client';

import React, { createContext, useContext } from 'react';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { BusinessDataProvider, useBusinessData } from './providers/BusinessDataProvider';
import { UIProvider, useUI } from './providers/UIProvider';

// Re-export gamification helpers for backward compatibility
export { calculateTier, getRandomCommunityTitle } from './helpers/gamification';

const TagdeerContext = createContext();

/**
 * Compatibility shim: combines all three providers into one context
 * so that all 44+ consumer files can continue using `useTagdeer()`
 * without any changes.
 */
function TagdeerBridge({ children }) {
    const auth = useAuth();
    const businessData = useBusinessData();
    const ui = useUI();

    return (
        <TagdeerContext.Provider value={{
            ...auth,
            ...businessData,
            ...ui,
        }}>
            {children}
        </TagdeerContext.Provider>
    );
}

export function TagdeerProvider({ children }) {
    return (
        <AuthProvider>
            <BusinessDataProvider>
                <UIProvider>
                    <TagdeerBridge>
                        {children}
                    </TagdeerBridge>
                </UIProvider>
            </BusinessDataProvider>
        </AuthProvider>
    );
}

export const useTagdeer = () => useContext(TagdeerContext);
