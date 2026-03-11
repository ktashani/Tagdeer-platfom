# Sprint 4 — MerchantGuard Deadlock Fix

> **Severity**: Critical — Staging blocked  
> **Symptom**: `merchant.staging.tagdeer.app/dashboard` spins indefinitely  
> **Console**: `SIGNED_IN…` then `[MerchantGuard] Safety timeout: checkingSub forced to false after 8s`

---

## Root Cause Analysis

### The Deadlock Chain (3 Interlocking Bugs)

#### Bug 1 — `recheckRole()` Can Hang Forever (Line 61-79)

`recheckRole()` issues a Supabase query with **no timeout or AbortController**. If the query hangs (stale connection, RLS policy, network), the promise never resolves. `isAuthorized` is never set to `true`, and `router.push()` is never called.

#### Bug 2 — Subscription useEffect Has a Missing Branch (Line 88-129)

The subscription-check `useEffect` has three conditional branches, but **none cover** the state `{ isAuthorized: false, loading: false, user: null }`. When the auth effect redirects (sets `user = null`), `checkingSub` stays `true` permanently.

#### Bug 3 — The Double Trap Render Gate (Line 131)

```javascript
if (loading || checkingSub || !isAuthorized) return <Loading />
```

The 8-second safety timeout clears `checkingSub`, but `!isAuthorized` **remains `true`**. The spinner persists. The component is trapped — the subscription timeout was only half the fix.

### The Deadlock Sequence

```
1. User hits /dashboard → AuthProvider fires SIGNED_IN
2. MerchantGuard Effect 1: user.role !== 'merchant'
   → recheckRole() queries Supabase (can hang)
   → OR router.push('/login') called but isAuthorized never set
3. MerchantGuard Effect 2: no branch matches → checkingSub stays true
4. Safety timeout (8s): checkingSub → false
5. Render gate: loading=false, checkingSub=false, !isAuthorized=TRUE
   → ∞ SPINNER
```

---

## Strict Execution Rules

> [!CAUTION]
> - Do NOT touch `@supabase/ssr` logic
> - Do NOT modify `AuthProvider.jsx`, `BusinessDataProvider.jsx`, or `middleware.js`
> - ALL changes are in `src/components/merchant/MerchantGuard.jsx` only

---

## Implementation Specification

### Change 1 — Master Safety Timeout (Covers BOTH Flags)

Add a new `useEffect` (empty deps, fires once on mount) that forces both `checkingSub` and `isAuthorized` after 10 seconds. This is the **nuclear failsafe** — if any combination of bugs prevents resolution, the component unblocks.

```javascript
// Add after the existing useEffect blocks, before the render return
useEffect(() => {
    const masterTimeout = setTimeout(() => {
        if (isMounted.current && (checkingSub || !isAuthorized)) {
            console.warn('[MerchantGuard] Master timeout: forcing guard to unblock after 10s');
            setCheckingSub(false);
            setIsAuthorized(true);
        }
    }, 10000);
    return () => clearTimeout(masterTimeout);
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

### Change 2 — Timeout on `recheckRole()` Query

Replace the bare Supabase query with an `AbortController`-guarded version that aborts after 5 seconds:

```javascript
const recheckRole = async () => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
            .abortSignal(controller.signal);

        clearTimeout(timeout);

        if (profile?.role === 'merchant') {
            if (isMounted.current) setIsAuthorized(true);
        } else {
            const normalizedPath = pathname.startsWith('/merchant')
                ? pathname.replace(/^\/merchant/, '') || '/'
                : pathname;
            redirecting.current = true;
            router.push('/login?redirect=' + encodeURIComponent(normalizedPath) + '&reason=merchant_required');
        }
    } catch (err) {
        console.error('[MerchantGuard] recheckRole failed/aborted:', err);
        const normalizedPath = pathname.startsWith('/merchant')
            ? pathname.replace(/^\/merchant/, '') || '/'
            : pathname;
        redirecting.current = true;
        router.push('/login?redirect=' + encodeURIComponent(normalizedPath) + '&reason=merchant_required');
    }
};
```

### Change 3 — Catch-All Branch in Subscription useEffect

Add an `else` clause so every possible state resolves `checkingSub`:

```javascript
useEffect(() => {
    if (isAuthorized && user && supabase) {
        const checkSub = async () => { /* ... existing logic ... */ };
        checkSub();
    } else if (isAuthorized && !user) {
        if (isMounted.current) setCheckingSub(false);
    } else if (!isAuthorized && !loading && user !== undefined) {
        if (isMounted.current) setCheckingSub(false);
    } else {
        // CATCH-ALL: Covers { isAuthorized:false, user:null } and
        // any other unhandled state. Prevents permanent checkingSub=true.
        if (isMounted.current && !loading) {
            setCheckingSub(false);
        }
    }
    // Keep existing safety timeout as secondary safeguard
    const safetyTimer = setTimeout(() => { /* ... existing ... */ }, 8000);
    return () => clearTimeout(safetyTimer);
}, [isAuthorized, user, supabase, loading]);
```

### Change 4 — Redirect-in-Progress Ref

Add a `redirecting` ref to distinguish "waiting for auth" from "actively redirecting to login". This prevents the ambiguous spinner:

```javascript
// Add to state declarations
const redirecting = useRef(false);

// Set before every router.push() call in Effect 1:
redirecting.current = true;
router.push('/login?...');

// Add to the render, BEFORE the loading gate:
if (redirecting.current) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FB]">
            <p className="text-slate-500 text-sm">Redirecting to login…</p>
        </div>
    );
}

if (loading || checkingSub || !isAuthorized) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#F8F9FB]">
            <Loader2 className="h-8 w-8 animate-spin border-blue-600" />
        </div>
    );
}
```

---

## Verification Plan

### Build Check
```bash
npm run build
```

### Automated Tests
```bash
npx vitest run
```

### Staging Verification
1. Deploy to `merchant.staging.tagdeer.app`
2. **Happy path**: Login with merchant account → Dashboard loads < 3s
3. **Timeout path**: DevTools → Throttle to Slow 3G → Page shows "Redirecting" or renders within 10s
4. **Console audit**: No `Safety timeout` or `Master timeout` warnings during normal flow
