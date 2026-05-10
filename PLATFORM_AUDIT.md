# Tagdeer Platform — Comprehensive Audit & Backlog

> Last updated: 2026-05-10

---

## 1. Gader Point System — Current Conditions

### How Users Earn Gader Points
| Action | Points | Requires Phone? |
|---|---|---|
| New account signup (WhatsApp OTP) | +20 | ✅ Yes |
| New account signup (Facebook OAuth) | +20 | ❌ No |
| Submit a vote (recommend or complain) | +10 per vote | ❌ No (any logged-in user) |

### Tier Progression
| Tier | Gader Points | Vote Weight Multiplier |
|---|---|---|
| Bronze | 0 – 999 | 1.0x |
| Silver | 1,000 – 4,999 | 1.5x |
| Gold | 5,000 – 19,999 | 2.0x |
| VIP / Diamond | 20,000+ | 2.5x |

### Coupon / Reward Conditions
The profile page shows a **weekly progress bar**: Users need `3 + coupon_difficulty_level` logs per week to earn a coupon.

| Condition | Current Value | Can Admin Change? |
|---|---|---|
| Logs needed for coupon | `3 + coupon_difficulty_level` | ✅ Yes — via admin/users page (per-user) |
| Welcome bonus | 20 Gader | ❌ Hardcoded in edge function + OAuth trigger |
| Points per vote | +10 | ❌ Hardcoded in submit_vote RPC |
| Tier thresholds | 0/1000/5000/20000 | ❌ Hardcoded in submit_vote RPC + trustEngine.js |

**Admin Dynamic Control**: Currently the coupon_difficulty_level is per-user (editable via admin panel). If you want a platform-wide Gader threshold that dynamically impacts all users, you'd need a new platform_settings row like min_gader_for_rewards that the coupon system checks at redemption time.

### Reward Redemption Gate (NEW — from Facebook integration)
| Feature | Phone Verified? | Allowed? |
|---|---|---|
| Browse businesses | Any | ✅ |
| Submit recommendations | Any | ✅ |
| Collect Gader points | Any logged-in | ✅ |
| Complain on unshielded business | Any | ✅ |
| Complain on shielded business | Phone required | ❌ until verified |
| Redeem coupons/rewards | Phone required | ❌ Not yet implemented |

---

## 2. Admin Credentials

### Production (fhxbildxtfmbcwggvxtk)
| Field | Value |
|---|---|
| Email | admin@tagdeer.app |
| Role | super_admin |
| Has Password | false |

### Staging (ipjvgbxkouadovjqwncx)
| Field | Value |
|---|---|
| Email | admin@tagdeer.app |
| Role | super_admin |
| Has Password | false |

**WARNING: Neither admin account has a password set!** They rely on Supabase Auth (email magic link / OTP).

### How to Recover Admin Access
1. **Magic Link**: Go to /admin/login → enter admin@tagdeer.app → check inbox
2. **Supabase Dashboard**: Go to Supabase → Authentication → Users → find admin → click "Send magic link"
3. **Set a permanent password**: Use /admin/settings or Supabase Dashboard → Auth → Users → Send password reset

---

## 3. Platform Backlog — Missing Logic, Dummy Views & Loose Ends

### 🔴 Critical — Must Fix Before Public Launch

- [ ] **C1: Coupon Engine Not Wired into submit_vote**
  - submit_vote RPC always returns coupon_awarded: NULL
  - The coupon tables exist (user_coupons, merchant_coupons, coupon_redemptions) but are NOT triggered
  - Impact: Users see progress bar but never earn coupons
  - Ref: /coupon-engine workflow

- [ ] **C2: Reward Redemption — No Phone Verification Gate**
  - Coupon wallet (WalletTab.jsx, CouponWallet.jsx) has no check for phone_verified
  - Facebook-only users could redeem coupons if awarded
  - Fix: Add phone_verified check before showing Redeem button

- [ ] **C3: campaigns Table Missing from Production**
  - Merchant campaigns page queries campaigns table — may not exist in production
  - Page will silently fail if table doesn't exist

- [ ] **C4: Admin Reports Page — Dummy Chart**
  - /admin/reports has hardcoded "Dummy Bar Chart Visualization"
  - Shows fake data, not real analytics

---

### 🟠 High — Important for Business Logic

- [ ] **H1: Financials Page — Revenue Chart Placeholder**
  - /admin/financials: "Revenue Chart Placeholder"
  - No actual revenue tracking or payment integration

