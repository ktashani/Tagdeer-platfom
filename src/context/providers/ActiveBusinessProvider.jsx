'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';

const ActiveBusinessContext = createContext();

export function ActiveBusinessProvider({ children }) {
    const { user, businesses, loading, supabase } = useTagdeer();
    const [selectedBusinessId, setSelectedBusinessId] = useState(null);
    const [claimStatuses, setClaimStatuses] = useState({}); // { businessId: 'pending' | 'approved' | 'rejected' | 'missing_docs' }
    const [claimedBusinessIds, setClaimedBusinessIds] = useState([]); // business IDs from business_claims

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

    // Fetch claim statuses from business_claims table
    // This tells us which businesses the user has claimed (even if not yet approved)
    useEffect(() => {
        if (!supabase || !user) return;

        const fetchClaimStatuses = async () => {
            try {
                const { data } = await supabase
                    .from('business_claims')
                    .select('business_id, status, claim_status')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (data) {
                    const statusMap = {};
                    const claimBizIds = [];
                    data.forEach(c => {
                        // Only store the first (most recent) claim per business
                        if (!statusMap[c.business_id]) {
                            statusMap[c.business_id] = c.status || c.claim_status || 'pending';
                            claimBizIds.push(c.business_id);
                        }
                    });
                    setClaimStatuses(statusMap);
                    setClaimedBusinessIds(claimBizIds);
                }
            } catch (err) {
                // Silently fail — dropdown still works with owned businesses
                console.warn('[ActiveBusinessProvider] Failed to fetch claim statuses:', err);
            }
        };
        fetchClaimStatuses();
    }, [supabase, user, businesses]);

    // Filter to businesses owned/claimed by the current user,
    // PLUS businesses where the user has a business_claims row (even if not yet approved)
    const myBusinesses = useMemo(() => {
        if (!businesses || !user) return [];

        // Start with businesses where the user is the owner (claimed_by = user.id)
        const ownedSet = new Set();
        const result = [];

        businesses.forEach(b => {
            if (b.owner_id === user.id || b.claimed_by === user?.id) {
                ownedSet.add(b.id);
                result.push(b);
            }
        });

        // Add businesses from business_claims that aren't already included
        // (covers cases where claimed_by isn't set on the business yet)
        claimedBusinessIds.forEach(bizId => {
            if (!ownedSet.has(bizId)) {
                const biz = businesses.find(b => b.id === bizId);
                if (biz) {
                    ownedSet.add(bizId);
                    result.push(biz);
                }
            }
        });

        return result;
    }, [businesses, user, claimedBusinessIds]);

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

    // Count of active + pending claims for quota enforcement
    const pendingClaimCount = useMemo(() => {
        return Object.values(claimStatuses).filter(
            s => s === 'pending' || s === 'approved'
        ).length;
    }, [claimStatuses]);

    // Check if a business has an existing pending/approved claim from ANY user
    const isBusinessClaimedByOther = useCallback(async (businessId) => {
        if (!supabase) return false;
        const { count } = await supabase
            .from('business_claims')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .in('status', ['pending', 'approved']);
        return (count || 0) > 0;
    }, [supabase]);

    // Optimistic lock: instantly update local state after a claim submission
    const addOptimisticClaim = useCallback((businessId) => {
        setClaimStatuses(prev => ({ ...prev, [businessId]: 'pending' }));
        setClaimedBusinessIds(prev => [...prev, businessId]);
    }, []);

    return (
        <ActiveBusinessContext.Provider value={{
            activeBusiness,
            myBusinesses,
            selectedBusinessId,
            setSelectedBusinessId,
            isLoadingBusinesses,
            claimStatuses,
            pendingClaimCount,
            isBusinessClaimedByOther,
            addOptimisticClaim
        }}>
            {children}
        </ActiveBusinessContext.Provider>
    );
}

export const useActiveBusiness = () => useContext(ActiveBusinessContext);
