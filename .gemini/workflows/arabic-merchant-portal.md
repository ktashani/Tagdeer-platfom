---
description: Add Arabic translations to the merchant portal pages
---

# Task: Arabic Translations — Merchant Portal

## Context

The consumer-facing pages (home, about, pricing, discover) already have full Arabic support via `src/i18n/translations.js`. The merchant portal pages (`src/app/(portals)/merchant/`) have hardcoded English strings. This task adds Arabic support to key merchant pages.

### i18n system:
- Translations file: `src/i18n/translations.js` — contains `en` and `ar` objects
- Context: `src/context/TagdeerContext.jsx` — provides `t()` function, `lang`, and `isRTL`
- Consumer pages use: `const { t, lang, isRTL } = useTagdeer()`
- Merchant pages use: `const { ... } = useTagdeer()` but mostly ignore `t`/`lang`/`isRTL`

## Critical Rules — DO NOT BREAK

1. **Do NOT modify** any existing translations — only ADD new keys
2. **Do NOT change** page layout or functionality — only wrap strings in `t()` or ternary
3. **Do NOT change** data-driven content (tier names, business names, user data) — only UI labels
4. Keep all English as the default — Arabic is opt-in via language toggle
5. Add `dir={isRTL ? 'rtl' : 'ltr'}` to the outermost wrapper div of each page

## Priority Order

1. `merchant/settings/page.jsx` — main customer-facing merchant page
2. `merchant/coupons/page.jsx` — campaign management
3. `merchant/dashboard/page.jsx` — merchant home

## Step 1: Add Merchant Translation Keys

File: `src/i18n/translations.js`

Add these keys to BOTH `en` and `ar` objects. Add them AFTER the existing merchant onboarding keys (after line 186 in `en`, after line 371 in `ar`).

### English keys to add (inside `en: {}`):
```javascript
// Merchant Portal
"merchant_settings": "Settings",
"merchant_dashboard": "Dashboard",
"merchant_campaigns": "Campaigns & Coupons",
"business_info": "Business Information",
"subscription_plan": "Subscription Plan",
"current_tier": "Current Tier",
"upgrade_plan": "Upgrade Plan",
"team_management": "Team Management",
"team_locked": "Upgrade to Pro to manage team members.",
"shield_subscriptions": "Shield Subscriptions (Per-Business)",
"business_settings": "Business Settings",
"digital_storefront": "Digital Storefront",
"save_changes": "Save Changes",
"create_campaign": "Create Campaign",
"campaign_title": "Campaign Title",
"offer_details": "Offer Details",
"distribution_channel": "Distribution Channel",
"launch_campaign": "Launch Campaign",
"platform_quota_pool": "Platform Quota Pool",
"physical_vip_scan": "Physical VIP Scan",
"resolution_only": "Resolution Only",
"expiry_date": "Expiry Date",
"initial_quantity": "Initial Quantity",
"free_tier": "Free Tier",
"pro_tier": "Pro Tier",
"enterprise_tier": "Enterprise Tier",
"upgrade_to_pro": "Upgrade to Pro",
"claimed": "Claimed",
"active": "Active",
"paused": "Paused",
"expired": "Expired",
```

### Arabic keys to add (inside `ar: {}`):
```javascript
// Merchant Portal
"merchant_settings": "الإعدادات",
"merchant_dashboard": "لوحة التحكم",
"merchant_campaigns": "الحملات والكوبونات",
"business_info": "معلومات النشاط",
"subscription_plan": "خطة الاشتراك",
"current_tier": "الفئة الحالية",
"upgrade_plan": "ترقية الخطة",
"team_management": "إدارة الفريق",
"team_locked": "ترقّ إلى برو لإدارة أعضاء الفريق.",
"shield_subscriptions": "اشتراكات الدروع (لكل فرع)",
"business_settings": "إعدادات النشاط",
"digital_storefront": "واجهة المتجر الرقمية",
"save_changes": "حفظ التغييرات",
"create_campaign": "إنشاء حملة",
"campaign_title": "عنوان الحملة",
"offer_details": "تفاصيل العرض",
"distribution_channel": "قناة التوزيع",
"launch_campaign": "إطلاق الحملة",
"platform_quota_pool": "حصة منصة تقدير",
"physical_vip_scan": "مسح VIP الفعلي",
"resolution_only": "للحلول فقط",
"expiry_date": "تاريخ الانتهاء",
"initial_quantity": "الكمية المبدئية",
"free_tier": "الفئة المجانية",
"pro_tier": "فئة برو",
"enterprise_tier": "فئة المؤسسات",
"upgrade_to_pro": "الترقية إلى برو",
"claimed": "تمت المطالبة",
"active": "نشط",
"paused": "متوقف",
"expired": "منتهي",
```

## Step 2: Wrap Merchant Settings Strings

File: `src/app/(portals)/merchant/settings/page.jsx`

1. Ensure destructuring includes `t`, `lang`, `isRTL`:
   ```javascript
   const { t, lang, isRTL, ... } = useTagdeer()
   ```

2. Add `dir` to the outermost div:
   ```jsx
   <div className="..." dir={isRTL ? 'rtl' : 'ltr'}>
   ```

3. Replace hardcoded strings with `t('key')` calls for section headers, labels, and button text. DO NOT translate dynamic data (business names, tier names from DB, prices).

**Example replacements:**
- `"Team Management"` → `{t('team_management')}`
- `"Save Changes"` → `{t('save_changes')}`
- `"Upgrade to Pro"` → `{t('upgrade_to_pro')}`

## Step 3: Wrap Merchant Coupons Strings

File: `src/app/(portals)/merchant/coupons/page.jsx`

Same approach — add `t, lang, isRTL` to the destructure and wrap UI labels.

## Step 4: Verify

1. Run `npm run dev`
2. Navigate to merchant settings
3. Toggle language to Arabic
4. Verify all section headers and labels appear in Arabic
5. Verify layout is RTL
6. Verify data-driven content (tier names, prices, business names) is NOT translated
7. Toggle back to English → verify everything is correct
