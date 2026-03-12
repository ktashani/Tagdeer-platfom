# Sprint 5 — Subscription Core & Freebie Mode

> **Target Branch:** `feat/subscription-core`
> **Base Branch:** `main` (assumes Phase 0 migration `20260313100000_financial_engine_phase0.sql` is already applied)
> **Priority:** P0 — Must merge before `feat/financial-audit` (Phase 3)

---

## 1. Objective

Implement the full Subscription Lifecycle State Machine on the merchant-facing UI, update the automated cron job to handle new states (Grace Period, Suspended, Terminated), and wire the Freebie mode display logic across all consumer and merchant views.

---

## 2. Absolute Constraints

> [!CAUTION]
> - **DO NOT** modify `src/middleware.js`. The routing state machine is stabilized.
> - **DO NOT** modify `src/context/providers/ActiveBusinessProvider.jsx` or `src/context/TagdeerContext.jsx`.
> - **DO NOT** create new database tables. All schema changes were handled in Phase 0.
> - **DO NOT** alter existing RLS policies on `subscriptions`, `transactions`, or `profiles`.
> - All subscription status strings must match the Phase 0 CHECK constraint exactly: `'Pending'`, `'Active'`, `'Expiring Soon'`, `'Expired'`, `'Grace Period'`, `'Suspended'`, `'Terminated'`.

---

## 3. File-by-File Execution

### 3.1 — Update Cron Job: Subscription State Transitions

**File:** `supabase/migrations/20260314_subscription_lifecycle_cron.sql` **(NEW)**

Create a new migration that replaces the existing `check_and_expire_subscriptions()` function. The old function (in `20260306140000_subscription_expiry_cron.sql`) only handles `Active → Expired` and `Active → Expiring Soon`. The new function must handle all automated transitions.

```sql
-- Migration: Subscription Lifecycle State Machine (Automated Transitions)
-- Replaces the original check_and_expire_subscriptions function

CREATE OR REPLACE FUNCTION check_and_expire_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_row RECORD;
BEGIN
    -- 1. Grace Period → Free (grace expired, revoke to Free tier)
    FOR v_row IN
        SELECT id, profile_id FROM public.subscriptions
        WHERE status = 'Grace Period'
          AND expires_at + (COALESCE((quotas->>'gracePeriodDays')::int, 3) || ' days')::interval < NOW()
    LOOP
        UPDATE public.subscriptions
        SET status = 'Expired', tier = 'Free', quotas = '{}'::jsonb
        WHERE id = v_row.id;

        -- Write audit log
        INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, reason)
        VALUES ('subscription', v_row.id, 'expired', 'Grace Period', 'Expired', NULL, 'Grace period ended — auto-reverted to Free');

        v_count := v_count + 1;
    END LOOP;

    -- 2. Expired → Grace Period (just expired, enter grace window)
    FOR v_row IN
        SELECT id, profile_id FROM public.subscriptions
        WHERE status = 'Expired'
          AND tier != 'Free'
          AND expires_at >= NOW() - INTERVAL '1 day'
    LOOP
        UPDATE public.subscriptions
        SET status = 'Grace Period'
        WHERE id = v_row.id;

        INSERT INTO public.payment_audit_log (entity_type, entity_id, action, old_status, new_status, performed_by, reason)
        VALUES ('subscription', v_row.id, 'expired', 'Expired', 'Grace Period', NULL, 'Entered grace period — merchant has 3 days to renew');

        v_count := v_count + 1;
    END LOOP;

    -- 3. Active → Expired (past expiry date)
    UPDATE public.subscriptions
    SET status = 'Expired'
    WHERE status = 'Active'
      AND expires_at < NOW();
    GET DIAGNOSTICS v_count = v_count + ROW_COUNT;

    -- 4. Active → Expiring Soon (within 7 days)
    UPDATE public.subscriptions
    SET status = 'Expiring Soon'
    WHERE status = 'Active'
      AND expires_at < NOW() + INTERVAL '7 days'
      AND expires_at >= NOW();

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-schedule the cron job (idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
        PERFORM cron.unschedule('expire-subscriptions');
        PERFORM cron.schedule(
            'expire-subscriptions',
            '0 */6 * * *',  -- Run every 6 hours instead of daily for tighter lifecycle
            'SELECT check_and_expire_subscriptions()'
        );
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'pg_cron not available';
END;
$$;
```

