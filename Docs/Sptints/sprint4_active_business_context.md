# Sprint 4 — Active Business Context Isolation

## Root Cause Analysis

The merchant portal TopNav maintains a `selectedStoreId` state variable (TopNav.jsx:36) that tracks which business the user has selected from the dropdown. However, **this state is entirely local to the TopNav component** — it is never propagated to child pages via React Context, URL state, or any shared mechanism.

Meanwhile, all four merchant pages derive `myBusiness` independently using `businesses.find(b => b.owner_id === user?.id)`, which returns the **first** matching business in the array, regardless of the TopNav selection:

| File | Line | Current Logic | Problem |
|------|------|---------------|---------|
| `merchant/dashboard/page.jsx` | 92 | `businesses.find(b => b.owner_id === user?.id)` | Always returns first match |
| `merchant/inbox/page.jsx` | 24 | `businesses.find(b => b.owner_id === user?.id)` | Always returns first match |
| `merchant/settings/page.jsx` | 24 | `businesses?.find(b => b.owner_id === user?.id)` | Always returns first match |
| `merchant/coupons/page.jsx` | 25-34 | Own `selectedBusinessId` + dropdown | Isolated, correct but not shared |

The dashboard blocking logic (L194-206) evaluates `myBusiness.status` and `pendingClaim` from this first-match result. When the first business in the array happens to be the one "under review," the dashboard renders the blocker even if the user selected an approved business in the TopNav dropdown.

### Architecture Diagram

```
TopNav [selectedStoreId] ← LOCAL useState, not shared
    ├── dashboard/page.jsx → businesses.find(b => b.owner_id === user?.id) → FIRST match
    ├── inbox/page.jsx     → businesses.find(b => b.owner_id === user?.id) → FIRST match
    ├── settings/page.jsx  → businesses?.find(b => b.owner_id === user?.id) → FIRST match
    └── coupons/page.jsx   → own selectedBusinessId (isolated, not synced with TopNav)
```

---

## Strict Execution Rules

1. **Absolute Adherence**: Follow this specification file-by-file. Do not invent alternative solutions.
2. **Zero Auth Changes**: Do NOT touch `middleware.js`, `AuthProvider.jsx`, `supabaseClient.js`, `adminAuth.js`, `MerchantGuard.jsx`, or any cookie/session logic.
3. **Zero Schema Changes**: Do NOT modify any Supabase table names, column names, or queries beyond what is specified here. The data layer stabilization from the previous sprint step remains untouched.
4. **Preserve TopNav UI**: The TopNav dropdown UI, styling, and behavior must remain identical. We are only lifting its state management into a shared context.

---

## Proposed Changes

### Task 1: Create `ActiveBusinessProvider` Context

#### [NEW] `src/context/providers/ActiveBusinessProvider.jsx`

Create a new React Context provider that:
- Receives `businesses` and `user` from `useTagdeer()`
- Computes `myBusinesses` (all businesses where `owner_id === user?.id` OR `claimed_by === user?.id`)
- Manages `selectedBusinessId` in state
- Auto-selects the first business when `myBusinesses` loads and no selection exists
- Exposes `activeBusiness`, `myBusinesses`, `selectedBusinessId`, `setSelectedBusinessId`

```jsx
'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useTagdeer } from '@/context/TagdeerContext';

const ActiveBusinessContext = createContext();

export function ActiveBusinessProvider({ children }) {
    const { user, businesses } = useTagdeer();
    const [selectedBusinessId, setSelectedBusinessId] = useState(null);

    // Filter to businesses owned/claimed by the current user
    const myBusinesses = useMemo(() => {
        if (!businesses || !user) return [];
        return businesses.filter(b => b.owner_id === user.id || b.claimed_by === user?.id);
    }, [businesses, user]);

    // Auto-select first business when list populates and nothing is selected
    useEffect(() => {
        if (myBusinesses.length > 0 && !selectedBusinessId) {
            setSelectedBusinessId(myBusinesses[0].id);
        }
    }, [myBusinesses, selectedBusinessId]);

    // Derive the active business object from the selected ID
    const activeBusiness = useMemo(() => {
        return myBusinesses.find(b => b.id === selectedBusinessId) || myBusinesses[0] || null;
    }, [myBusinesses, selectedBusinessId]);

    return (
        <ActiveBusinessContext.Provider value={{
            activeBusiness,
            myBusinesses,
            selectedBusinessId,
            setSelectedBusinessId
        }}>
            {children}
        </ActiveBusinessContext.Provider>
    );
}

export const useActiveBusiness = () => useContext(ActiveBusinessContext);
```

