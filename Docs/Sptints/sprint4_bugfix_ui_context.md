# Sprint 4 Bugfix — Portal UI Context Isolation

## Problem Statement

When an admin logs into `admin.staging.tagdeer.app`, the **server-side** Admin Layout renders correctly (AdminTopNav, AdminGuard). However, the **client-side** shared `(portals)/layout.jsx` — which wraps BOTH admin and merchant — injects merchant-specific UI (TopNav with "Claim Another Business", merchant store selector) into the React tree. The root cause is a single shared layout importing the Merchant `TopNav` and relying on pathname checks to hide it, rather than clean route-level separation.

## Root Cause

```
RootLayout
 └── TagdeerProvider (global — loads businesses for ANY authenticated user)
      └── (portals)/layout.jsx           ← WRAPS BOTH admin + merchant
           ├── TopNav (Merchant)          ← Hidden via pathname check, but still in tree
           └── admin/layout.jsx OR merchant/layout.jsx
```

The `(portals)/layout.jsx` imports `@/components/merchant/TopNav` and conditionally hides it when `pathname.startsWith('/admin')`. This is a visual hide, not a structural separation. The TopNav's `useEffect` hooks still fire, fetching merchant-specific data (subscriptions, claims, inbox counts) for the admin user.

## Scope & Constraints

- **DO NOT** alter `serverAuth.js`, `adminAuth.js`, cookie domain logic, or any backend auth
- **DO NOT** break existing merchant TopNav functionality  
- **DO NOT** change any admin page's `useTagdeer()` calls (they legitimately use `supabase`, `showToast`, and `businesses`)
- **Minimal file changes** — move TopNav to the correct layout, clean the shared layout

---

## TASK 1: Move Merchant TopNav Into Merchant Layout

### Problem
The Merchant `TopNav` is imported and rendered in `(portals)/layout.jsx`, which is shared by both admin and merchant routes. It should live exclusively in the merchant layout.

### [MODIFY] [layout.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/merchant/layout.jsx)

**Current content (19 lines):**
```jsx
import MerchantGuard from '@/components/merchant/MerchantGuard'

export const metadata = {
    title: 'Tagdeer Merchant Portal',
    description: 'Merchant dashboard for Tagdeer platform',
}

export default function MerchantLayout({ children }) {
    return (
        <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans">
            <MerchantGuard>
                <main className="p-4 md:p-8 max-w-[1400px] mx-auto">
                    {children}
                </main>
            </MerchantGuard>
        </div>
    )
}
```

**Replace with:**
```jsx
'use client';

import { usePathname } from 'next/navigation';
import MerchantGuard from '@/components/merchant/MerchantGuard';
import TopNav from '@/components/merchant/TopNav';

export default function MerchantLayout({ children }) {
    const pathname = usePathname();

    // Hide nav for auth/onboarding pages, or when not yet authenticated
    const isOnboarding = pathname?.includes('/onboarding');
    const isLogin = pathname?.includes('/login');
    const isResetPassword = pathname?.includes('/reset-password');
    const hideNav = isOnboarding || isLogin || isResetPassword;

    return (
        <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans">
            <MerchantGuard>
                {!hideNav && <TopNav />}
                <main className="p-4 md:p-8 max-w-[1400px] mx-auto">
                    {children}
                </main>
            </MerchantGuard>
        </div>
    );
}
```

**Key changes:**
1. Added `'use client'` directive (required for `usePathname`)
2. Imported and rendered `TopNav` directly inside the merchant layout, inside the `MerchantGuard`
3. Applied the same `hideNav` logic that was previously in the portals layout
4. Removed `export const metadata` (not allowed in `'use client'` components — this is fine, the root layout and admin layout already handle metadata)

> [!IMPORTANT]
> By placing `TopNav` inside `MerchantGuard`, the merchant nav ONLY renders after authentication is confirmed. It NEVER renders inside admin routes.

---

## TASK 2: Clean the Shared Portals Layout

### Problem
`(portals)/layout.jsx` currently imports the Merchant `TopNav`, computes `hideNav` logic, and pulls `user` from `useTagdeer()`. After Task 1, it only needs to provide the shared outer wrapper (RTL direction, toast).

### [MODIFY] [layout.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/layout.jsx)

**Current content (34 lines):**
```jsx
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import TopNav from '@/components/merchant/TopNav';
import { useTagdeer } from '@/context/TagdeerContext';
import { Toast } from '@/components/Toast';

export default function PortalsLayout({ children }) {
    const pathname = usePathname();
    const { isRTL, toastMessage, setToastMessage, user } = useTagdeer();

    // Hide nav for auth/onboarding pages, admin routes, or when user isn't loaded yet
    const isOnboarding = pathname?.includes('/onboarding');
    const isLogin = pathname?.includes('/login');
    const isAdmin = pathname?.startsWith('/admin');
    const hideNav = isOnboarding || isLogin || isAdmin || !user;

    return (
        <div className={`min-h-screen flex flex-col font-sans bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>

            {/* Inject the Merchant Command Center globally for portal routes (except auth/onboarding) */}
            {!hideNav && <TopNav />}

            <main className="flex-grow">
                {children}
            </main>

            <Toast message={toastMessage} onClose={() => setToastMessage('')} />
        </div>
    );
}
```

**Replace with:**
```jsx
'use client';

