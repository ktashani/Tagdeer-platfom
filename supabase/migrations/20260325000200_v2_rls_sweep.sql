-- ============================================================
-- Migration: W1-2 — RLS/RPC Sweep
-- Replaces ALL inline role checks across existing tables
-- with is_platform_admin() and is_merchant() helpers.
--
-- DEPENDS ON: 20260325000100_v2_rbac_foundation.sql
--             (must create is_platform_admin() first)
--
-- Tables covered (25 confirmed via live Supabase query):
--   profiles, logs, businesses, interactions, business_claims,
--   pre_registrations, verified_users, otp_verifications,
--   subscriptions, transactions, payment_audit_log, merchant_addons,
--   feature_allocations, platform_config, subscription_tiers,
--   platform_coupon_pools, user_coupons, disputes, business_ribbons,
--   merchant_teams, trial_campaigns, storefronts, storefront_products,
--   r2_assets
--
-- ⚠️  profiles and logs RLS are NOT touched (E2E test safety).
-- ⚠️  business_claims already re-drafted in W1-1 — skipped here.
-- ============================================================


-- ═══════════════════════════════════════════════════════════
-- HELPER: safe_create_policy()
-- Wraps policy creation in EXECUTE so we can call it inside
-- a DO block with table existence checks.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION _temp_safe_policy(
    p_table TEXT,
    p_name TEXT,
    p_op TEXT,    -- SELECT, INSERT, UPDATE, DELETE, ALL
    p_using TEXT DEFAULT NULL,
    p_check TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    -- Drop if exists
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name, p_table);

    -- Build CREATE POLICY
    IF p_op = 'ALL' THEN
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL USING (%s)',
            p_name, p_table, p_using
        );
    ELSIF p_op = 'INSERT' THEN
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s)',
            p_name, p_table, COALESCE(p_check, p_using)
        );
    ELSIF p_check IS NOT NULL THEN
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR %s USING (%s) WITH CHECK (%s)',
            p_name, p_table, p_op, p_using, p_check
        );
    ELSE
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR %s USING (%s)',
            p_name, p_table, p_op, p_using
        );
    END IF;
END;
$$;


