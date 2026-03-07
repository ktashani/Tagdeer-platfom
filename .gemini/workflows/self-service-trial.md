---
description: Create a self-service trial link for merchants to auto-claim free Pro trial on registration
---

# Task: Self-Service Trial Link

## Context

Currently, free trials can only be granted by admins via Admin → Financials → "Grant Trial" button, which calls the `admin_grant_free_trial` RPC. The user wants a self-service mechanism where businesses get a link (e.g. shared by sales team) that auto-grants them a free Pro trial upon registration.

### How trials work today:
- `admin_grant_free_trial(p_business_id, p_tier, p_months)` RPC in `supabase/migrations/2026030507_phase5_admin_trials.sql`
- It upserts into `subscriptions` table with `is_trial = true`
- Admin Financials page (`src/app/(portals)/admin/financials/page.jsx` line 84-103) has the Grant Trial UI
- Merchant settings page reads the subscription tier and gates features accordingly

### Onboarding flow:
- Merchant registers at `/merchant/login` → completes onboarding → business claim is set to `pending` → admin approves → merchant gets dashboard
- File: `src/app/(portals)/merchant/onboarding/page.jsx` (if exists, or the login flow)

## Critical Rules — DO NOT BREAK

1. **Do NOT modify** the `admin_grant_free_trial` RPC — it's for admin use
2. **Do NOT modify** the existing merchant onboarding or login flow
3. **Do NOT modify** the admin financials page
4. A business should only be able to claim ONE trial ever — prevent abuse
5. The trial should only activate AFTER admin approves the business claim

## Step 1: Create Self-Service Trial RPC

Create file: `supabase/migrations/20260306150000_self_service_trial.sql`

```sql
-- RPC: Allow a merchant to claim a free trial for their business
-- This is called after admin approval, not during registration
CREATE OR REPLACE FUNCTION claim_free_trial(p_business_id UUID, p_months INTEGER DEFAULT 3)
RETURNS JSONB AS $$
DECLARE
    v_merchant_id UUID;
    v_existing_sub RECORD;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Verify the caller owns this business
    SELECT claimed_by INTO v_merchant_id FROM public.businesses WHERE id = p_business_id;
    
    IF v_merchant_id IS NULL OR v_merchant_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not own this business');
    END IF;

    -- Check if business already had a subscription (trial or paid)
    SELECT * INTO v_existing_sub FROM public.subscriptions WHERE business_id = p_business_id;
    
    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'This business has already used a trial or had a subscription');
    END IF;

    -- Cap trial months at 12
    IF p_months > 12 THEN p_months := 12; END IF;
    IF p_months < 1 THEN p_months := 1; END IF;

    -- Calculate expiry
    v_expires_at := NOW() + (p_months || ' months')::interval;

    -- Create the trial subscription
    INSERT INTO public.subscriptions (business_id, tier, status, expires_at, is_trial, trial_months)
    VALUES (p_business_id, 'Pro', 'Active', v_expires_at, true, p_months);

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Pro trial activated for ' || p_months || ' months',
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Step 2: Add Trial Activation UI to Merchant Dashboard

The trial should be offered to merchants who have an approved business but NO active subscription.

File: `src/app/(portals)/merchant/settings/page.jsx`

In the subscription display area (around line 305-320 where the tier card is rendered), add a trial activation banner for merchants with no subscription:

```jsx
{/* Show trial offer if no active subscription */}
{accountTier === 'Free' && !hasActiveSub && (
    <div className="mt-4 p-4 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-xl">
        <h4 className="font-bold text-white mb-1">🎉 Activate Your Free Pro Trial</h4>
        <p className="text-sm text-slate-400 mb-3">
            Get 3 months of Pro features free — campaigns, team management, and more.
        </p>
        <Button 
            onClick={handleClaimTrial}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
            Activate 3-Month Pro Trial
        </Button>
    </div>
)}
```

Add the handler:

```javascript
const handleClaimTrial = async () => {
    if (!supabase || !myBusiness) return;
    const { data, error } = await supabase.rpc('claim_free_trial', {
        p_business_id: myBusiness.id,
        p_months: trialMonths // from URL param or default 3
    });
    if (error || !data?.success) {
        showToast(error?.message || data?.error || 'Failed to activate trial', 'error');
    } else {
        showToast('Pro trial activated! 🎉');
        setAccountTier('Pro');
        // Refresh subscription data
    }
};
```

## Step 3: Support URL Parameter for Custom Trial Duration

Read a `trial` query parameter from the URL so sales team can share links like:
`/merchant/settings?tab=subscription&trial=3`

```javascript
import { useSearchParams } from 'next/navigation';
const searchParams = useSearchParams();
const trialMonths = parseInt(searchParams.get('trial')) || 3;
```

This allows different trial durations: `?trial=3` for 3 months, `?trial=12` for 1 year.

## Step 4: Verify

1. Run `npm run dev`
2. Login as a merchant with an approved business and NO active subscription
3. Navigate to merchant settings → subscription tab
4. Verify the "Activate Free Pro Trial" banner appears
5. Click to activate → verify subscription is created with `is_trial = true`
6. Navigate to merchant coupons page → verify you can now create 1 campaign
7. Try activating trial again → verify "already used" error
8. Try with URL: `/merchant/settings?tab=subscription&trial=6` → verify 6-month trial
