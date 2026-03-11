# 🔬 Portal Split-Brain Investigation Report

**Date:** 2026-03-11
**Investigator:** Lead Systems & Frontend Architect
**Severity:** 🔴 Critical UI/Security Boundary Violation
**Environment:** admin.staging.tagdeer.app

---

## 1. Root Cause Analysis

The split-brain state is caused by a **shared context provider wrapping mutually exclusive portal boundaries**. Here is the exact component tree that renders when an admin visits `admin.staging.tagdeer.app/settings`:

```
RootLayout (src/app/layout.jsx)
 └── TagdeerProvider                          ← 🔴 PROBLEM LAYER
      ├── AuthProvider                        ← Fetches Supabase session for ANY authenticated user
      ├── BusinessDataProvider                ← Loads ALL businesses (including ones owned by this user)
      ├── UIProvider                          ← Language, modals, toast state
      └── TagdeerBridge (merges all into useTagdeer())
           └── PortalsLayout (src/app/(portals)/layout.jsx)   ← 🔴 SHARED BY BOTH PORTALS
                ├── TopNav (merchant/TopNav.jsx)               ← 🔴 CONDITIONALLY HIDDEN, NOT UNMOUNTED
                └── AdminLayout (src/app/(portals)/admin/layout.jsx)
                     ├── AdminGuard
                     ├── AdminTopNav
                     └── {children} (admin settings page)
```

### The Three Cascading Failures:

