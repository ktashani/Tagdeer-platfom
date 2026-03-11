# Sprint 4 — TopNav Business Visibility Fix

## Root Cause Analysis

The merchant TopNav dropdown only displays **approved/published** businesses. Businesses that are "under review," have "missing documents," or are otherwise non-published are invisible to the merchant, even though they have an active `business_claims` record and the business's `claimed_by` field is set to their `user_id`.

### The Data Flow Chain

```
Supabase DB
  └── BusinessDataProvider.jsx (L36-38)           ← 🔴 PRIMARY FILTER
        └── businesses[] (TagdeerContext)
              └── ActiveBusinessProvider.jsx (L15) ← myBusinesses = businesses.filter(owner_id === user.id)
                    └── TopNav.jsx (L30)           ← Renders myBusinesses in the dropdown
```

### The Root Cause: `BusinessDataProvider.jsx` Lines 36-38

```javascript
let query = supabase.from('businesses').select('*, logs(*), storefronts(slug, logo_url, status)').limit(200);
if (!isAdmin) {
    query = query.eq('status', 'published');  // ← BLOCKS all non-published businesses
}
```

For non-admin users (including merchants), the Supabase query **only fetches businesses where `status = 'published'`**. A business that is `pending_review`, `under_review`, `draft`, or `restricted` is excluded from the result set entirely. This means:

1. `ActiveBusinessProvider.myBusinesses` never sees these businesses.
2. `TopNav.jsx`'s dropdown list only contains published businesses.
3. The merchant cannot select or interact with their pending business.

**The TopNav rendering code (L259-287) already handles pending/missing-docs UI correctly** — it checks `claimStatuses[store.id]` and displays appropriate status text. The rendering logic is not the problem. The data simply never arrives.

### Why This Doesn't Affect Consumer Safety

The current `.eq('status', 'published')` filter exists to protect consumers from seeing unpublished businesses in the public catalog. We must **preserve that consumer-facing filter** while adding a targeted exception for the **authenticated merchant viewing their own businesses**.

---

## Strict Execution Rules

1. **Absolute Adherence**: Follow this specification file-by-file. Do not invent alternative solutions.
2. **Zero Auth Changes**: Do NOT touch `middleware.js`, `AuthProvider.jsx`, `adminAuth.js`, `MerchantGuard.jsx`, or any cookie/session logic.
3. **Zero Schema Changes**: Do NOT modify any Supabase table names, column names, or RLS policies.
4. **Preserve ActiveBusinessProvider**: Do NOT modify `ActiveBusinessProvider.jsx`. Its filter logic (`owner_id === user.id || claimed_by === user.id`) is correct. The problem is upstream.
5. **Preserve TopNav Rendering**: The TopNav dropdown rendering logic is already correct. Do NOT change the JSX template for the dropdown items.

---

## Proposed Changes

### Task 1: Expand the Supabase Query in BusinessDataProvider

#### [MODIFY] `src/context/providers/BusinessDataProvider.jsx`

**The Problem**: Lines 36-38 apply a blanket `status = 'published'` filter for all non-admin users, preventing merchant-owned pending businesses from appearing.

**The Fix**: For authenticated non-admin users (merchants), run a **second query** to fetch the user's own businesses regardless of status, then merge the results. This is the safest approach because:
- It preserves the consumer-facing filter (other businesses remain filtered to `published` only).
- It does not require modifying RLS policies.
- It does not expose non-published businesses to users who don't own them.

**Specific changes (L29-41):**

Replace the current query block:

```javascript
useEffect(() => {
    const fetchBusinesses = async () => {
        if (!supabase) return;
        try {
            const ADMIN_ROLES = ['super_admin', 'admin', 'assistant_admin', 'support_agent'];
            const isAdmin = ADMIN_ROLES.includes(user?.role) || user?.userId === 'ADMIN-MOCK' || user?.isDevBypass;

            let query = supabase.from('businesses').select('*, logs(*), storefronts(slug, logo_url, status)').limit(200);
            if (!isAdmin) {
                query = query.eq('status', 'published');
            }

            const { data, error } = await query;
```

With:

```javascript
useEffect(() => {
    const fetchBusinesses = async () => {
        if (!supabase) return;
        try {
            const ADMIN_ROLES = ['super_admin', 'admin', 'assistant_admin', 'support_agent'];
            const isAdmin = ADMIN_ROLES.includes(user?.role) || user?.userId === 'ADMIN-MOCK' || user?.isDevBypass;

            let query = supabase.from('businesses').select('*, logs(*), storefronts(slug, logo_url, status)').limit(200);
            if (!isAdmin) {
                query = query.eq('status', 'published');
            }

            const { data, error } = await query;

            // For merchants: also fetch their own businesses regardless of status
            // so pending/under-review businesses appear in the TopNav dropdown
            let ownedData = [];
            if (!isAdmin && user?.id) {
                const { data: myOwned } = await supabase
                    .from('businesses')
                    .select('*, logs(*), storefronts(slug, logo_url, status)')
                    .eq('claimed_by', user.id)
                    .neq('status', 'published'); // Only fetch non-published ones to avoid duplicates

                ownedData = myOwned || [];
            }

            // Merge: published businesses + user's own non-published businesses
            const mergedData = [...(data || []), ...ownedData];
```

Then update the reference to `data` on the next line:

```diff
-               if (data) {
-                   const formattedData = data.map(b => {
+               if (mergedData) {
+                   const formattedData = mergedData.map(b => {
```

> [!IMPORTANT]
> The `ownedData` query uses `.neq('status', 'published')` specifically to avoid duplicating businesses that were already fetched by the primary `published` query. The `mergedData` array will contain all published businesses PLUS the user's own non-published businesses.

**Everything below the `mergedData` declaration remains unchanged.** The existing `formattedData` mapping (L64-113) and the `setBusinesses(formattedData)` call (L114) will now process both published and owned non-published businesses identically.

---

### Task 2: No Changes to ActiveBusinessProvider

#### [NO CHANGE] `src/context/providers/ActiveBusinessProvider.jsx`

The `myBusinesses` filter at L15:
```javascript
return businesses.filter(b => b.owner_id === user.id || b.claimed_by === user?.id);
```

This is already correct. Since `BusinessDataProvider` maps `claimed_by → owner_id` (L89), any business where `claimed_by === user.id` will now correctly pass through this filter, regardless of its status. **No changes needed.**

---

### Task 3: No Changes to TopNav Rendering

#### [NO CHANGE] `src/components/merchant/TopNav.jsx`

The dropdown rendering at L259-287 already:
- Iterates `myBusinesses` (which will now include pending businesses)
- Checks `claimStatuses[store.id]` for each business
- Displays "Pending Approval" (amber) or "Action Required" (red) status text
- Falls back to `store.region` for approved businesses

**No changes needed.** The existing UI will automatically display non-published businesses with their correct status badges once the data arrives.

---

### Task 4: No Changes to Dashboard State Logic

#### [NO CHANGE] `src/app/(portals)/merchant/dashboard/page.jsx`

The dashboard's `currentMockState` logic at L199-214 already handles:
- `pendingClaim === 'pending'` → `PENDING_APPROVAL`
- `myBusiness.status === 'restricted'` → `RESTRICTED`
- `myBusiness.status === 'pending_review'` → `PENDING_APPROVAL`
- `!myBusiness` → `NO_BUSINESS`

These states correctly map to the appropriate blocking/status screens. **No changes needed.**

---

## Verification Plan

### Automated Tests

```bash
# From the project root:
npm run build     # Confirms zero compilation errors, no missing imports
```

### Manual Verification (User)

After deploying to staging:

1. **Login** to `merchant.staging.tagdeer.app` with a user that owns 2+ businesses (one approved, one under review)
2. Open the TopNav **business dropdown** → **Both businesses should now appear** in the list
3. The under-review business should display "Pending Approval" in amber text
4. **Select the under-review business** → The dashboard should render the "Pending Approval" blocking screen
5. **Switch back to the approved business** → The dashboard should render the full metrics view
6. If a business has `missing_docs` status, it should show "Action Required" in red and allow the user to select it and access the document resubmission UI