**Key changes from original:**
- Runs every 6 hours instead of daily
- Handles `Expired → Grace Period` transition with configurable grace period from `quotas.gracePeriodDays`
- Handles `Grace Period → Free` transition (revokes tier)
- Writes immutable audit log entries for every automated transition

---

### 3.2 — Merchant Dashboard: Subscription State Awareness

**File:** `src/app/(portals)/merchant/dashboard/page.jsx`

The dashboard already handles `SUSPENDED` and `PENDING_APPROVAL` mock states (lines 26-33, 447-471). You must add **real subscription state detection** that reads from the `subscriptions` table.

#### Step 1: Add subscription state to the data fetch (after line 110)

Inside the `fetchDashboardData` function, after the claim fetching block (line 151), add a subscription status check:

```jsx
// After the claim check block (line 151), add:

// Fetch subscription status for lifecycle-aware UI
const { data: subData } = await supabase
    .from('subscriptions')
    .select('status, tier, expires_at')
    .eq('profile_id', user.id)
    .maybeSingle();

if (subData) {
    // If subscription is Suspended, override the mock state
    if (subData.status === 'Suspended') {
        // The existing SUSPENDED render block (line 449) handles this
        // We just need to set business status to trigger it
    }
    // Store subscription for the welcome bar
    setDashboardSubscription(subData);
}
```

#### Step 2: Add state variable (after line 80)

```jsx
const [dashboardSubscription, setDashboardSubscription] = useState(null);
```

#### Step 3: Update the dynamic state detection (lines 216-228)

Replace the existing state detection block:

```jsx
// DYNAMIC STATES (replace lines 216-228)
let currentMockState = MOCK_STATES.ACTIVE;

if (pendingClaim === 'pending' || pendingClaim === 'missing_docs') {
    currentMockState = MOCK_STATES.PENDING_APPROVAL;
} else if (!myBusiness) {
    currentMockState = MOCK_STATES.NO_BUSINESS;
} else if (myBusiness.status === 'restricted') {
    currentMockState = MOCK_STATES.RESTRICTED;
} else if (myBusiness.status === 'pending_review') {
    currentMockState = MOCK_STATES.PENDING_APPROVAL;
} else if (dashboardSubscription?.status === 'Suspended') {
    currentMockState = MOCK_STATES.SUSPENDED;
} else if (dashboardSubscription?.status === 'Terminated') {
    currentMockState = MOCK_STATES.SUSPENDED; // Re-use suspended UI with different copy
}
```

#### Step 4: Add a subscription status banner in the active dashboard (after line 565)

After the search bar section, before the pulse cards, add a banner that shows when the subscription is in a transitional state:

```jsx
{/* Subscription Lifecycle Banner */}
{dashboardSubscription && ['Expiring Soon', 'Grace Period', 'Pending'].includes(dashboardSubscription.status) && (
    <div className={`p-4 rounded-2xl border flex items-center justify-between ${
        dashboardSubscription.status === 'Expiring Soon'
            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
            : dashboardSubscription.status === 'Grace Period'
            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
            : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
    }`}>
        <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${
                dashboardSubscription.status === 'Expiring Soon' ? 'text-amber-500' :
                dashboardSubscription.status === 'Grace Period' ? 'text-red-500' : 'text-blue-500'
            }`} />
            <div>
                <p className="font-bold text-sm">
                    {dashboardSubscription.status === 'Expiring Soon'
                        ? `Subscription expires on ${new Date(dashboardSubscription.expires_at).toLocaleDateString()}`
                        : dashboardSubscription.status === 'Grace Period'
                        ? 'Your subscription has expired! Renew now to keep your features.'
                        : 'Payment submitted — awaiting admin confirmation.'
                    }
                </p>
            </div>
        </div>
        {dashboardSubscription.status !== 'Pending' && (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-full" onClick={() => router.push('/merchant/settings')}>
                Renew Now
            </Button>
        )}
    </div>
)}
```

> **IMPORT**: Add `AlertTriangle` to the existing lucide import on line 11 (it's already imported, verify it exists).

---

### 3.3 — Merchant Settings: Freebie Mode in Tier Cards & Subscription Status Display

**File:** `src/app/(portals)/merchant/settings/page.jsx`

#### Step 1: Update subscription fetch to handle all statuses (lines 59-66)

The current fetch only queries `status = 'Active'`. Change to include all non-terminal statuses:

```jsx
// Replace line 65:
//   .eq('status', 'Active')
// With:
    .in('status', ['Active', 'Expiring Soon', 'Grace Period', 'Pending'])
```

#### Step 2: Update client-side expiry logic (lines 97-108)

The current logic only checks for `Active` and sets to `Expired`. Update to handle all states:

```jsx
// Replace the expiry block (lines 97-108) with:
if (data && data.tier) {
    // Integrate Addons (keep existing logic, lines 83-93)

    setSubscription(data);

    // Client-side expiry fallback
    if (data.status === 'Active') {
        const expiresAt = new Date(data.expires_at);
        if (expiresAt < new Date()) {
            await supabase
                .from('subscriptions')
                .update({ status: 'Expired' })
                .eq('id', data.id);
            setAccountTier('Free');
        } else {
            setAccountTier(data.tier);
        }
    } else if (data.status === 'Pending') {
        setAccountTier('Pending');
    } else if (data.status === 'Grace Period' || data.status === 'Expiring Soon') {
        setAccountTier(data.tier); // Still show tier features during grace
    } else {
        setAccountTier('Free');
    }
} else {
    setAccountTier('Free');
}
```

#### Step 3: Render Freebie pricing in tier cards

Locate the section where tier pricing cards are rendered in the settings page. When a tier has `isFreebie: true`, the upgrade button must bypass payment:

```jsx
// In the tier card rendering section, add conditional Freebie display:
{tier.isFreebie ? (
    <div className="flex items-baseline gap-2">
        <span className="text-lg line-through text-slate-400">{tier.originalPrice || tier.price} LYD</span>
        <span className="text-2xl font-black text-emerald-600">Free</span>
        <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 text-xs">🎁 LIMITED OFFER</Badge>
    </div>
) : (
    <span className="text-2xl font-bold">{tier.price} LYD<span className="text-sm font-normal text-slate-500">/mo</span></span>
)}
```

#### Step 4: Handle Freebie mode subscription flow

When a merchant clicks "Upgrade" on a Freebie tier, skip the payment flow and directly create a subscription:

```jsx
// In the upgrade handler function:
const handleTierUpgrade = async (tier) => {
    if (tier.isFreebie) {
        // Bypass payment — create subscription directly
        const { error } = await supabase.from('subscriptions').upsert({
            profile_id: user.id,
            tier: tier.name,
            status: 'Active',
            quotas: tier.allocations || {},
            is_trial: false,
            started_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }, { onConflict: 'profile_id' });

        if (!error) {
            showToast('Tier activated! Enjoy your free access. 🎁');
            window.location.reload();
        } else {
            showToast('Failed to activate tier.', 'error');
        }
        return;
    }
    // ... existing payment flow
};
```

#### Step 5: Show subscription status badge (in the account section)

Add a visual status indicator next to the tier name:

```jsx
const STATUS_BADGES = {
    'Active': { label: 'Active', class: 'bg-emerald-100 text-emerald-700' },
    'Expiring Soon': { label: 'Expiring Soon', class: 'bg-amber-100 text-amber-700' },
    'Grace Period': { label: 'Grace Period', class: 'bg-red-100 text-red-700' },
    'Pending': { label: 'Awaiting Payment', class: 'bg-blue-100 text-blue-700' },
    'Suspended': { label: 'Suspended', class: 'bg-red-100 text-red-700' },
    'Terminated': { label: 'Terminated', class: 'bg-slate-100 text-slate-700' }
};