---

### Task 2: Mount the Provider in the Merchant Layout

#### [MODIFY] `src/app/(portals)/merchant/layout.jsx`

Wrap the merchant layout children with `ActiveBusinessProvider`, **inside** `MerchantGuard` (so it has access to the authenticated user context).

```diff
 'use client';

 import { usePathname } from 'next/navigation';
 import MerchantGuard from '@/components/merchant/MerchantGuard';
 import TopNav from '@/components/merchant/TopNav';
+import { ActiveBusinessProvider } from '@/context/providers/ActiveBusinessProvider';

 export default function MerchantLayout({ children }) {
     const pathname = usePathname();

     const isOnboarding = pathname?.includes('/onboarding');
     const isLogin = pathname?.includes('/login');
     const isResetPassword = pathname?.includes('/reset-password');
     const hideNav = isOnboarding || isLogin || isResetPassword;

     return (
         <>
             <title>Tagdeer Merchant Portal</title>
             <div className="min-h-screen bg-[#F8F9FB] text-slate-900 font-sans">
                 <MerchantGuard>
-                    {!hideNav && <TopNav />}
-                    <main className="p-4 md:p-8 max-w-[1400px] mx-auto">
-                        {children}
-                    </main>
+                    <ActiveBusinessProvider>
+                        {!hideNav && <TopNav />}
+                        <main className="p-4 md:p-8 max-w-[1400px] mx-auto">
+                            {children}
+                        </main>
+                    </ActiveBusinessProvider>
                 </MerchantGuard>
             </div>
         </>
     );
 }
```

---

### Task 3: Refactor TopNav to Use Shared Context

#### [MODIFY] `src/components/merchant/TopNav.jsx`

Remove the local `selectedStoreId` state and `myBusinesses` computation. Import and consume `useActiveBusiness` instead. Map `activeStore` to `activeBusiness`.

**Specific changes:**

1. **Add import** (after other imports):
```diff
+import { useActiveBusiness } from '@/context/providers/ActiveBusinessProvider';
```

2. **Replace local state** (around L28-36): Remove the local `selectedStoreId` state and `myBusinesses` filter. Replace with context consumption.
```diff
     const { user, businesses, supabase, logout } = useTagdeer();
+    const { activeBusiness, myBusinesses, selectedBusinessId, setSelectedBusinessId } = useActiveBusiness();

     const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
     const storeMenuRef = useRef(null);

-    // Filter to only businesses owned by the current user
-    const myBusinesses = businesses?.filter(b => b.owner_id === user?.id) || [];
-
-    const [selectedStoreId, setSelectedStoreId] = useState(null);
     const [pendingClaim, setPendingClaim] = useState(null);
```

3. **Remove the auto-select useEffect** (L80-84): The context provider handles this now.
```diff
-    // Default select the first business when loaded
-    useEffect(() => {
-        if (myBusinesses.length > 0 && !selectedStoreId) {
-            setSelectedStoreId(myBusinesses[0].id);
-        }
-    }, [myBusinesses, selectedStoreId]);
```

4. **Replace `activeStore` variable** (L130):
```diff
-    const activeStore = myBusinesses?.find(b => b.id === selectedStoreId) || myBusinesses?.[0];
+    const activeStore = activeBusiness;
```

5. **Update `handleStoreSelect`** (L136-139):
```diff
     const handleStoreSelect = (storeId) => {
-        setSelectedStoreId(storeId);
+        setSelectedBusinessId(storeId);
         setIsStoreMenuOpen(false);
     };
```

6. **Update all references** to `selectedStoreId` in the JSX to use `selectedBusinessId`:
   - L270: `const isActive = store.id === selectedStoreId;` → `const isActive = store.id === selectedBusinessId;`

---

### Task 4: Refactor Dashboard to Use Shared Context

#### [MODIFY] `src/app/(portals)/merchant/dashboard/page.jsx`

Replace the hardcoded `.find()` with `useActiveBusiness()`.

1. **Add import**:
```diff
+import { useActiveBusiness } from '@/context/providers/ActiveBusinessProvider';
```

