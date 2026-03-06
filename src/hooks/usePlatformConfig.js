'use client';

import { useState, useEffect } from 'react';
import { useSupabase } from './useSupabase';

export function usePlatformConfig() {
    const { supabase } = useSupabase();
    const [config, setConfig] = useState({
        categories: [],
        regions: [],
        shieldPricing: { trust: 20, fatora: 50 },
        tierPricing: [],
        vipThresholds: { guest: 0, bronze: 20, silver: 1000, gold: 5000, vip: 20000 },
        adminRoles: ['super_admin', 'admin', 'assistant_admin', 'support_agent'],
        loading: true,
        error: null
    });

    // Provide a way for admin components to force a refresh after saving
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const refreshConfig = () => setRefreshTrigger(prev => prev + 1);

    useEffect(() => {
        if (!supabase) return;

        let isMounted = true;

        const fetchConfig = async () => {
            try {
                const { data, error } = await supabase.from('platform_config').select('*');

                if (error) {
                    throw error;
                }

                if (data && isMounted) {
                    // Map key-value pairs to the state object
                    const parsedConfig = data.reduce((acc, row) => {
                        if (row.key === 'shield_pricing') acc.shieldPricing = row.value;
                        if (row.key === 'tier_pricing') acc.tierPricing = row.value;
                        if (row.key === 'vip_thresholds') acc.vipThresholds = row.value;
                        if (row.key === 'categories') acc.categories = row.value;
                        if (row.key === 'regions') acc.regions = row.value;
                        if (row.key === 'admin_roles') acc.adminRoles = row.value;
                        return acc;
                    }, {});

                    setConfig(prev => ({
                        ...prev,
                        ...parsedConfig,
                        loading: false,
                        error: null
                    }));
                }
            } catch (err) {
                console.error("Failed to load platform config", err);
                if (isMounted) {
                    setConfig(prev => ({
                        ...prev,
                        loading: false,
                        error: err.message
                    }));
                }
            }
        };

        fetchConfig();

        return () => {
            isMounted = false;
        };
    }, [supabase, refreshTrigger]);

    return { ...config, refreshConfig };
}
