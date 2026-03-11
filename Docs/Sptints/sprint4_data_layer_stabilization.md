# Sprint 4 — Data Layer Stabilization

## Root Cause Analysis

The 400 (Bad Request) and 404 (Not Found) Supabase REST API errors on the admin and merchant staging portals are **NOT** caused by RLS failures or the recent auth/cookie migration. They are caused by **schema drift** — the code references table names and column names that do not match the actual Supabase database schema.

These mismatches existed before our auth deployment, but were silently masked by surrounding `try/catch` blocks. The auth instability we fixed in Sprint 4 Phase 1 amplified the symptoms: when `AuthProvider`'s `syncUserProfile` fires during the unstable `SIGNED_IN → null → SIGNED_IN` cycle, it triggers `BusinessDataProvider` and all page-level data fetches in rapid succession, flooding the console with previously-silent 400/404 errors for every re-render cycle.

### Failure Vector Map

| # | Error | File | Code | Root Cause |
|---|-------|------|------|------------|
| 1 | **404** | `admin/page.jsx:66` | `.from('coupon_pools')` | Table is `platform_coupon_pools` |
| 2 | **404** | `merchant/dashboard/page.jsx:164` | `.from('coupon_pools')` | Same as #1 |
| 3 | **400** | `admin/page.jsx:32` | `.gt('gader', 1000)` | Column is `gader_points` |
| 4 | **400** | `admin/reports/page.jsx:40` | `.select('trust_points')` | Column doesn't exist on `profiles` |
| 5 | **404** | `BusinessDataProvider.jsx:47` | `.from('business_ribbons')` | Table may not exist yet, needs safe guard |
| 6 | **404** | `merchant/dashboard/page.jsx:153` | `.from('feature_allocations')` | Table may not exist yet, needs safe guard |

> **IMPORTANT:** These are schema drift bugs, not auth or RLS issues. The fix is strictly correcting table/column names and hardening error boundaries. No auth logic is modified.

---

## Strict Execution Rules

1. **Absolute Adherence**: Follow this specification file-by-file, line-by-line. Do not invent alternative solutions.
2. **Surgical Precision**: Modify ONLY the 4 files listed below. Do NOT touch auth, middleware, guards, or context provider structure.
3. **No RLS Bypass**: Do not use `.rpc()` or service-role keys to work around query failures.
4. **Error Boundary Pattern**: For tables that may not exist yet (`business_ribbons`, `feature_allocations`), wrap the query in its own `try/catch` with a fallback to an empty result — do NOT let it crash the parent `try` block.

---

## Proposed Changes

### Task 1: Fix `coupon_pools` → `platform_coupon_pools` AND `gader` → `gader_points` (Admin Dashboard)

#### [MODIFY] `src/app/(portals)/admin/page.jsx`

**Change 1 (L32)**: Fix column name in VIP users query.
```diff
                     .from('profiles')
                     .select('*', { count: 'exact', head: true })
-                    .gt('gader', 1000)
+                    .gt('gader_points', 1000)
```

**Change 2 (L65-71)**: Fix table name for coupon pools query.
```diff
                 try {
                     const { data: pools } = await supabase
-                        .from('coupon_pools')
+                        .from('platform_coupon_pools')
                         .select('amount, remaining');
```

---

### Task 2: Fix `coupon_pools` → `platform_coupon_pools` AND harden `feature_allocations` (Merchant Dashboard)

#### [MODIFY] `src/app/(portals)/merchant/dashboard/page.jsx`

**Change 1 (L152-160)**: Wrap `feature_allocations` query in its own `try/catch` since the table may not be provisioned yet.
```diff
-                const { data: allocations } = await supabase
-                    .from('feature_allocations')
-                    .select('feature_type')
-                    .eq('business_id', myBusiness.id)
-                    .eq('status', 'active');
-
-                if (allocations) {
-                    setActiveFeatures(allocations.map(a => a.feature_type));
-                }
+                try {
+                    const { data: allocations } = await supabase
+                        .from('feature_allocations')
+                        .select('feature_type')
+                        .eq('business_id', myBusiness.id)
+                        .eq('status', 'active');
+
+                    if (allocations) {
+                        setActiveFeatures(allocations.map(a => a.feature_type));
+                    }
+                } catch (_) { /* table may not exist yet */ }
```

**Change 2 (L164)**: Fix table name for coupon pools query.
```diff
                 const { data: campaigns } = await supabase
-                    .from('coupon_pools')
+                    .from('platform_coupon_pools')
                     .select('id, title, amount, remaining, status')
```

---

### Task 3: Fix `trust_points` → `gader_points` (Admin Reports)

#### [MODIFY] `src/app/(portals)/admin/reports/page.jsx`

**Change 1 (L40)**: Fix column name. `trust_points` does not exist on the `profiles` table — the correct column is `gader_points`.
```diff
-                    supabase.from('profiles').select('trust_points')
+                    supabase.from('profiles').select('gader_points')
```

**Change 2 (L46)**: Update the property access to match the corrected column name.
```diff
-                    const totalTrust = profilesRes.data.reduce((acc, curr) => acc + (curr.trust_points || 0), 0);
+                    const totalTrust = profilesRes.data.reduce((acc, curr) => acc + (curr.gader_points || 0), 0);
```

---

### Task 4: Verify `business_ribbons` Query (BusinessDataProvider) — NO CHANGE NEEDED

#### [VERIFY ONLY] `src/context/providers/BusinessDataProvider.jsx`

The `business_ribbons` query (L44-57) is already wrapped in a `try/catch` with a safe comment `/* safe to ignore */`. **This is already correct.** The Worker must verify this and NOT modify it.

---

## Verification Plan

### Automated Tests

```bash
# From the project root:
npm run build     # Confirms zero compilation errors
vitest run        # Runs existing component test suite
```

### Manual Verification

After deploying to staging, the user should:

1. Navigate to `admin.staging.tagdeer.app` and open the browser DevTools Console
2. Verify that the "The Pulse" dashboard loads without any `400` or `404` errors in the Network tab
3. Navigate to the Reports page and confirm the "Platform Health Score" and "Total Registered Users" load correctly
4. Switch to `merchant.staging.tagdeer.app`, log in, and verify the merchant dashboard loads without `404` errors on coupon/campaign data
