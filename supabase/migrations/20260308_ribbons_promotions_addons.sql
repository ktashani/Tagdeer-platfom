-- ============================================================
-- Tagdeer Platform — Phases C/D/E SQL Migration
-- Run in Supabase SQL Editor (staging first, then production)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Phase C: Business Ribbons (Discount Tags / Announcements)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS business_ribbons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    ribbon_type TEXT NOT NULL DEFAULT 'discount',   -- 'discount' | admin adds more later
    label TEXT NOT NULL,                             -- e.g. "50% OFF", "New Menu"
    label_ar TEXT,                                    -- Arabic label
    description TEXT,                                -- hover/click detail: "Online orders only"
    description_ar TEXT,
    color TEXT DEFAULT 'red',                        -- red, green, blue, amber, purple
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,                          -- NULL = no expiry
    is_active BOOLEAN DEFAULT true,
    source TEXT DEFAULT 'merchant',                  -- 'merchant' | 'admin' | 'campaign'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ribbons_business ON business_ribbons(business_id);
CREATE INDEX IF NOT EXISTS idx_ribbons_active ON business_ribbons(is_active, expires_at);

-- RLS: Public can read active ribbons, merchants can manage their own
ALTER TABLE business_ribbons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active ribbons" ON business_ribbons;
CREATE POLICY "Public can view active ribbons"
    ON business_ribbons FOR SELECT
    USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

DROP POLICY IF EXISTS "Merchants can manage own ribbons" ON business_ribbons;
CREATE POLICY "Merchants can manage own ribbons"
    ON business_ribbons FOR ALL
    USING (
        business_id IN (
            SELECT id FROM businesses WHERE claimed_by = auth.uid()
        )
    );


-- ──────────────────────────────────────────────────────────────
-- Phase D: Promotion System (Infrastructure Columns)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS promotion_multiplier INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promoted_until TIMESTAMPTZ;

-- promotion_multiplier: 0 = not promoted, 10/20/30 = show x times more


-- ──────────────────────────────────────────────────────────────
-- Phase E: Addon Economy (Feature Allocation Enhancements)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE feature_allocations
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'tier',       -- 'tier' | 'addon' | 'admin'
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,           -- NULL = follows subscription
    ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ;

-- source logic:
--   'tier'  → auto-granted by subscription tier, deactivated on downgrade
--   'addon' → purchased separately, survives tier downgrade until expires_at
--   'admin' → manually granted by admin


-- ──────────────────────────────────────────────────────────────
-- Campaign Combinability (for free trial campaigns)
-- ──────────────────────────────────────────────────────────────

-- If merchant_campaigns table exists, add combinable flag:
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_campaigns') THEN
        EXECUTE 'ALTER TABLE merchant_campaigns ADD COLUMN IF NOT EXISTS combinable BOOLEAN DEFAULT true';
    END IF;
END $$;

-- Done. Verify with: SELECT * FROM business_ribbons LIMIT 1;
