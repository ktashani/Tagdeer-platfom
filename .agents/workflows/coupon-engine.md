---
description: How to implement the Tagdeer Coupon & Campaign Engine (loyalty rewards, wallet, distribution, anti-fraud)
---

# Coupon & Campaign Engine — Agent Execution Guide

> **Architecture document:** `/Users/tbs_capsule/.gemini/antigravity/brain/0309e4ca-f857-44ee-b73e-994f34242e6d/implementation_plan.md`
> **Task checklist:** `/Users/tbs_capsule/.gemini/antigravity/brain/0309e4ca-f857-44ee-b73e-994f34242e6d/task.md`
> **Brand rules:** `/Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/AGENTS.md`

## Before You Start

1. **Read the full implementation plan** at the path above. It contains confirmed architectural decisions, SQL schemas, business logic rules, and safety constraints.
2. **Read the existing AGENTS.md** in the project root for brand terminology (Gader, Tagdeer, Migdar) and coding standards.
3. **Read the task.md** checklist. Work through it phase by phase. Mark items `[/]` when in progress and `[x]` when done.

## Core Architecture Summary

### What Already Exists (DO NOT break these)
- `merchant_coupons` table — the primary coupon/campaign entity. EVOLVE this, don't replace.
- `coupon_redemptions` table — legacy one-step redemption. Will be superseded by `user_coupons`.
- `resolution_messages.coupon_id` FK → `merchant_coupons(id)` — this FK must remain valid.
- `subscriptions` table — currently uses 'Tier 1'/'Tier 2'. Rename to 'Pro'/'Enterprise'.

### What We're Building
- **Two-step coupon lifecycle:** Claim → Wallet → Redeem (with expiry recycling)
- **User Wallet:** `user_coupons` table + consumer wallet page
- **Smart Distribution Engine:** Log meter → threshold → coupon award
- **3-Tier Subscriptions:** Free / Pro / Enterprise with feature gates
- **Hot Coupon Mechanic:** Faster redemption = bonus Gader points
- **Anti-Fraud:** 1 scan/day, self-redemption block, IDOR prevention

### Tables To Drop (After Data Check)
- `platform_coupon_pools`
- `platform_campaigns`
- `campaigns` (from v2 portals schema)

> **IMPORTANT:** Before dropping any table, RUN `SELECT COUNT(*) FROM <table>`. If count > 0, STOP and ask the user for confirmation.

## Phase Execution Rules

### Phase 1: Database Foundation
File: `supabase/migrations/20260305_coupon_campaign_engine.sql`

1. Start with data checks on tables to be dropped.
2. Apply all ALTER TABLE statements using `IF NOT EXISTS`.
3. Create `user_coupons` with full RLS policies.
4. Create the `enforce_campaign_immutability()` trigger.
5. Test with local Supabase reset.
6. Verify `resolution_messages.coupon_id` FK by querying the table.

### Phase 2: Backend Logic
Files: `src/lib/couponEngine.js`, `src/lib/serialCodeGenerator.js`, new RPCs

Key algorithms:
- **Eligibility:** `user.is_verified && gader_points >= 50 && status == 'Active'`
- **Distribution pool query:** `WHERE status='active' AND distribution_rule='PUBLIC_POOL' AND claimed_count < initial_quantity`
- **Discovery filter:** Exclude businesses where user has a log in `logs` table within last 30 days. If pool empty → remove filter (fallback).
- **Difficulty curve:** Threshold = `3 + coupon_difficulty_level`
- **Hot Coupon:** If `redeemed_at - generated_at < 48 hours` → award 1.5x Gader points
- **Serial codes:** Format `TAG-{FIRST3_OF_BUSINESS}-{6_RANDOM_ALPHANUM}` e.g. `TAG-CAF-8X99AB`

### Phase 3: Merchant Portal
Key files: `merchant/coupons/page.jsx`, `merchant/settings/page.jsx`, `ScannerModal.jsx`

- Do NOT break existing CRUD on `merchant_coupons`. Add new fields to the form.
- Immutability UX: Grey out fields, show "Campaign is active — edit locked" message.
- Tier gating: Check subscription before allowing campaign creation.
- Team management: Pro/Enterprise can invite team members (store holders/cashiers).

### Phase 4: Consumer Wallet
New file: `src/app/(consumer)/wallet/page.jsx`

- Only visible to eligible users (verified + ≥50 pts).
- Each coupon card shows: offer details, business name, `valid_until` countdown, serial code, QR.
- Hot coupon badge: "🔥 Redeem within X hours for bonus Gader!"
- Sort by urgency (closest expiry first).

### Phase 5: Admin & Cross-Functional
- `admin/campaigns/page.jsx`: Complete rewrite. Remove all `platform_campaigns` / `platform_coupon_pools` references. Show unified `merchant_coupons` pool view.
- `admin/financials/page.jsx`: Rename tier labels. Add free trial admin control.
- `discover/page.jsx`: Wire the `hasActiveDiscount` ribbon to actual data.

### Phase 6: Trust & Anti-Fraud
- Business trust boost: In `update_business_score()` trigger, check `user_coupons` for redeemed coupons matching the log's business → if found, multiply that log's weight by 1.2x.
- Physical scan: 1 per user per day. Track in a new `scan_log` or use `coupon_redemptions`.
- Self-redemption: In `redeem_coupon` RPC, verify merchant_user_id ≠ coupon_user_id.

## Subscription Tier Rules (For Feature Gating)

```javascript
const TIER_RULES = {
  Free: {
    maxBusinesses: 1,
    canUseLoyalty: false,
    maxPoolCoupons: 10, // per month
    canShowRibbon: false,
    canScan: true,
    canGiveCoupons: false,
    scanPoints: 5,
    hasShield: false, // can buy as add-on
    hasStorefront: false,
    hasResolution: false, // true if Shield purchased
    hasTeam: false,
  },
  Pro: {
    maxBusinesses: Infinity,
    canUseLoyalty: true,
    maxActiveCampaigns: 1,  // must pause + create new
    maxActiveCoupons: 5,
    maxPoolCoupons: Infinity,
    canShowRibbon: true,
    canScan: true,
    canGiveCoupons: true,
    scanPoints: 15,
    hasShield: false, // can buy as add-on
    hasStorefront: false, // can buy as add-on
    hasResolution: false,
    hasTeam: true,
  },
  Enterprise: {
    maxBusinesses: Infinity,
    canUseLoyalty: true,
    maxActiveCampaigns: Infinity,
    maxActiveCoupons: Infinity,
    maxPoolCoupons: Infinity,
    canShowRibbon: true,
    canScan: true,
    canGiveCoupons: true,
    mustGiveCouponOnScan: true,  // mandatory
    scanPoints: 30,
    hasShield: true,  // included
    hasStorefront: false, // can buy as add-on
    hasResolution: true,  // included
    hasTeam: true,
  }
};
```

## Error Handling

If any step fails:
1. Log the full error message.
2. Do NOT retry automatically if the error involves data loss or schema changes.
3. Describe what went wrong in plain language.
4. Ask the user how to proceed.
5. If it's a build error from frontend changes, check the failing component's imports first.

## Do NOT Touch These Files
- `middleware.js` — subdomain routing, unrelated
- `fingerprint.js` — anonymous tracking, unrelated
- `contentFilter.js` — bad word filter, unrelated
- `mathEngine.js` — vote weight math, only modify if implementing trust boost (Phase 6)