2. **Replace myBusiness derivation** (L92):
```diff
-    // Find the currently authenticated merchant's business
-    // Note: TagdeerContext maps claimed_by → owner_id
-    const myBusiness = businesses.find(b => b.owner_id === user?.id);
+    const { activeBusiness: myBusiness } = useActiveBusiness();
```

3. **Update the `pendingClaim` fetch** (L104-129): The claim query currently fetches the **latest claim for the user** regardless of business. It must be scoped to the active business. Change L114 to also filter by the active business:
```diff
                 const { data: claimData, error: claimQueryError } = await supabase
                     .from('business_claims')
                     .select('id, status, claim_status, business_id')
                     .eq('user_id', user.id)
+                    .eq('business_id', myBusiness?.id)
                     .order('created_at', { ascending: false })
                     .limit(1)
-                    .single();
+                    .maybeSingle();
```
> [!IMPORTANT]
> Change `.single()` to `.maybeSingle()` since the active approved business may have no claim record at all (businesses can be approved without a claim if auto-published by admin). Without this, `.single()` would error with PGRST116 when no row matches.

4. **Update `useEffect` dependency** (L189): Replace `myBusiness?.id` dependency (which now comes from context) and add `myBusiness?.id` as a proper dep:
```diff
-    }, [supabase, myBusiness?.id, user?.id]);
+    }, [supabase, myBusiness?.id, user?.id, myBusiness]);
```
> Note: since `myBusiness` is now a context value that changes when the user selects a different business, this ensures the dashboard re-fetches all data when the active business changes.

---

### Task 5: Refactor Inbox to Use Shared Context

#### [MODIFY] `src/app/(portals)/merchant/inbox/page.jsx`

1. **Add import**:
```diff
+import { useActiveBusiness } from '@/context/providers/ActiveBusinessProvider';
```

2. **Replace myBusiness derivation** (L24):
```diff
-    const myBusiness = user && businesses ? businesses.find(b => b.owner_id === user?.id) : null;
+    const { activeBusiness: myBusiness } = useActiveBusiness();
```

---

### Task 6: Refactor Settings to Use Shared Context

#### [MODIFY] `src/app/(portals)/merchant/settings/page.jsx`

1. **Add import**:
```diff
+import { useActiveBusiness } from '@/context/providers/ActiveBusinessProvider';
```

2. **Replace myBusiness derivation** (L24):
```diff
-    // Dynamic Business Context Search
-    const myBusiness = businesses?.find(b => b.owner_id === user?.id) || null;
+    const { activeBusiness: myBusiness } = useActiveBusiness();
```

---

### Task 7: Refactor Coupons to Use Shared Context

#### [MODIFY] `src/app/(portals)/merchant/coupons/page.jsx`

The coupons page already has its own `selectedBusinessId` local state. We replace it with the shared context.

1. **Add import**:
```diff
+import { useActiveBusiness } from '@/context/providers/ActiveBusinessProvider';
```

2. **Replace local state** (L24-34):
```diff
-    // Support multi-business
-    const myBusinesses = businesses ? businesses.filter(b => b.owner_id === user?.id || b.claimed_by === user?.id) : [];
-    const [selectedBusinessId, setSelectedBusinessId] = useState('');
-
-    useEffect(() => {
-        if (myBusinesses.length > 0 && !selectedBusinessId) {
-            setSelectedBusinessId(myBusinesses[0].id);
-        }
-    }, [myBusinesses, selectedBusinessId]);
-
-    const myBusiness = myBusinesses.find(b => b.id === selectedBusinessId) || myBusinesses[0];
+    const { activeBusiness: myBusiness, myBusinesses, selectedBusinessId, setSelectedBusinessId } = useActiveBusiness();
```

---

## Verification Plan

### Automated Tests

```bash
# From the project root:
npm run build     # Confirms zero compilation errors, no missing imports
npm run test      # Runs existing Vitest suite
```

### Manual Verification (User)

After deploying to staging:

1. **Login** to `merchant.staging.tagdeer.app` with a user that owns **2+ businesses** (one approved, one under review)
2. The TopNav dropdown should display both businesses
3. Select the **approved** business → the dashboard should render the full metrics view (NOT the "Under Review" blocker)
4. Select the **under review** business → the dashboard should correctly render the "Pending Approval" blocker
5. Navigate to **Coupons**, **Inbox**, and **Settings** → each page should reflect the currently selected business from the TopNav, without requiring its own dropdown
6. Switch businesses in the TopNav dropdown on ANY page → the current page should re-render with the newly selected business's data