- [ ] **H2: Billing Page — Payment Method Placeholder**
  - /merchant/billing: "Payment Method Placeholder"
  - "Online payment coming soon" text visible to merchants

- [ ] **H3: Verify User Page — Rewards System Placeholder**
  - /verify-user/[id]: "Coming soon: full rewards system"
  - QR scan → business preview → Grant Recognition button not functional

- [ ] **H4: coupon_awarded Event Never Fires**
  - useVoteSubmission dispatches trust-ledger-coupon event when result.coupon_awarded exists
  - CouponAwardModal listens for it
  - But submit_vote never populates it — always NULL

- [ ] **H5: No Notification System**
  - /notifications page exists but has no real data source
  - No push notifications, no in-app notification center

- [ ] **H6: Merchant Inbox — No Real-time Messages**
  - /merchant/inbox page exists but no messaging system connected
  - No consumer → merchant messaging flow

---

### 🟡 Medium — UX & Polish

- [ ] **M1: BusinessCard JSON-LD — TODO Comment**
  - BusinessCard.jsx: "TODO: Phase 6 — Move JSON-LD to server component for SEO"
  - SEO structured data renders client-side (not crawlable)

- [ ] **M2: Profile user_id (VIP Code) — Missing from Production Schema**
  - AuthProvider references profile.user_id (VIP-XXXXX code)
  - Production profiles table has NO user_id column
  - Falls back to AUTH-XXXXX which is not the VIP system

- [ ] **M3: Profile vip_tier — Missing from Production Schema**
  - AuthProvider references profile.vip_tier
  - Production has no vip_tier column — falls back to Bronze
  - Tier is calculated client-side but never persisted

- [ ] **M4: Avatar URL Not Saved for Facebook Users**
  - OAuth trigger creates profile without avatar_url
  - Facebook provides avatar via user_metadata but trigger doesn't map it

- [ ] **M5: Merchant Analytics Page — Verify Data Connectivity**
  - /merchant/analytics exists but needs verification

- [ ] **M6: ERP Sync API — Dead Endpoint?**
  - /api/erp/sync route exists — unclear if any ERP system consumes it

---

### 🔵 Low — Nice to Have

- [ ] **L1: PreRegModal — Legacy Component**
  - Pre-registration modal may be superseded by merchant onboarding

- [ ] **L2: VerifySoonModal — Purpose Unclear**
  - Shows "Coming Soon" style message — may need updating or removal

- [ ] **L3: Client IP API**
  - /api/client-ip endpoint — verify if still needed for fingerprinting

- [ ] **L4: Catalog Feed Parser**
  - /api/merchant/parse-catalog-feed — verify if catalog system is connected

- [ ] **L5: Global Error Page**
  - global-error.jsx — verify it provides helpful user-facing messages

---

### 🟣 Security & Data Integrity

- [ ] **S1: submit_vote RPC Doesn't Check phone_verified**
  - Server-side RPC has Shield Level 1 check (profile_id IS NULL = anonymous)
  - But a Facebook user with profile_id but no phone passes the shield check
  - Fix: Add phone_verified check in RPC for Shield Level 1+

- [ ] **S2: Admin Login Page — Hardcoded Placeholder Email**
  - /admin/login has placeholder "admin@tagdeer.co" (note: .co not .app)

- [ ] **S3: Campaigns Page Uses Direct supabase Import**
  - /merchant/campaigns imports from @/lib/supabaseClient instead of context
  - Might not have proper auth context or RLS alignment

---

### ⚪ Confirmed Working

- [x] WhatsApp OTP (production) — Confirmed
- [x] Facebook Login — Code deployed, awaiting test
- [x] Phone verification gate — Shielded businesses only
- [x] Shield enforcement (Level 1 + Level 2) — Working
- [x] Vote weight + diminishing returns — Working
- [x] Merchant onboarding + claim flow — Working
- [x] Storefront builder — Working
- [x] QR scan + coupon verification — Working
- [x] Bad word filter — Working
- [x] Anonymous weekly limit (7/7 days) — Working
- [x] 24-hour same-business cooldown — Working

---

## Priority Order for Implementation

1. **C1** → Wire coupon engine into submit_vote (core revenue feature)
2. **C2** → Phone verification gate on coupon redemption
3. **S1** → Server-side phone_verified check in RPC
4. **M2 + M3** → Add user_id + vip_tier columns to production
5. **M4** → Save Facebook avatar URL
6. **H4** → Coupon award event flow
7. **H1 + H2** → Financials and billing real data
8. **C3** → Verify campaigns table in production
9. **H5** → Notification system
10. **H6** → Merchant inbox messaging
