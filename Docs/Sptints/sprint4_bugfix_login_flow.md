# Sprint 4 Bugfix — Login Flow Regression Fix

## Problem Statement

After deploying the portal context isolation fix, two critical login flow issues emerged on staging:

### Issue 1: Admin Login Layout Bleed
When visiting `admin.staging.tagdeer.app/login`, the authenticated Admin navigation bar (Settings, Reports, etc.) is visible **before** the user logs in.

### Issue 2: Merchant Login Redirect Hang
On `merchant.staging.tagdeer.app/login`, after entering credentials, the console shows `Supabase Auth Event: SIGNED_IN` but the UI hangs — no redirect to the dashboard.

---

## Root Cause Analysis

### Issue 1 — AdminTopNav Pathname Mismatch

The component tree for admin on the subdomain:

```
middleware rewrites: /login → /admin/login
AdminLayout renders:
  └── AdminGuard
       ├── AdminTopNav    ← renders because pathname check fails
       └── {children}     (login page)
```

**`AdminGuard`** (line 22) correctly detects `/login` and auto-approves, returning `children` which includes both `AdminTopNav` AND the login page.

**`AdminTopNav`** (line 33) has its own self-defense: `if (pathname === '/admin/login') return null`. But on the subdomain, `usePathname()` returns `/login`, not `/admin/login`. The check fails, so the nav renders.