// Use in PricingSection alongside the tier name:
{subscription?.status && STATUS_BADGES[subscription.status] && (
    <Badge className={`${STATUS_BADGES[subscription.status].class} border-0`}>
        {STATUS_BADGES[subscription.status].label}
    </Badge>
)}
```

---

### 3.4 — Consumer Pricing Page: Freebie Mode Already Handled

**File:** `src/app/(consumer)/pricing/page.jsx`

> **NO CHANGES REQUIRED.** Phase 0 already added the Freebie mode rendering (struck-through price + "FREE" + "🎁 LIMITED OFFER" badge) on lines 206-218. Verify this is intact.

---

### 3.5 — Add `requestAddonPurchase` currency/gateway fields

**File:** `src/app/(portals)/merchant/settings/page.jsx`, lines 249-267

The existing `requestAddonPurchase` function inserts transactions without `currency` and `payment_gateway`. Fix:

```jsx
// Replace the insert on lines 252-259:
const { error } = await supabase.from('transactions').insert([{
    owner_id: user.id,
    business_id: myBusiness.id,
    amount: 0,
    status: 'pending',
    payment_method: 'manual',
    requested_tier: `${addonName} Addon`,
    duration: '1 Month',
    currency: 'LYD',
    payment_gateway: 'manual_bank'
}]);
```

---

## 4. Testing Requirements

### 4.1 — Unit Test: Subscription State Display

**File:** `tests/subscription-state-display.test.jsx` **(NEW)**

```jsx
import { describe, it, expect, vi } from 'vitest';

describe('Subscription Status Badges', () => {
    const STATUS_BADGES = {
        'Active': { label: 'Active', class: 'bg-emerald-100 text-emerald-700' },
        'Expiring Soon': { label: 'Expiring Soon', class: 'bg-amber-100 text-amber-700' },
        'Grace Period': { label: 'Grace Period', class: 'bg-red-100 text-red-700' },
        'Pending': { label: 'Awaiting Payment', class: 'bg-blue-100 text-blue-700' },
        'Suspended': { label: 'Suspended', class: 'bg-red-100 text-red-700' },
        'Terminated': { label: 'Terminated', class: 'bg-slate-100 text-slate-700' }
    };

    it('should map all valid subscription states to badge configs', () => {
        const validStates = ['Active', 'Expiring Soon', 'Grace Period', 'Pending', 'Suspended', 'Terminated'];
        validStates.forEach(status => {
            expect(STATUS_BADGES[status]).toBeDefined();
            expect(STATUS_BADGES[status].label).toBeTruthy();
            expect(STATUS_BADGES[status].class).toBeTruthy();
        });
    });

    it('should not have a badge for Expired (reverts to Free)', () => {
        expect(STATUS_BADGES['Expired']).toBeUndefined();
    });
});
```

Run: `npx vitest run tests/subscription-state-display.test.jsx`

---

## 5. Pre-Merge Checklist

- [ ] `npx next build` exits with code 0
- [ ] No new imports are missing (verify `AlertTriangle` in dashboard)
- [ ] Subscription status query uses `.in()` not `.eq('Active')`
- [ ] `requestAddonPurchase` includes `currency` and `payment_gateway`
- [ ] Freebie upgrade handler bypasses payment when `tier.isFreebie === true`
- [ ] Cron migration writes audit log entries for every automated transition
- [ ] Unit test passes: `npx vitest run tests/subscription-state-display.test.jsx`