**Failure 1 — Context is Portal-Agnostic:**
`TagdeerProvider` wraps the **entire application** at the root level ([layout.jsx:13](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/layout.jsx#L13)). It makes no distinction between admin, merchant, or consumer sessions. When an admin logs in, `AuthProvider` detects the Supabase session and `BusinessDataProvider` eagerly loads **all businesses** — including ones this admin user happens to own as a merchant. This merchant data is now available to every component in the tree via `useTagdeer()`.

**Failure 2 — Portals Layout is Shared, Not Isolated:**
Both `/admin/*` and `/merchant/*` routes live under the same `(portals)` route group. The [portals/layout.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/layout.jsx) is a `'use client'` component that:
- Calls `useTagdeer()` to get `user`, `isRTL`, `toastMessage` ([line 11](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/layout.jsx#L11))
- Checks `pathname.startsWith('/admin')` to decide whether to render `TopNav` ([line 17-18](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/layout.jsx#L17-L18))
- But `TopNav` is the **Merchant** TopNav, imported directly from `@/components/merchant/TopNav` ([line 5](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/layout.jsx#L5))

On the admin subdomain, the middleware rewrites `/settings` → `/admin/settings`. But `usePathname()` returns `/admin/settings`, so `isAdmin = true` and `hideNav = true` — the merchant TopNav is **visually hidden**. However, the `PortalsLayout` component itself still renders, and its parent `TagdeerProvider` has already populated the React context with merchant data.

**Failure 3 — Data-Driven UI Instead of Route-Driven UI:**
The admin account used for testing has merchant business data attached. Even though the merchant TopNav is hidden, any child component that calls `useTagdeer()` receives `businesses`, `user.role`, `user.gader`, etc. If any component inside the admin tree (e.g., a shared Header, a settings panel, or a dashboard widget) reads `businesses` from context and renders based on its **presence**, it will render merchant UI. The component tree trusts the data payload over the routing boundary.

---

## 2. Current Setup Flaw

The fundamental flaw is an **architectural category error**: the platform uses a single, monolithic React context (`TagdeerProvider`) to serve three fundamentally different user experiences (Consumer, Merchant, Admin), and it determines which UI to show based on **data inspection** rather than **route isolation**.

### Specific Anti-Patterns Identified:

| Anti-Pattern | Location | Explanation |
|---|---|---|
| **God Context** | [TagdeerContext.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/context/TagdeerContext.jsx) | `TagdeerBridge` merges Auth + Business + UI into one hook. Admin pages can access `businesses`, `supabase.from('logs')`, merchant state, etc. |
| **Shared Portal Layout** | [(portals)/layout.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/layout.jsx) | Admin and Merchant share one layout that imports the Merchant `TopNav`. The hiding is conditional (`pathname.startsWith('/admin')`) but the component is still in the React tree. |
| **Eager Data Loading** | [BusinessDataProvider.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/context/providers/BusinessDataProvider.jsx) | Loads all businesses on mount, regardless of whether the user is in the admin or merchant portal. An admin viewing `/admin/settings` triggers merchant-specific Supabase queries. |
| **Implicit Identity** | [TopNav.jsx:28](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/components/merchant/TopNav.jsx#L28) | `const { user, businesses, supabase, logout } = useTagdeer()` — TopNav determines its visual state from database data (businesses array, subscription tier), not from the route it's rendered in. |

### Why It Works on Localhost:

On localhost, the middleware rewrites work within a single domain (`localhost:3000`). The admin layout's `pathname.startsWith('/admin')` check correctly hides the merchant TopNav. But the shared context **still loads merchant data** — it just wasn't visible because no admin-side component happened to render it. On staging, timing differences or component hydration order may cause the merchant header to flash before the admin layout suppresses it.

---

## 3. Advised Solution Architecture

### Principle: **Route Groups = Context Boundaries**

The Next.js App Router's route groups (`(consumer)`, `(portals)`) should each have their own **isolated context provider tree**. A component inside `(portals)/admin/` should never have access to merchant-specific context like `businesses[]` or `subscriptions`.

### Proposed Architecture:

```
src/app/layout.jsx
 └── CoreProvider (auth-only: session, user identity, language)
      ├── (consumer)/layout.jsx
      │    └── ConsumerProvider (businesses list, voting, modals)
      │
      ├── (portals)/admin/layout.jsx
      │    └── AdminProvider (admin-specific state only)
      │         └── AdminGuard → AdminTopNav → {page}
      │
      └── (portals)/merchant/layout.jsx
           └── MerchantProvider (businesses owned, coupons, inbox)
                └── MerchantGuard → MerchantTopNav → {page}
```

### Key Changes:

**3a. Eliminate the Shared `(portals)/layout.jsx`:**
Move the Merchant `TopNav` into the merchant-specific layout (`(portals)/merchant/layout.jsx`). The admin layout already has its own `AdminTopNav`. There is no reason for them to share a parent layout that conditionally renders one or the other.

**3b. Split `TagdeerProvider` into Route-Specific Providers:**
- **`CoreProvider`** (root layout): Only handles `supabase`, `user` session, `lang`, `isRTL`. No business data.
- **`MerchantProvider`** (merchant layout): Wraps merchant routes only. Provides `businesses`, `subscriptions`, `claims`, `inbox`. Only loads data for the authenticated merchant.
- **`AdminProvider`** (admin layout): Wraps admin routes only. Provides admin-specific state (user management, platform stats). Does NOT load `businesses` for the logged-in user.
- **`ConsumerProvider`** (consumer layout): Wraps consumer routes. Provides the public business list, voting state, modals.

**3c. Enforce "Route Trusts Route, Not Data":**
Every shared UI component (buttons, headers, navigation) should receive its **portal context** as an explicit prop or from a route-specific hook — never by inspecting the user's data payload:

```jsx
// ❌ WRONG — component decides its identity from data
const { businesses } = useTagdeer();
if (businesses.length > 0) return <MerchantHeader />;

// ✅ CORRECT — component receives its identity from the route
const { portalType } = usePortalContext(); // "admin" | "merchant" | "consumer"
if (portalType === "merchant") return <MerchantHeader />;
```

---

## 4. Operational Preventative Measures

### 4a. Staging Test Account Separation

| Account | Email | Role | Business Data |
|---|---|---|---|
| Admin Test | `admin-test@tagdeer.app` | `super_admin` | ❌ No businesses attached |
| Merchant Test | `merchant-test@tagdeer.app` | `merchant` | ✅ Has businesses |
| Consumer Test | `consumer-test@tagdeer.app` | `consumer` | ❌ No businesses |
| Dual-Role Test | `dual-test@tagdeer.app` | `super_admin` + merchant data | ✅ Specifically for testing cross-contamination |

> [!IMPORTANT]
> The admin test account used in staging should **never** have business ownership data attached. This ensures that the split-brain bug is caught immediately — if admin UI shows any merchant data, it's a context isolation failure, not a "well the admin also happens to be a merchant" edge case.

### 4b. Automated Guard: Portal Boundary Test

Add a test that asserts the component tree isolation:

```javascript
// Verify admin route tree never renders merchant components
test('admin layout does not render MerchantTopNav', () => {
    // Render AdminLayout with a mock admin user WHO HAS business data
    // Assert that TopNav (merchant) is NOT in the document
    // Assert that AdminTopNav IS in the document
});
```

### 4c. Runtime Safety Net

Until the full architectural refactor is completed, add a runtime assertion in `TopNav.jsx`:

```javascript
// TopNav.jsx — safety valve
const pathname = usePathname();
if (pathname?.startsWith('/admin')) {
    console.error('[TopNav] CRITICAL: Merchant TopNav rendered inside admin route');
    return null; // Refuse to render
}
```

This is a **stopgap**, not a fix. The real fix is Section 3.

---

## Summary

| # | Finding | Severity | Fix Effort |
|---|---|---|---|
| 1 | `TagdeerProvider` wraps all routes, loads merchant data globally | 🔴 Critical | Medium (split into route-specific providers) |
| 2 | `(portals)/layout.jsx` shared by admin + merchant | 🔴 Critical | Low (move TopNav to merchant layout) |
| 3 | Components determine identity from data, not route | 🟡 Medium | High (requires auditing all shared components) |
| 4 | No test account separation in staging | 🟡 Medium | Low (create dedicated test accounts) |

> [!CAUTION]
> **Do not attempt a "quick fix" by adding more `if (isAdmin)` checks.** This is a systemic architectural issue. Every new `if` check is a new surface for the bug to reappear. The correct fix is context isolation at the route group boundary.