import React from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { Toast } from '@/components/Toast';

export default function PortalsLayout({ children }) {
    const { isRTL, toastMessage, setToastMessage } = useTagdeer();

    return (
        <div
            className={`min-h-screen flex flex-col font-sans bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 ${isRTL ? 'text-right' : 'text-left'}`}
            dir={isRTL ? 'rtl' : 'ltr'}
        >
            <main className="flex-grow">
                {children}
            </main>

            <Toast message={toastMessage} onClose={() => setToastMessage('')} />
        </div>
    );
}
```

**Key changes:**
1. **Removed** the `TopNav` import entirely — it now lives in the merchant layout
2. **Removed** `usePathname` — no longer needed since there's no conditional nav logic
3. **Removed** `user` from the `useTagdeer()` destructure — this layout no longer needs user state
4. The layout is now a **thin, portal-agnostic wrapper** that only handles RTL direction and the shared Toast component

---

## TASK 3: Add Merchant Metadata via `<head>` in Merchant Layout

### Problem
Task 1 added `'use client'` to the merchant layout, which means `export const metadata` is no longer valid. We need to add the page title through a different mechanism.

### [MODIFY] [layout.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/merchant/layout.jsx)

Add a `<title>` tag inside the merchant layout's return value. **Modify the Task 1 output** to include this inside the root `<div>`:

```jsx
// Add at the top of the return, before MerchantGuard:
<title>Tagdeer Merchant Portal</title>
```

The full updated return becomes:
```jsx
return (
    <>
        <title>Tagdeer Merchant Portal</title>
        <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans">
            <MerchantGuard>
                {!hideNav && <TopNav />}
                <main className="p-4 md:p-8 max-w-[1400px] mx-auto">
                    {children}
                </main>
            </MerchantGuard>
        </div>
    </>
);
```

> [!NOTE]
> In the Next.js App Router, `<title>` tags inside a Client Component are hoisted to `<head>` automatically. This replaces the `export const metadata` that was removed.

---

## Verification Plan

### Automated Tests

**1. Run the existing test suite to confirm no regressions:**
```bash
npx vitest run
```
All 60+ tests must pass. The existing admin user management test (`admin-user-management.test.jsx`) should still work because it mocks `useTagdeer()` — it doesn't depend on the layout structure.

**2. Run the build to confirm no compile errors:**
```bash
npm run build
```
Must complete with exit code 0. Specifically verify that:
- The client-side merchant layout compiles without metadata export errors
- The `<title>` tag renders without warnings

### Manual Verification (Staging)

After deploying to staging:

**Test 1 — Admin Portal Isolation:**
1. Navigate to `admin.staging.tagdeer.app`
2. Log in with admin credentials
3. **Verify:** No merchant TopNav appears (no "Tagdeer Merchant" header, no "Claim Another Business", no store selector)
4. **Verify:** Admin TopNav and AdminGuard render correctly
5. Navigate to Settings, Reports, Businesses tabs — confirm no merchant UI bleeds through

**Test 2 — Merchant Portal Unaffected:**
1. Navigate to `merchant.staging.tagdeer.app`
2. Log in with merchant credentials
3. **Verify:** Merchant TopNav appears with store selector, notification bell, user avatar
4. Navigate to Dashboard, Settings, Coupons — confirm TopNav persists
5. Navigate to `/login` — **Verify:** TopNav is hidden on the login page
6. Navigate to `/onboarding` — **Verify:** TopNav is hidden on the onboarding page

**Test 3 — Dual-Role Account:**
1. Log into `admin.staging.tagdeer.app` with an account that ALSO has merchant business data
2. **Verify:** Only admin UI renders — no merchant TopNav, no store selector
3. Open browser DevTools → Application → Cookies
4. **Verify:** `admin_auth` cookie has domain `.staging.tagdeer.app`

---

## Files Changed Summary

| # | File | Action | Description |
|---|---|---|---|
| 1 | `src/app/(portals)/merchant/layout.jsx` | **MODIFY** | Add `'use client'`, import and render `TopNav` inside `MerchantGuard` |
| 2 | `src/app/(portals)/layout.jsx` | **MODIFY** | Remove `TopNav` import, remove pathname logic, slim down to RTL + Toast wrapper |

**Total: 2 files modified. Zero new files. Zero deleted files.**