**Root cause:** The `AdminTopNav` pathname check at [line 33](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/components/admin/AdminTopNav.jsx#L33) only accounts for path-based routing (`localhost:3000/admin/login`) but not subdomain routing (`admin.staging.tagdeer.app/login`).

### Issue 2 — Merchant Login Redirect Hang

The merchant login flow on page [login/page.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/merchant/login/page.jsx):

1. User submits password → calls `loginWithPassword(email, password)` (line 120)
2. `loginWithPassword` calls `supabase.auth.signInWithPassword` → fires `SIGNED_IN` event ✅
3. `onAuthStateChange` catches it → calls `syncUserProfile` → sets `user` with `role: 'merchant'`
4. The `useEffect` at line 43-49 checks `user.role === 'merchant'` → calls `navigateForward('/merchant/dashboard')`
5. `navigateForward` calls `router.push('/merchant/dashboard')`

The hang occurs because `router.push()` uses Next.js client-side navigation. On the subdomain (`merchant.staging.tagdeer.app`), the path `/merchant/dashboard` is rewritten by middleware to `/merchant/merchant/dashboard` (double prefix), OR the soft navigation doesn't trigger a full page reload, and the `MerchantGuard` enters an infinite loading state because the Supabase session cookies aren't properly scoped to the subdomain.

**Root cause:** The `navigateForward` function (line 34-39) and the auto-redirect `useEffect` (line 43-49) use `router.push('/merchant/dashboard')`. On the subdomain, the middleware already maps `/dashboard` → `/merchant/dashboard`. So the page should navigate to just `/dashboard`, not `/merchant/dashboard`.

This is the **same pattern** as `AdminGuard` line 42: `router.push('/login?redirect=...')` — it uses bare paths (no `/admin` prefix) because the middleware handles the rewrite.

Additionally, the `AdminTopNav` logout (line 30) uses `window.location.href = '/admin/login'` — a full page reload with the full path, which may also break on subdomain.

---

## Scope & Constraints

- **DO NOT** alter the portal context isolation in `(portals)/layout.jsx` or `(portals)/merchant/layout.jsx`
- **DO NOT** alter `serverAuth.js`, `adminAuth.js`, or cookie domain logic
- **DO NOT** change the `getServerUserWithRole` backend security logic
- Only modify the specific pathname checks and redirect paths that fail under subdomain routing

---

## TASK 1: Fix AdminTopNav Pathname Check

### Problem
`AdminTopNav` line 33 only checks `pathname === '/admin/login'`, missing the subdomain case where pathname is `/login`.

### [MODIFY] [AdminTopNav.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/components/admin/AdminTopNav.jsx)

**Line 33, current:**
```jsx
if (pathname === '/admin/login') return null;
```

**Replace with:**
```jsx
if (pathname === '/admin/login' || pathname === '/login') return null;
```

This mirrors the exact pattern already used in `AdminGuard` line 22: `if (pathname === '/admin/login' || pathname === '/login')`.

---

## TASK 2: Fix Merchant Login Redirect Paths

### Problem
The merchant login page uses `router.push('/merchant/dashboard')` (via `navigateForward`). On the subdomain, the middleware already maps `/dashboard` → `/merchant/dashboard`. Using `/merchant/dashboard` causes a double-prefix or fails to match.

### [MODIFY] [login/page.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/merchant/login/page.jsx)

**Change 1 — Auto-redirect useEffect (line 47):**

Current:
```jsx
navigateForward('/merchant/dashboard');
```

Replace with:
```jsx
navigateForward('/dashboard');
```

**Change 2 — `handleSetPassword` redirect (line 221):**

Current:
```jsx
navigateForward('/merchant/dashboard');
```

Replace with:
```jsx
navigateForward('/dashboard');
```

**Change 3 — `handleSkipPassword` redirect (line 225):**

Current:
```jsx
navigateForward('/merchant/dashboard');
```

Replace with:
```jsx
navigateForward('/dashboard');
```

**Change 4 — Use `window.location.href` for post-login redirect instead of `router.push`:**

The auto-redirect `useEffect` (line 43-49) uses `navigateForward` which calls `router.push()`. This is a soft navigation that does NOT trigger a full page reload, meaning cookies and session state may not be re-evaluated. For the critical post-login redirect, we need a hard navigation.

Current (line 43-49):
```jsx
useEffect(() => {
    if (!loading && user && user.role === 'merchant') {
        if (step === 'set-password') return;
        navigateForward('/merchant/dashboard');
    }
}, [user, loading, router, step, trialCampaign]);
```

Replace with:
```jsx
useEffect(() => {
    if (!loading && user && user.role === 'merchant') {
        if (step === 'set-password') return;
        const dashPath = trialCampaign ? `/dashboard?trial_campaign=${trialCampaign}` : '/dashboard';
        window.location.href = dashPath;
    }
}, [user, loading, step, trialCampaign]);
```

Using `window.location.href` ensures:
- A full page reload that re-evaluates all cookies and session state
- The middleware correctly rewrites the path for the current subdomain
- No stale React state carries over from the login page

> [!NOTE]
> This mirrors the admin login approach: [admin/login/page.jsx line 40](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/(portals)/admin/login/page.jsx#L40) already uses `window.location.href = redirectPath` for the same reason.

---

## TASK 3: Fix AdminTopNav Logout Path

### Problem
`AdminTopNav` line 30 uses `window.location.href = '/admin/login'`. On subdomain, this navigates to `admin.staging.tagdeer.app/admin/login` which gets rewritten to `/admin/admin/login` (double prefix).

### [MODIFY] [AdminTopNav.jsx](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/components/admin/AdminTopNav.jsx)

**Line 30, current:**
```jsx
window.location.href = '/admin/login'
```

**Replace with:**
```jsx
window.location.href = '/login'
```

The middleware will rewrite `/login` → `/admin/login` on the admin subdomain. On localhost path-based routing, `/login` still works because the middleware maps `admin.localhost:3000/login` → `/admin/login`.

---

## Verification Plan

### Automated Tests

**1. Run the existing test suite:**
```bash
npx vitest run
```
All existing assertions must still pass.

**2. Run the build:**
```bash
npm run build
```
Must complete with exit code 0.

### Manual Verification (Staging)

After deploying:

**Test 1 — Admin Login Page (Issue 1 Fix):**
1. Open `admin.staging.tagdeer.app/login` in an incognito window (no existing cookies)
2. **Verify:** No admin navigation bar is visible — only the login form
3. Log in with valid admin credentials
4. **Verify:** Admin navigation bar appears after successful login
5. Click Logout
6. **Verify:** Redirected to `/login`, navigation bar disappears

**Test 2 — Merchant Login Flow (Issue 2 Fix):**
1. Open `merchant.staging.tagdeer.app/login` in an incognito window
2. Enter valid merchant email and password
3. Click "Sign In"
4. **Verify:** Redirected to the merchant dashboard (no hang, no spinner)
5. **Verify:** Merchant TopNav is visible with store selector

**Test 3 — Localhost Regression:**
1. On `localhost:3000/admin/login`, verify admin login still works
2. On `localhost:3000/merchant/login`, verify merchant login still works
3. Both should redirect correctly with no double-prefix issues

---

## Files Changed Summary

| # | File | Action | Lines | Description |
|---|---|---|---|---|
| 1 | `src/components/admin/AdminTopNav.jsx` | MODIFY | 30, 33 | Add `/login` to pathname check; fix logout redirect path |
| 2 | `src/app/(portals)/merchant/login/page.jsx` | MODIFY | 43-49, 221, 225 | Use bare paths + `window.location.href` for post-login redirect |

**Total: 2 files modified. Zero new files. Zero deleted files.**
