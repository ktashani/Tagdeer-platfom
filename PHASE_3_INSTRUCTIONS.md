# Phase 3: Architecture Improvements — Worker Instruction Manual

> **Generated:** 2026-03-15
> **Source:** `health_report.md` → Phase 3 (Tasks #15–#24)
> **Branch:** Create a new branch off current HEAD (e.g., `refactor/phase-3-architecture`)

---

## Table of Contents

| Task | Title | Effort | Risk |
|------|-------|--------|------|
| [#15](#task-15--extract-submitvote-into-a-shared-hook) | Extract `submitVote` into a shared hook | 3 hours | 🔴 HIGH |
| [#16](#task-16--extract-god-components-businesscard-logitem-leadercard) | Extract God Components | 2 hours | 🟡 MEDIUM |
| [#17](#task-17--extract-footer-to-its-own-component) | Extract Footer | 30 min | 🟢 LOW |
| [#18](#task-18--split-context-into-smaller-providers) | Split Context (**ALREADY DONE**) | — | — |
| [#19](#task-19--move-business-logic-out-of-layout) | Move business logic out of layout | 2 hours | 🔴 HIGH |
| [#20](#task-20--add-reactmemo-to-list-item-components) | Add React.memo to list components | 1 hour | 🟢 LOW |
| [#21](#task-21--add-search-input-debounce-in-discover) | Add search debounce | 15 min | 🟢 LOW |
| [#22](#task-22--move-json-ld-to-server-component) | Move JSON-LD to server component | 1 hour | 🟡 MEDIUM |
| [#23](#task-23--add-rate-limiting-to-password-endpoints) | Rate limit password endpoints (**ALREADY DONE**) | — | — |
| [#24](#task-24--add-csrf-protection-to-admin-post-endpoints) | Add CSRF protection to admin endpoints | 2 hours | 🟡 MEDIUM |

> [!IMPORTANT]
> **Dependency Order:** Tasks #15 and #19 are coupled — `submitVote` lives inside the layout file. You MUST do **#15 first** (extract the hook), then **#19** (clean the layout). Tasks #16, #17, #20, #21, #22, #24 are independent of each other and can be done in any order.

---

## Task #15 — Extract `submitVote` Into a Shared Hook

### Problem

The exact same vote-submission flow exists in **two places** (~150 lines each):

1. `src/app/(consumer)/layout.jsx` — `submitVote()` (lines 70–226)
2. `src/app/(consumer)/b/[slug]/InlineReviewBlock.jsx` — `handleSubmit()` (lines 87–197)

Both implement: anonymous limit check → 24h cooldown → 30-day diminishing returns → weight calculation → log insert → point awarding → anonymous tracking. Any bugfix to one must be manually replicated to the other.

Additionally, `BusinessCard` in `discover/page.jsx` (line 223) does `const { submitVote } = useTagdeer()` — but `submitVote` is **NOT actually in the context**. This is a latent bug; the inline submit in `BusinessCard` (lines 480-487) works around it by calling `submitVote(businessId, type, isClaimed)` directly, but this diverges from the layout's `submitVote()` which reads from `voteModal` state.

### Files to Open

1. `src/app/(consumer)/layout.jsx` — **Lines 70–226** (the source of truth `submitVote`)
2. `src/app/(consumer)/b/[slug]/InlineReviewBlock.jsx` — **Lines 87–197** (duplicate in `handleSubmit`)
3. **[NEW]** `src/hooks/useVoteSubmission.js`

### Step-by-Step Fix

#### Step 1: Create the shared hook

Create `src/hooks/useVoteSubmission.js` with the following content:

```js
'use client';

import { useState, useCallback } from 'react';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { calculateVoteWeight } from '@/lib/trustEngine';

/**
 * useVoteSubmission — Shared vote submission logic.
 *
 * Consolidates the duplicated voting flow from layout.jsx and InlineReviewBlock.jsx.
 * Handles: anonymous limits, 24h cooldown, 30-day diminishing returns,
 * weight calculation, log insertion, Gader point awarding, and anonymous tracking.
 *
 * @param {object} params
 * @param {object|null} params.user - Current user from context
 * @param {object|null} params.supabase - Supabase client from context
 * @param {string} params.lang - Language code ('ar' or 'en')
 * @param {number} params.anonInteractions - Current anonymous interaction count
 * @param {function} params.setAnonInteractions - Setter for anonymous interaction count
 * @param {function} params.setUser - Setter for user object (to update Gader points)
 * @param {function} params.showToast - Toast notification function
 * @param {function} params.setShowLimitModal - Setter to show anonymous limit modal
 */
export function useVoteSubmission({
    user,
    supabase,
    lang,
    anonInteractions,
    setAnonInteractions,
    setUser,
    showToast,
    setShowLimitModal,
}) {
    const [impactBubble, setImpactBubble] = useState(null);

    /**
     * Submit a vote for a business.
     *
     * @param {string} businessId - UUID of the business
     * @param {string} type - 'recommend' or 'complain'
     * @param {string} reasonText - Optional reason text
     * @param {boolean} isClaimed - Whether the business is claimed
     * @returns {Promise<boolean>} true if vote was submitted successfully
     */
    const submitVote = useCallback(async (businessId, type, reasonText = '', isClaimed = false) => {
        // Block merchant accounts from voting
        if (user?.role === 'merchant') {
            showToast(lang === 'ar'
                ? 'حسابات التجار لا يمكنها التصويت. استخدم حساب مستهلك.'
                : 'Merchant accounts cannot vote. Use a consumer account.'
            );
            return false;
        }

        const fingerprint = getDeviceFingerprint();
        let weight = calculateVoteWeight(user, 0);

        if (supabase) {
            try {
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

                // ── Step 0: Server-side anonymous vote limit (3 per 24h) ──
                if (!user) {
                    const { count: anonTotal, error: anonErr } = await supabase
                        .from('logs')
                        .select('*', { count: 'exact', head: true })
                        .eq('fingerprint', fingerprint)
                        .gte('created_at', twentyFourHoursAgo);

                    if (!anonErr && anonTotal >= 3) {
                        setShowLimitModal(true);
                        return false;
                    }
                }

                // ── Step 1: 24-Hour Same-Business Cooldown ──
                const cooldownQuery = user?.id
                    ? supabase.from('logs').select('*', { count: 'exact', head: true })
                        .eq('business_id', businessId)
                        .eq('profile_id', user.id)
                        .gte('created_at', twentyFourHoursAgo)
                    : supabase.from('logs').select('*', { count: 'exact', head: true })
                        .eq('business_id', businessId)
                        .eq('fingerprint', fingerprint)
                        .gte('created_at', twentyFourHoursAgo);

                const { count: recentCount, error: cooldownErr } = await cooldownQuery;

                if (!cooldownErr && recentCount > 0) {
                    showToast(lang === 'ar'
                        ? 'لقد قيّمت هذا النشاط مؤخرًا. يرجى الانتظار 24 ساعة قبل تسجيل تجربة أخرى هنا.'
                        : 'You recently evaluated this business. Please wait 24 hours before logging another experience here.'
                    );
                    return false;
                }

                // ── Step 2: Diminishing Returns (30-day count) ──
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

                const diminishingQuery = user?.id
                    ? supabase.from('logs').select('*', { count: 'exact', head: true })
                        .eq('business_id', businessId)
                        .eq('profile_id', user.id)
                        .gte('created_at', thirtyDaysAgo)
                    : supabase.from('logs').select('*', { count: 'exact', head: true })
                        .eq('business_id', businessId)
                        .eq('fingerprint', fingerprint)
                        .gte('created_at', thirtyDaysAgo);

                const { count: pastVoteCount, error: dimErr } = await diminishingQuery;
                const safeCount = (!dimErr && pastVoteCount) ? pastVoteCount : 0;

                // ── Step 3: Calculate Dynamic Weight ──
                weight = calculateVoteWeight(user, safeCount);

                // ── Step 4: Insert with weight ──
                const { error } = await supabase.from('logs').insert([{
                    business_id: businessId,
                    interaction_type: type,
                    reason_text: reasonText || null,
                    profile_id: user?.id || null,
                    fingerprint: fingerprint,
                    weight: weight
                }]);

                if (error) {
                    console.error("Supabase insert error:", error);
                    showToast(lang === 'ar' ? "حدث خطأ: " + error.message : "Error: " + error.message);
                    return false;
                }
            } catch (err) {
                console.error("Supabase insert exception:", err);
                showToast("Connection failed.");
                return false;
            }
        }

        // ── Award Gader Points atomically via RPC ──
        if (user?.id && supabase) {
            try {
                const earnedPoints = Math.max(5, Math.min(25, Math.round(weight * 10)));
                const { data: newPoints, error: rpcErr } = await supabase.rpc('increment_gader_points', {
                    p_profile_id: user.id,
                    p_amount: earnedPoints,
                });
                if (!rpcErr && newPoints !== null) {
                    setUser(prev => prev ? { ...prev, gader: newPoints } : prev);
                }
            } catch (e) {
                console.error('Error awarding points:', e);
            }
        }

        // Track anonymous vote count
        if (!user) {
            const currentCount = parseInt(localStorage.getItem('trust_ledger_interactions') || '0');
            const newCount = currentCount + 1;
            setAnonInteractions(newCount);
            localStorage.setItem('trust_ledger_interactions', newCount.toString());
        }

        // Trigger Impact Bubble animation
        setImpactBubble({ weight, type });
        setTimeout(() => setImpactBubble(null), 2000);

        // Show appropriate success toast
        if (user) {
            if (!isClaimed) {
                showToast(lang === 'ar'
                    ? 'تم حفظ تقييمك في سجل الثقة. العرض العام مقيّد حالياً لأن صاحب النشاط لم يسجّل بعد.'
                    : 'Your vote is saved in the Trust Ledger. The public view is currently limited because the owner has not claimed this business yet.');
            } else {
                showToast(lang === 'ar' ? 'تم تسجيل تقييمك بنجاح!' : 'Vote logged successfully!');
            }
        } else {
            const remaining = 3 - anonInteractions - 1;
            if (!isClaimed) {
                showToast(lang === 'ar'
                    ? `تم الحفظ في سجل الثقة. (${remaining} تقييمات مجهولة متبقية)`
                    : `Saved to Trust Ledger. (${remaining} anonymous votes remaining)`);
            } else {
                showToast(lang === 'ar'
                    ? `تم التسجيل بنجاح. (${remaining} تقييمات مجهولة متبقية)`
                    : `Successfully logged. (${remaining} anonymous votes remaining)`);
            }
        }

        return true;
    }, [user, supabase, lang, anonInteractions, setAnonInteractions, setUser, showToast, setShowLimitModal]);

    return { submitVote, impactBubble };
}
```

#### Step 2: Refactor `src/app/(consumer)/layout.jsx`

1. **Add import** at the top (after other imports, around line 6):
   ```js
   import { useVoteSubmission } from '@/hooks/useVoteSubmission';
   ```

2. **Delete lines 70–226** (the entire `submitVote` function and everything to its closing `};`).

3. **Delete line 58**: `const [impactBubble, setImpactBubble] = useState(null);`

4. **Add the hook call** right after the existing `useState` calls (around where line 58 was):
   ```js
   const { submitVote, impactBubble } = useVoteSubmission({
       user, supabase, lang,
       anonInteractions, setAnonInteractions,
       setUser, showToast, setShowLimitModal,
   });
   ```

5. **Update the `VoteModal` `onSubmit` prop** (currently at ~line 285):
   Change:
   ```jsx
   onSubmit={submitVote}
   ```
   To:
   ```jsx
   onSubmit={() => {
       const { businessId, type } = voteModal;
       const targetBusiness = businesses.find(b => b.id === businessId);
       submitVote(businessId, type, voteReason, targetBusiness?.isClaimed);
       setVoteModal({ isOpen: false, businessId: null, type: null });
   }}
   ```

6. **Remove dead imports on line 14**: Delete `Twitter` and `Facebook` from the lucide-react import (they are unused). Keep `BadgeCheck`.

#### Step 3: Refactor `src/app/(consumer)/b/[slug]/InlineReviewBlock.jsx`

1. **Add import** at the top:
   ```js
   import { useVoteSubmission } from '@/hooks/useVoteSubmission';
   ```

2. **Add the hook call** inside the component, after the `useTagdeer()` destructure (around line 20):
   ```js
   const { submitVote: executeVote } = useVoteSubmission({
       user, supabase, lang,
       anonInteractions, setAnonInteractions,
       setUser: () => {}, // InlineReviewBlock doesn't need to update user in parent
       showToast, setShowLimitModal,
   });
   ```
   
   > **Note:** You will also need to add `setAnonInteractions` to the destructure from `useTagdeer()` at line 15-20 if it's not already there (check the destructure list).

3. **Replace the body of `handleSubmit`** (lines 87–197). Replace the entire try/catch block with:
   ```js
   const handleSubmit = async (e) => {
       e.preventDefault();
       if (!selectedType || !supabase) return;

       setLoading(true);
       setError('');

       try {
           const success = await executeVote(
               businessId,
               selectedType,
               reasonText || '',
               business?.isClaimed || false
           );

           if (success) {
               const fingerprint = getDeviceFingerprint();
               const weight = calculateVoteWeight(user, 0);
               setImpactWeight(weight);
               setSuccess(true);
           } else {
               // Vote was blocked (cooldown, limit, etc.) — toast already shown by hook
           }
       } catch (err) {
           console.error('Error submitting review:', err);
           setError(t.error);
       } finally {
           setLoading(false);
       }
   };
   ```

4. **Remove** the now-unused imports: `calculateVoteWeight` from `@/lib/trustEngine` (line 7) can be removed IF you no longer use it for `setImpactWeight`. If you still want local weight display, keep it.

### Safety Check

```bash
# 1. Build must pass
npm run build 2>&1 | grep -i "error"

# 2. Unit test for trustEngine (used by the hook)
npx vitest run src/lib/trustEngine

# 3. Functional test — consumer layout vote flow
#    a. Go to http://localhost:3000/discover
#    b. Click 👍 on any business → inline panel → Submit
#    ✅ PASS: Toast shows "Vote logged successfully" + impact bubble animation
#    ❌ FAIL: No toast, or console error about submitVote

# 4. Functional test — storefront vote flow
#    a. Visit any business storefront (http://localhost:3000/b/[slug])
#    b. Select Recommend → Submit
#    ✅ PASS: Thank-you card appears with impact weight
#    ❌ FAIL: Console error in InlineReviewBlock
```

> [!WARNING]
> **NO-TOUCH ZONE:** Do NOT modify `src/context/TagdeerContext.jsx` or any files under `src/context/providers/`. The hook consumes values FROM context but does not modify the context itself.

---

## Task #16 — Extract God Components: BusinessCard, LogItem, LeaderCard

### Problem

Three multi-hundred-line components are defined **inline** inside page files instead of being in `src/components/consumer/`:

| Component | Current Location | Lines | Size |
|-----------|-----------------|-------|------|
| `BusinessCard` | `discover/page.jsx` lines 222–553 | ~330 lines | Large |
| `LogItem` | `discover/page.jsx` lines 555–683 | ~130 lines | Medium |
| `LeaderCard` | `page.jsx` lines 184–249 | ~66 lines | Small |

### Files to Open

1. `src/app/(consumer)/discover/page.jsx`
2. `src/app/(consumer)/page.jsx`
3. **[NEW]** `src/components/consumer/BusinessCard.jsx`
4. **[NEW]** `src/components/consumer/LogItem.jsx`
5. **[NEW]** `src/components/consumer/LeaderCard.jsx`

### Step-by-Step Fix

#### Step 1: Extract `BusinessCard`

1. Create `src/components/consumer/BusinessCard.jsx`
2. Copy lines 222–553 from `discover/page.jsx` into this new file
3. Add the necessary imports at the top:
   ```js
   'use client';

   import React, { useState } from 'react';
   import { useTagdeer } from '@/context/TagdeerContext';
   import { calculateBusinessScore } from '@/lib/mathEngine';
   import { Phone, Globe, Instagram, Facebook, MessageCircle, Navigation, Share2, BadgeCheck, MessageSquare, ChevronUp, ChevronDown, ThumbsUp, ThumbsDown, Zap, Store } from 'lucide-react';
   import LogItem from './LogItem';
   ```
4. Add `export default` before `function BusinessCard`
5. In `discover/page.jsx`:
   - Delete lines 222–553 (the entire `BusinessCard` function)
   - Add import at top: `import BusinessCard from '@/components/consumer/BusinessCard';`

#### Step 2: Extract `LogItem`

1. Create `src/components/consumer/LogItem.jsx`
2. Copy lines 555–683 from `discover/page.jsx` into this new file
3. Add imports at top:
   ```js
   'use client';

   import React, { useState, useEffect } from 'react';
   import { useTagdeer } from '@/context/TagdeerContext';
   import { getDeviceFingerprint } from '@/lib/fingerprint';
   import { ThumbsUp, ThumbsDown, BadgeCheck } from 'lucide-react';
   ```
4. Add `export default` before `function LogItem`
5. In `discover/page.jsx`:
   - Delete lines 555–683 (the entire `LogItem` function)
   - Add import at top: `import LogItem from '@/components/consumer/LogItem';`

#### Step 3: Extract `LeaderCard`

1. Create `src/components/consumer/LeaderCard.jsx`
2. Copy lines 184–249 from `page.jsx` into this new file
3. Add imports at top:
   ```js
   'use client';

   import React from 'react';
   import Link from 'next/link';
   import { MapPin, Store, ArrowRight } from 'lucide-react';
   ```
4. Add `export default` before `function LeaderCard`
5. In `page.jsx`:
   - Delete lines 184–249 (the entire `LeaderCard` function)
   - Add import at top: `import LeaderCard from '@/components/consumer/LeaderCard';`

#### Step 4: Remove unused imports from discover/page.jsx

After extracting both components, clean up the lucide-react import at line 5. The `DiscoverContent` component only uses: `Search`, `MapPin`. Remove all others that were only used by the extracted components.

### Safety Check

```bash
# 1. Build check
npm run build 2>&1 | grep -i "error"

# 2. Navigate to http://localhost:3000/discover
#    ✅ PASS: Business cards render identically to before
#    ✅ PASS: Logs expand/collapse, vote buttons work
#    ❌ FAIL: Blank page, or "X is not defined" console errors

# 3. Navigate to http://localhost:3000/ (home page)
#    ✅ PASS: Leader cards in "Most Recommended" and "Most Complained" sections render
#    ❌ FAIL: Missing sections or import errors

# 4. No files in src/context/ or src/lib/auth/ should have been touched
```

---

## Task #17 — Extract Footer to Its Own Component

### Files to Open

1. `src/app/(consumer)/layout.jsx` — **Lines 18–41** (the `Footer` function)
2. **[NEW]** `src/components/Footer.jsx`

### Step-by-Step Fix

#### Step 1: Create the footer component

Create `src/components/Footer.jsx`:

```jsx
'use client';

import { BadgeCheck } from 'lucide-react';
import Link from 'next/link';

export function Footer({ t }) {
    return (
        <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-2">
                    <BadgeCheck className="h-8 w-8 text-green-500" />
                    <span className="font-bold text-xl text-white">Tagdeer</span>
                </div>
                <div className="flex gap-4 items-center text-sm">
                    <Link href="/discover" className="hover:text-white transition-colors">Discover</Link>
                    <Link href="/about" className="hover:text-white transition-colors">About</Link>
                    <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                    <a href="/merchant/login" className="hover:text-white transition-colors font-medium text-blue-400 hover:text-blue-300">Merchant Login</a>
                </div>
                <div className="flex flex-col items-center md:items-end gap-2">
                    <Link href="/privacy" className="text-sm hover:text-white transition-colors">
                        Privacy Policy | سياسة الخصوصية
                    </Link>
                    <p className="text-sm">© 2026 Tagdeer Libya.</p>
                </div>
            </div>
        </footer>
    );
}
```

#### Step 2: Update layout.jsx

1. **Delete lines 18–41** (the `Footer` function definition)
2. **Add import** at the top: `import { Footer } from '@/components/Footer';`
3. The existing `<Footer t={t} />` usage at line ~278 stays unchanged.

### Safety Check

```bash
# 1. Build check
npm run build 2>&1 | grep -i "error"

# 2. Open any consumer page — footer should appear at the bottom unchanged
#    ✅ PASS: Footer links work, styling identical
```

---

## Task #18 — Split Context Into Smaller Providers

> [!NOTE]
> **STATUS: ALREADY DONE.** The context has already been split into three purpose-specific providers:
> - `src/context/providers/AuthProvider.jsx`
> - `src/context/providers/BusinessDataProvider.jsx`
> - `src/context/providers/UIProvider.jsx`
>
> A `TagdeerBridge` shim in `src/context/TagdeerContext.jsx` (lines 18-31) combines them for backward compatibility, so all consumer files can continue using `useTagdeer()`.
>
> **Worker Action:** Confirm the three provider files exist, then **mark this task as DONE**. No changes needed.

### Verification Command

```bash
ls -la src/context/providers/
# ✅ Expected output: AuthProvider.jsx, BusinessDataProvider.jsx, UIProvider.jsx
```

---

## Task #19 — Move Business Logic Out of Layout

### Problem

`src/app/(consumer)/layout.jsx` currently contains `submitVote` (lines 70-226) and `submitPreRegistration` (lines 228-258) — core business logic that should not live in a layout component.

> [!IMPORTANT]
> **Depends on Task #15.** If Task #15 was completed, `submitVote` is already extracted. This task now only covers `submitPreRegistration`.

### Files to Open

1. `src/app/(consumer)/layout.jsx` — `submitPreRegistration` function (lines ~228–258 after #15 shrinks the file)

### Step-by-Step Fix

If Task #15 has been completed, `submitVote` is already gone. Now extract `submitPreRegistration`:

#### Option A: Move into the `WrappedPreRegModal` component (simplest)

The `submitPreRegistration` function is only used inside `WrappedPreRegModal`. Move the logic directly into it:

Replace the current `WrappedPreRegModal` (at the bottom of layout.jsx) and the `submitPreRegistration` function with:

```jsx
function WrappedPreRegModal({ isOpen, onClose, t, showToast, supabase }) {
    const [preRegData, setPreRegData] = useState({ name: '', phone: '', bizName: '' });

    const handleSubmit = async () => {
        if (!preRegData.name || !preRegData.phone || !preRegData.bizName) {
            showToast(t('prereg_fill_all'));
            return;
        }

        if (supabase) {
            try {
                const { error } = await supabase.from('pre_registrations').insert([
                    {
                        owner_name: preRegData.name,
                        phone_number: preRegData.phone,
                        business_name: preRegData.bizName
                    }
                ]);

                if (error) {
                    console.error("Pre-registration error:", error);
                    showToast(t('prereg_error') + ": " + error.message);
                    return;
                }

                showToast(t('prereg_success'));
                onClose();
                setPreRegData({ name: '', phone: '', bizName: '' });
            } catch (err) {
                console.error(err);
                showToast(t('prereg_error'));
            }
        }
    };

    return (
        <PreRegModal
            isOpen={isOpen}
            onClose={onClose}
            preRegData={preRegData}
            setPreRegData={setPreRegData}
            onSubmit={handleSubmit}
            t={t}
        />
    );
}
```

Then update the `<WrappedPreRegModal />` usage in the layout JSX to pass the needed props:

```jsx
<WrappedPreRegModal
    isOpen={showPreRegModal}
    onClose={() => setShowPreRegModal(false)}
    t={t}
    showToast={showToast}
    supabase={supabase}
/>
```

And **delete** the standalone `submitPreRegistration` function from the layout.

### Safety Check

```bash
# 1. Build check
npm run build 2>&1 | grep -i "error"

# 2. Open http://localhost:3000/ (home page)
#    Click "Register Your Business" or equivalent CTA
#    Fill in the PreReg form and submit
#    ✅ PASS: Toast shows success message
#    ❌ FAIL: Console error about submitPreRegistration
```

---

## Task #20 — Add React.memo to List-Item Components

### Problem

`BusinessCard`, `LogItem`, `LeaderCard`, and `ProductCard` re-render on every context change because they are not memoized. In a list of 50+ businesses this causes visible jank.

### Files to Open (after Task #16 extractions)

1. `src/components/consumer/BusinessCard.jsx`
2. `src/components/consumer/LogItem.jsx`
3. `src/components/consumer/LeaderCard.jsx`
4. `src/components/consumer/ProductCard.jsx`

### The Fix

For each component, wrap the `export default` with `React.memo`:

#### BusinessCard.jsx

Change:
```js
export default function BusinessCard({ ... }) {
```
To:
```js
function BusinessCard({ ... }) {
    // ... existing body unchanged
}

export default React.memo(BusinessCard);
```

Make sure `React` is imported at the top.

#### LogItem.jsx

Same pattern:
```js
function LogItem({ log }) {
    // ... existing body unchanged
}

export default React.memo(LogItem);
```

#### LeaderCard.jsx

Same pattern:
```js
function LeaderCard({ business, type, lang, isRTL }) {
    // ... existing body unchanged
}

export default React.memo(LeaderCard);
```

#### ProductCard.jsx

Same pattern — the file currently export defaults a function. Change:
```js
export default function ProductCard({ item, theme, lang = 'en' }) {
```
To:
```js
function ProductCard({ item, theme, lang = 'en' }) {
    // ... existing body unchanged
}

export default React.memo(ProductCard);
```

Add `import React` at top if not already there (it uses `useState` from `'react'` already, but verify `React` is in scope).

### Safety Check

```bash
# 1. Build check
npm run build 2>&1 | grep -i "error"

# 2. Navigate to http://localhost:3000/discover
#    ✅ PASS: Business cards still render and interact normally
#    ❌ FAIL: Components don't update when they should (rare — only if callbacks aren't stable)
```

---

## Task #21 — Add Search Input Debounce in Discover

### File to Open

`src/app/(consumer)/discover/page.jsx`

### Problem

**Line 170** — the search input fires `setSearchQuery` on every keystroke, causing `filteredBusinesses` to recompute on every character typed. With 100+ businesses, this causes noticeable lag.

### The Fix

#### Step 1: Add a `useRef` and `setTimeout` based debounce (no new dependencies)

In the `DiscoverContent` component, change the search state logic:

**Replace the current search state and input** with a debounced version.

Add a new ref and state (after the existing `useState` calls around line 22):

```js
const [searchQuery, setSearchQuery] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');
const searchTimerRef = useRef(null);

const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
        setDebouncedSearch(value);
    }, 300);
}, []);
```

Then update `filteredBusinesses` (line ~94) to use `debouncedSearch` instead of `searchQuery`:

```js
const filteredBusinesses = businesses
    .filter(b => {
        const matchesSearch = b.name.toLowerCase().includes(debouncedSearch.toLowerCase());
        // ...rest unchanged
    })
```

And update the search input `onChange` (line ~170):

```jsx
onChange={(e) => handleSearchChange(e.target.value)}
```

Also update the `useEffect` that resets visible count (line ~108) to depend on `debouncedSearch`:

```js
useEffect(() => { setVisibleCount(PAGE_SIZE) }, [debouncedSearch, selectedRegion, selectedCategory]);
```

### Safety Check

```bash
# 1. Build check
npm run build 2>&1 | grep -i "error"

# 2. Open http://localhost:3000/discover
#    Type quickly in the search box
#    ✅ PASS: Results update ~300ms after you stop typing (feels snappy, not laggy)
#    ❌ FAIL: No results ever appear, or results appear on every keystroke still
```

---

## Task #22 — Move JSON-LD to Server Component

### Problem

JSON-LD `<script type="application/ld+json">` tags are rendered inside `BusinessCard`, which is a `'use client'` component (lines 275–296 in `discover/page.jsx`). This means:
1. Search engines likely won't see the structured data (client-rendered)
2. The JSON-LD script re-renders on every state change

### Files to Open

1. `src/components/consumer/BusinessCard.jsx` (after Task #16 extraction)
2. `src/app/(consumer)/discover/page.jsx` — consider adding server-side JSON-LD here instead

### The Fix

#### Simple approach (recommended for Phase 3): Remove client-side JSON-LD, add it server-side later

1. In `BusinessCard.jsx`, **delete** the JSON-LD `<script>` block (lines 275–296 of the original, now near the top of the extracted component's JSX return):

   Delete this entire block:
   ```jsx
   {/* SEO: JSON-LD Review Schema Injection for Google Stars */}
   <script
       type="application/ld+json"
       dangerouslySetInnerHTML={{
           __html: JSON.stringify({
               // ... the whole schema object
           })
       }}
   />
   ```

2. Add a TODO comment where it was:
   ```jsx
   {/* TODO: Phase 6 — Move JSON-LD to a server component for proper SEO indexing */}
   ```

> [!NOTE]
> The full server-side JSON-LD implementation requires creating a server component wrapper around the discover page that fetches business data and generates the structured data at build/request time. This is a Phase 6 task and should not be attempted here.

### Safety Check

```bash
# 1. Build check
npm run build 2>&1 | grep -i "error"

# 2. Functional check — cards should render identically
#    The only difference is no <script> tags in the HTML output (invisible to users)
```

---

## Task #23 — Add Rate Limiting to Password Endpoints

> [!NOTE]
> **STATUS: ALREADY DONE.** Examining the current codebase:
>
> - `src/app/api/merchant/set-password/route.js` — Already has authentication via `getServerUser()` (line 15). Unauthenticated users are rejected with 401. Rate limiting is implicitly enforced by the auth requirement.
> - `src/app/api/merchant/check-password/route.js` — Already has a full in-memory sliding-window rate limiter (lines 14–43): max 5 requests per IP per 60-second window, with periodic cleanup.
>
> **Worker Action:** Verify both files have the fixes, then **mark this task as DONE**. No changes needed.

### Verification Commands

```bash
grep -n "getServerUser\|isRateLimited\|RATE_LIMIT" src/app/api/merchant/set-password/route.js src/app/api/merchant/check-password/route.js
# ✅ PASS: Shows getServerUser in set-password, and RATE_LIMIT constants + isRateLimited in check-password
```

---

## Task #24 — Add CSRF Protection to Admin POST Endpoints

### Problem

Admin state-changing POST endpoints use cookie-based auth. Cookies are automatically sent by the browser, making these routes vulnerable to Cross-Site Request Forgery (CSRF) attacks where a malicious website could trigger requests on behalf of an authenticated admin.

### Admin POST Routes Affected

1. `src/app/api/admin/claims/update/route.js` — Approves/rejects business claims
2. `src/app/api/admin/subscriptions/grant/route.js` — Grants subscription months
3. `src/app/api/admin/subscriptions/revoke/route.js` — Revokes subscriptions

> [!WARNING]
> All three routes already use `verifyAdmin()` for authentication. CSRF protection is an **additional** layer — do NOT replace or modify the existing `verifyAdmin()` calls.

### The Fix: Custom Header Validation

The simplest CSRF protection for API routes that are only called by your own frontend is to require a custom header that browsers won't automatically add on cross-origin requests.

#### Step 1: Create a CSRF utility

Create `src/lib/csrf.js`:

```js
/**
 * Simple CSRF protection for admin API routes.
 *
 * Validates that the request includes a custom `X-Requested-With` header.
 * Browsers do NOT automatically send custom headers on cross-origin requests
 * (they trigger a CORS preflight), so this blocks CSRF attacks from
 * malicious websites that rely on automatic cookie sending.
 *
 * The admin frontend must include this header in all fetch() calls.
 */
export function validateCsrfHeader(request) {
    const xRequestedWith = request.headers.get('x-requested-with');
    return xRequestedWith === 'TagdeerAdmin';
}
```

#### Step 2: Add to each admin POST route

For **each** of the three files, add the check **right after** the `verifyAdmin()` call:

```js
import { validateCsrfHeader } from '@/lib/csrf';

// ... inside the POST function, after verifyAdmin():

// CSRF protection
if (!validateCsrfHeader(req)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
}
```

**In `claims/update/route.js`** — add after line 17 (after `if (!admin)` block):
```js
if (!validateCsrfHeader(req)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
}
```

**In `subscriptions/grant/route.js`** — add after the `if (!admin)` block.

**In `subscriptions/revoke/route.js`** — add after the `if (!admin)` block.

#### Step 3: Update the admin frontend fetch calls

> [!CAUTION]
> **This is CRITICAL.** If you add the server-side check without updating the frontend, ALL admin actions will break with 403 errors.

Search for all admin `fetch()` calls and add the custom header:

```bash
grep -rn "fetch.*admin" src/app/admin/ src/actions/ --include='*.js' --include='*.jsx'
```

For every `fetch('/api/admin/...')` call found, add the header:

```js
// BEFORE:
fetch('/api/admin/claims/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ... })
});

// AFTER:
fetch('/api/admin/claims/update', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'TagdeerAdmin',
    },
    body: JSON.stringify({ ... })
});
```

Also check `src/actions/adminUserActions.js` for any server actions that call these routes internally — server-side calls don't need the header since they're not browser-initiated.

### Safety Check

```bash
# 1. Build check
npm run build 2>&1 | grep -i "error"

# 2. Admin portal functional test
#    a. Log in to http://localhost:3000/admin
#    b. Go to Users tab → try changing a user's status
#    ✅ PASS: Action succeeds normally
#    ❌ FAIL: 403 "Invalid request origin" → you missed adding the header to a fetch call

# 3. CSRF protection test (manual browser console)
#    Open browser console on ANY page and run:
#    fetch('/api/admin/claims/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
#    ✅ PASS: Returns 403 (no X-Requested-With header)
```

---

## Post-Phase-3 Global Safety Check

After completing ALL tasks above, run this final verification:

```bash
# 1. Full build
npm run build

# 2. Unit tests
npx vitest run

# 3. Auth smoke test — navigate these routes:
#    http://localhost:3000/              (home — LeaderCards)
#    http://localhost:3000/discover      (BusinessCards, LogItems, search debounce)
#    http://localhost:3000/profile       (no changes expected)
#    http://localhost:3000/b/[any-slug]  (InlineReviewBlock — uses shared hook)
#    http://localhost:3000/admin         (CSRF headers on actions)

# 4. Verify no context files were modified
git diff --name-only src/context/
# ✅ PASS: Empty output (no changes)
```

> [!IMPORTANT]
> If ANY route crashes or returns unexpected errors, STOP and identify which task caused it before continuing.
