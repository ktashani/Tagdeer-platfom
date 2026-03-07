---
description: Implement automatic subscription expiry using pg_cron and client-side checks
---

# Task: Auto Subscription Expiry

## Context

The `subscriptions` table has `expires_at TIMESTAMPTZ` and `status TEXT CHECK (status IN ('Active', 'Expiring Soon', 'Expired'))`, but nothing automatically marks expired subscriptions. When a trial or paid subscription expires, the merchant should lose Pro/Enterprise features and revert to Free behavior.

### How tiers are enforced today:
- `enforce_subscription_campaign_limits` RPC in `supabase/migrations/2026030506_phase2_rpcs_combined.sql` (line 192-231) checks `subscriptions.status = 'active'`
- `award_scan_points` RPC (line 234-298) checks `subscriptions.tier` via `WHERE status = 'active'`
- Merchant settings page (`src/app/(portals)/merchant/settings/page.jsx` line 40) fetches from `subscriptions` table
- Free tier defaults apply when no active subscription exists (`COALESCE(v_sub_tier, 'Free')`)

### What exists:
- `subscriptions` table with `expires_at`, `status`, `is_trial`, `trial_months` columns
- `admin_grant_free_trial` RPC in `supabase/migrations/2026030507_phase5_admin_trials.sql`
- Admin Financials page (`src/app/(portals)/admin/financials/page.jsx`) with Grant Trial UI

## Critical Rules — DO NOT BREAK

1. **Do NOT modify** the `enforce_subscription_campaign_limits` or `award_scan_points` RPCs
2. **Do NOT modify** the admin financials page or the grant trial RPC
3. **Do NOT change** the `subscriptions` table schema — all needed columns already exist
4. The expiry system must **only update status**, not delete rows

## Step 1: Create DB-Level Expiry Check (Migration)

Create file: `supabase/migrations/20260306140000_subscription_expiry_cron.sql`

```sql
-- Function to mark expired subscriptions
CREATE OR REPLACE FUNCTION check_and_expire_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Mark active subscriptions as expired if past their expiry date
    UPDATE public.subscriptions
    SET status = 'Expired'
    WHERE status = 'Active'
      AND expires_at < NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Also mark subscriptions expiring within 7 days as "Expiring Soon"
    UPDATE public.subscriptions
    SET status = 'Expiring Soon'
    WHERE status = 'Active'
      AND expires_at < NOW() + INTERVAL '7 days'
      AND expires_at >= NOW();
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Try to enable pg_cron and schedule the job
-- NOTE: pg_cron may not be available on all Supabase plans
-- If this fails, the client-side check (Step 2) serves as fallback
DO $$
BEGIN
    -- Check if pg_cron extension is available
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
        
        -- Remove existing job if any
        PERFORM cron.unschedule('expire-subscriptions');
        
        -- Run daily at 3:00 AM UTC
        PERFORM cron.schedule(
            'expire-subscriptions',
            '0 3 * * *',
            'SELECT check_and_expire_subscriptions()'
        );
    END IF;
EXCEPTION
    WHEN others THEN
        -- pg_cron not available, silently continue
        -- Client-side fallback handles this
        RAISE NOTICE 'pg_cron not available, using client-side expiry check only';
END;
$$;
```

## Step 2: Add Client-Side Expiry Check (Fallback)

This ensures expiry is checked whenever the merchant dashboard loads, even if pg_cron is unavailable.

File: `src/app/(portals)/merchant/settings/page.jsx`

Find the existing subscription fetch effect (around line 38-42 where it queries `subscriptions` table). After the subscription data is fetched, add a client-side expiry check:

```javascript
// After fetching subscription data, check if expired
if (subData && subData.expires_at) {
    const expiresAt = new Date(subData.expires_at);
    if (expiresAt < new Date() && subData.status === 'Active') {
        // Mark as expired in DB
        await supabase
            .from('subscriptions')
            .update({ status: 'Expired' })
            .eq('id', subData.id);
        // Use 'Free' tier locally
        setAccountTier('Free');
    } else {
        setAccountTier(subData.tier || 'Free');
    }
}
```

**IMPORTANT**: Find the exact location where `accountTier` is set from the subscription query and integrate this check there. Do NOT add a duplicate query. Modify the existing flow.

## Step 3: Show Expiry Warning in Merchant Dashboard

File: `src/app/(portals)/merchant/settings/page.jsx`

In the subscription display area (around line 262-264 where tier badges are shown), add an expiry warning:

```jsx
{subData?.status === 'Expiring Soon' && (
    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 border-none">
        Expiring Soon
    </Badge>
)}
```

## Step 4: Verify

1. Run `npm run dev`
2. In the Supabase SQL editor, manually set a subscription's `expires_at` to the past:
   ```sql
   UPDATE subscriptions SET expires_at = NOW() - INTERVAL '1 day' WHERE id = '<some-id>';
   ```
3. Navigate to the merchant settings — verify it shows Free tier behavior
4. Check admin financials → Active Subscriptions tab — verify the expired sub shows as "Expired"
5. Verify creating a new campaign as a Free merchant is blocked (existing `enforce_subscription_campaign_limits` behavior)