-- ═══════════════════════════════════════════════════════════
-- 1. SUBSCRIPTIONS — Admin sees all, merchants see own
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subscriptions') THEN
        RAISE NOTICE 'subscriptions: table not found, skipping'; RETURN;
    END IF;

    -- Ensure RLS is enabled
    ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

    -- Drop old policies
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "Merchants can view own subscription" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "Admin full access subscriptions" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "sub_select_own" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "sub_select_admin" ON public.subscriptions';
    EXECUTE 'DROP POLICY IF EXISTS "sub_all_admin" ON public.subscriptions';

    -- New policies
    PERFORM _temp_safe_policy('subscriptions', 'sub_select_own', 'SELECT', 'auth.uid() = profile_id');
    PERFORM _temp_safe_policy('subscriptions', 'sub_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'subscriptions: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 2. TRANSACTIONS — Admin sees all, merchants see own
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='transactions') THEN
        RAISE NOTICE 'transactions: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS "Merchants can view own transactions" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS "txn_select_own" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS "txn_select_admin" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS "txn_all_admin" ON public.transactions';
    EXECUTE 'DROP POLICY IF EXISTS "txn_insert_merchant" ON public.transactions';

    PERFORM _temp_safe_policy('transactions', 'txn_select_own', 'SELECT', 'auth.uid() = owner_id');
    PERFORM _temp_safe_policy('transactions', 'txn_insert_merchant', 'INSERT', NULL, 'auth.uid() = owner_id');
    PERFORM _temp_safe_policy('transactions', 'txn_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'transactions: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 3. PAYMENT_AUDIT_LOG — Admin + merchant (own txns only)
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payment_audit_log') THEN
        RAISE NOTICE 'payment_audit_log: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Admins can view audit log" ON public.payment_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "Merchants can view their payment audit" ON public.payment_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "pal_select_admin" ON public.payment_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "pal_select_merchant" ON public.payment_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "pal_all_admin" ON public.payment_audit_log';

    PERFORM _temp_safe_policy('payment_audit_log', 'pal_all_admin', 'ALL', 'public.is_platform_admin()');
    PERFORM _temp_safe_policy('payment_audit_log', 'pal_select_merchant', 'SELECT',
        'entity_type = ''transaction'' AND entity_id IN (SELECT id FROM public.transactions WHERE owner_id = auth.uid())');

    RAISE NOTICE 'payment_audit_log: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 4. SUBSCRIPTION_TIERS — Public read, admin write
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subscription_tiers') THEN
        RAISE NOTICE 'subscription_tiers: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Anyone can read tiers" ON public.subscription_tiers';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage tiers" ON public.subscription_tiers';
    EXECUTE 'DROP POLICY IF EXISTS "tier_select_public" ON public.subscription_tiers';
    EXECUTE 'DROP POLICY IF EXISTS "tier_all_admin" ON public.subscription_tiers';

    PERFORM _temp_safe_policy('subscription_tiers', 'tier_select_public', 'SELECT', 'true');
    PERFORM _temp_safe_policy('subscription_tiers', 'tier_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'subscription_tiers: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 5. PLATFORM_CONFIG — Admin only
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='platform_config') THEN
        RAISE NOTICE 'platform_config: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Admin full access platform config" ON public.platform_config';
    EXECUTE 'DROP POLICY IF EXISTS "Public read platform config" ON public.platform_config';
    EXECUTE 'DROP POLICY IF EXISTS "cfg_select_public" ON public.platform_config';
    EXECUTE 'DROP POLICY IF EXISTS "cfg_all_admin" ON public.platform_config';

    PERFORM _temp_safe_policy('platform_config', 'cfg_select_public', 'SELECT', 'true');
    PERFORM _temp_safe_policy('platform_config', 'cfg_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'platform_config: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 6. FEATURE_ALLOCATIONS — Admin + merchant own
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='feature_allocations') THEN
        RAISE NOTICE 'feature_allocations: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.feature_allocations ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Merchant can view own allocations" ON public.feature_allocations';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage allocations" ON public.feature_allocations';
    EXECUTE 'DROP POLICY IF EXISTS "fa_select_own" ON public.feature_allocations';
    EXECUTE 'DROP POLICY IF EXISTS "fa_all_admin" ON public.feature_allocations';
    EXECUTE 'DROP POLICY IF EXISTS "fa_update_merchant" ON public.feature_allocations';

    PERFORM _temp_safe_policy('feature_allocations', 'fa_select_own', 'SELECT', 'auth.uid() = profile_id');
    PERFORM _temp_safe_policy('feature_allocations', 'fa_update_merchant', 'UPDATE',
        'auth.uid() = profile_id', 'auth.uid() = profile_id');
    PERFORM _temp_safe_policy('feature_allocations', 'fa_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'feature_allocations: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 7. MERCHANT_ADDONS — Admin + merchant own
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='merchant_addons') THEN
        RAISE NOTICE 'merchant_addons: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.merchant_addons ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Merchant can view own addons" ON public.merchant_addons';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage addons" ON public.merchant_addons';
    EXECUTE 'DROP POLICY IF EXISTS "addon_select_own" ON public.merchant_addons';
    EXECUTE 'DROP POLICY IF EXISTS "addon_all_admin" ON public.merchant_addons';

    PERFORM _temp_safe_policy('merchant_addons', 'addon_select_own', 'SELECT', 'auth.uid() = profile_id');
    PERFORM _temp_safe_policy('merchant_addons', 'addon_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'merchant_addons: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 8. DISPUTES — Admin + disputing merchant
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='disputes') THEN
        RAISE NOTICE 'disputes: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Merchant can view own disputes" ON public.disputes';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage disputes" ON public.disputes';
    EXECUTE 'DROP POLICY IF EXISTS "dispute_select_own" ON public.disputes';
    EXECUTE 'DROP POLICY IF EXISTS "dispute_insert_merchant" ON public.disputes';
    EXECUTE 'DROP POLICY IF EXISTS "dispute_all_admin" ON public.disputes';

    PERFORM _temp_safe_policy('disputes', 'dispute_select_own', 'SELECT', 'auth.uid() = merchant_id');
    PERFORM _temp_safe_policy('disputes', 'dispute_insert_merchant', 'INSERT', NULL, 'auth.uid() = merchant_id');
    PERFORM _temp_safe_policy('disputes', 'dispute_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'disputes: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 9. MERCHANT_TEAMS — Admin + team owner
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='merchant_teams') THEN
        RAISE NOTICE 'merchant_teams: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.merchant_teams ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Teams visible to owner" ON public.merchant_teams';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage teams" ON public.merchant_teams';
    EXECUTE 'DROP POLICY IF EXISTS "team_select_own" ON public.merchant_teams';
    EXECUTE 'DROP POLICY IF EXISTS "team_all_admin" ON public.merchant_teams';

    PERFORM _temp_safe_policy('merchant_teams', 'team_select_own', 'SELECT', 'auth.uid() = created_by');
    PERFORM _temp_safe_policy('merchant_teams', 'team_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'merchant_teams: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 10. TRIAL_CAMPAIGNS — Admin manages, public reads active
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trial_campaigns') THEN
        RAISE NOTICE 'trial_campaigns: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.trial_campaigns ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Admin can manage trial campaigns" ON public.trial_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS "Public can read active trials" ON public.trial_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS "tc_select_active" ON public.trial_campaigns';
    EXECUTE 'DROP POLICY IF EXISTS "tc_all_admin" ON public.trial_campaigns';

    PERFORM _temp_safe_policy('trial_campaigns', 'tc_select_active', 'SELECT', 'true');
    PERFORM _temp_safe_policy('trial_campaigns', 'tc_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'trial_campaigns: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 11. PLATFORM_COUPON_POOLS — Admin manages, public reads
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='platform_coupon_pools') THEN
        RAISE NOTICE 'platform_coupon_pools: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.platform_coupon_pools ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Admin manage coupon pools" ON public.platform_coupon_pools';
    EXECUTE 'DROP POLICY IF EXISTS "Public read active pools" ON public.platform_coupon_pools';
    EXECUTE 'DROP POLICY IF EXISTS "pool_select_public" ON public.platform_coupon_pools';
    EXECUTE 'DROP POLICY IF EXISTS "pool_all_admin" ON public.platform_coupon_pools';

    PERFORM _temp_safe_policy('platform_coupon_pools', 'pool_select_public', 'SELECT', 'true');
    PERFORM _temp_safe_policy('platform_coupon_pools', 'pool_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'platform_coupon_pools: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 12. USER_COUPONS — User sees own, admin sees all
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_coupons') THEN
        RAISE NOTICE 'user_coupons: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "User can view own coupons" ON public.user_coupons';
    EXECUTE 'DROP POLICY IF EXISTS "Admin manage user coupons" ON public.user_coupons';
    EXECUTE 'DROP POLICY IF EXISTS "uc_select_own" ON public.user_coupons';
    EXECUTE 'DROP POLICY IF EXISTS "uc_all_admin" ON public.user_coupons';

    PERFORM _temp_safe_policy('user_coupons', 'uc_select_own', 'SELECT', 'auth.uid() = user_id');
    PERFORM _temp_safe_policy('user_coupons', 'uc_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'user_coupons: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 13. BUSINESS_RIBBONS — Public read, admin + merchant manage
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='business_ribbons') THEN
        RAISE NOTICE 'business_ribbons: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.business_ribbons ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Public can view ribbons" ON public.business_ribbons';
    EXECUTE 'DROP POLICY IF EXISTS "Admin manage ribbons" ON public.business_ribbons';
    EXECUTE 'DROP POLICY IF EXISTS "ribbon_select_public" ON public.business_ribbons';
    EXECUTE 'DROP POLICY IF EXISTS "ribbon_all_admin" ON public.business_ribbons';

    PERFORM _temp_safe_policy('business_ribbons', 'ribbon_select_public', 'SELECT', 'true');
    PERFORM _temp_safe_policy('business_ribbons', 'ribbon_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'business_ribbons: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 14. STOREFRONTS — Public read, merchant own, admin all
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='storefronts') THEN
        RAISE NOTICE 'storefronts: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Public read storefronts" ON public.storefronts';
    EXECUTE 'DROP POLICY IF EXISTS "Merchant manage own storefront" ON public.storefronts';
    EXECUTE 'DROP POLICY IF EXISTS "Admin manage storefronts" ON public.storefronts';
    EXECUTE 'DROP POLICY IF EXISTS "sf_select_public" ON public.storefronts';
    EXECUTE 'DROP POLICY IF EXISTS "sf_all_merchant" ON public.storefronts';
    EXECUTE 'DROP POLICY IF EXISTS "sf_all_admin" ON public.storefronts';

    PERFORM _temp_safe_policy('storefronts', 'sf_select_public', 'SELECT', 'true');
    PERFORM _temp_safe_policy('storefronts', 'sf_all_merchant', 'ALL',
        'business_id IN (SELECT id FROM public.businesses WHERE claimed_by = auth.uid())');
    PERFORM _temp_safe_policy('storefronts', 'sf_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'storefronts: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 15. STOREFRONT_PRODUCTS — Same as storefronts
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='storefront_products') THEN
        RAISE NOTICE 'storefront_products: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.storefront_products ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "Public read products" ON public.storefront_products';
    EXECUTE 'DROP POLICY IF EXISTS "Merchant manage own products" ON public.storefront_products';
    EXECUTE 'DROP POLICY IF EXISTS "Admin manage products" ON public.storefront_products';
    EXECUTE 'DROP POLICY IF EXISTS "sp_select_public" ON public.storefront_products';
    EXECUTE 'DROP POLICY IF EXISTS "sp_all_merchant" ON public.storefront_products';
    EXECUTE 'DROP POLICY IF EXISTS "sp_all_admin" ON public.storefront_products';

    PERFORM _temp_safe_policy('storefront_products', 'sp_select_public', 'SELECT', 'true');
    PERFORM _temp_safe_policy('storefront_products', 'sp_all_merchant', 'ALL',
        'storefront_id IN (SELECT id FROM public.storefronts WHERE business_id IN (SELECT id FROM public.businesses WHERE claimed_by = auth.uid()))');
    PERFORM _temp_safe_policy('storefront_products', 'sp_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'storefront_products: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 16. R2_ASSETS — Merchant own, admin all
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='r2_assets') THEN
        RAISE NOTICE 'r2_assets: table not found, skipping'; RETURN;
    END IF;

    ALTER TABLE public.r2_assets ENABLE ROW LEVEL SECURITY;

    EXECUTE 'DROP POLICY IF EXISTS "User manage own assets" ON public.r2_assets';
    EXECUTE 'DROP POLICY IF EXISTS "Admin manage assets" ON public.r2_assets';
    EXECUTE 'DROP POLICY IF EXISTS "r2_all_own" ON public.r2_assets';
    EXECUTE 'DROP POLICY IF EXISTS "r2_all_admin" ON public.r2_assets';

    PERFORM _temp_safe_policy('r2_assets', 'r2_all_own', 'ALL', 'auth.uid() = owner_id');
    PERFORM _temp_safe_policy('r2_assets', 'r2_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'r2_assets: RLS re-drafted';
END $$;


-- ═══════════════════════════════════════════════════════════
-- 17. BUSINESSES — Existing SELECT/INSERT preserved,
--     add admin ALL, fix owner update
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='businesses') THEN
        RAISE NOTICE 'businesses: table not found, skipping'; RETURN;
    END IF;

    -- Drop old admin policy if exists
    EXECUTE 'DROP POLICY IF EXISTS "Admin full access businesses" ON public.businesses';
    EXECUTE 'DROP POLICY IF EXISTS "biz_all_admin" ON public.businesses';

    -- Admin: full CRUD (needed for claim approvals, bans, etc.)
    PERFORM _temp_safe_policy('businesses', 'biz_all_admin', 'ALL', 'public.is_platform_admin()');

    RAISE NOTICE 'businesses: admin RLS added (existing public read + auth insert preserved)';
END $$;


-- ═══════════════════════════════════════════════════════════
-- CLEANUP: Drop the temporary helper function
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS _temp_safe_policy(TEXT, TEXT, TEXT, TEXT, TEXT);


-- ═══════════════════════════════════════════════════════════
-- SCHEMA CACHE RELOAD
-- ═══════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
