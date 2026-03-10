# Sprint 2 — Bug Fixes & Stability: File-by-File Implementation Specification

**Date:** 2026-03-11
**Author:** Lead Systems Architect
**Sprint Duration:** Week 3-4
**Dependencies:** Sprint 1 (committed at `7d16abf`) must be deployed first.
**Scope:** 7 bugs — BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-06, + Coupon Serial Collision

---

## Table of Contents

1. [TASK 1: BUG-01 — Gader Points Race Condition (SQL + 4 files)](#task-1-bug-01--gader-points-race-condition)
2. [TASK 2: BUG-03 — Profiles FK Mismatch in OTP Verify (1 edge function)](#task-2-bug-03--profiles-fk-mismatch-in-otp-verify)
3. [TASK 3: BUG-04 — Anonymous Vote Limit Bypass (SQL + 1 API route)](#task-3-bug-04--anonymous-vote-limit-bypass)
4. [TASK 4: BUG-02 — Content Filter False Positives (1 file + test)](#task-4-bug-02--content-filter-false-positives)
5. [TASK 5: BUG-05 — Coupon Cron N+1 Queries (SQL + 1 edge function)](#task-5-bug-05--coupon-cron-n1-queries)
6. [TASK 6: BUG-06 — set-password setTimeout Race (1 API route)](#task-6-bug-06--set-password-settimeout-race)
7. [TASK 7: Coupon Serial Collision (1 file + SQL)](#task-7-coupon-serial-collision)
8. [Verification Plan](#verification-plan)

---

## Critical Rules for the Implementer

1. **Do NOT rename, delete, or reorganize** any file not explicitly listed in the task.
2. **Preserve all existing behavior** — every existing import, response shape, and status code must remain unchanged unless the task explicitly says otherwise.
3. **Do NOT run any `git` commands.** Write code only.
4. **Do NOT add placeholder comments** like `// ... existing code`. Write the complete, functional file content for every modification.
5. **Execute tasks in order.** Some tasks depend on migrations created in earlier ones.

---

## TASK 1: BUG-01 — Gader Points Race Condition

**Root Cause:** Client-side code reads `user.gader`, adds a computed amount, then writes `gader_points: newPoints` back. Two concurrent votes both read the same value and one increment is lost.

**Affected files:**
- `supabase/migrations/20260311_gader_points_atomic.sql` — **NEW**
- `src/app/(consumer)/layout.jsx` — MODIFY (lines 175-191)
- `src/app/(consumer)/b/[slug]/InlineReviewBlock.jsx` — MODIFY (lines 169-181)
- `src/actions/adminUserActions.js` — MODIFY (lines 80-106)

**Fix strategy:** Create a database RPC `increment_gader_points` that atomically increments and returns the new value. Replace all client-side read-add-write patterns with a single `.rpc()` call.

---

### TASK 1A: New Migration File

**File:** `supabase/migrations/20260311_gader_points_atomic.sql` — **NEW**

```sql
-- ============================================================
-- Atomic Gader Points Operations
-- Prevents race conditions when multiple concurrent votes
-- try to award points to the same user simultaneously.
-- ============================================================

-- RPC: Atomically increment (or decrement) a user's gader_points.
-- Returns the new gader_points value after the update.
CREATE OR REPLACE FUNCTION increment_gader_points(
    p_profile_id UUID,
    p_amount INTEGER DEFAULT 10
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_points INTEGER;
BEGIN
    UPDATE profiles
    SET gader_points = GREATEST(COALESCE(gader_points, 0) + p_amount, 0)
    WHERE id = p_profile_id
    RETURNING gader_points INTO v_new_points;

    IF NOT FOUND THEN
        -- Profile doesn't exist — return 0 silently.
        RETURN 0;
    END IF;

    RETURN v_new_points;
END;
$$;

-- RPC: Atomically increment a business stat column (recommends or complains).
-- Used by the business-stats API route to prevent read-modify-write races.
CREATE OR REPLACE FUNCTION increment_business_stat(
    p_business_id UUID,
    p_column TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_column = 'recommends' THEN
        UPDATE businesses SET recommends = COALESCE(recommends, 0) + 1
        WHERE id = p_business_id;
    ELSIF p_column = 'complains' THEN
        UPDATE businesses SET complains = COALESCE(complains, 0) + 1
        WHERE id = p_business_id;
    ELSE
        RAISE EXCEPTION 'Invalid column: %. Expected recommends or complains.', p_column;
    END IF;
END;
$$;
```

---

### TASK 1B: Modify `src/app/(consumer)/layout.jsx`

**What to change:** Replace lines 175-191 (the Gader Points awarding block inside `submitVote`).

**Current code (lines 175-191):**
```javascript
        // Award +10 Gader Points to verified users
        if (user?.id && supabase) {
            try {
                // Award points proportional to vote weight (min 5, max 25)
                // Higher-tier users earn more per vote — their vote has more impact.
                const earnedPoints = Math.max(5, Math.min(25, Math.round(weight * 10)));
                const newPoints = (user.gader || 0) + earnedPoints;
                await supabase
                    .from('profiles')
                    .update({ gader_points: newPoints })
                    .eq('id', user.id);
                // Update local state properly via setUser (not direct mutation)
                setUser(prev => prev ? { ...prev, gader: newPoints } : prev);
            } catch (e) {
                console.error('Error awarding points:', e);
            }
        }
```

**Replace with:**
```javascript
        // ✅ BUG-01 FIX: Award Gader Points atomically via RPC
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
```

**Constraints:**
- Do **NOT** change any other line in `layout.jsx`.
- The variable `weight` is computed earlier on line 151 and must remain unchanged.
- The `setUser` call must still update `.gader` (not `.gader_points`) because the context stores it as `gader`.

---

### TASK 1C: Modify `src/app/(consumer)/b/[slug]/InlineReviewBlock.jsx`

**What to change:** Replace lines 169-181 (the Gader Points awarding block inside `handleSubmit`).

**Current code (lines 169-181):**
```javascript
            // ── Step 5: Award Gader Points to verified users ──
            if (user?.id) {
                try {
                    const earnedPoints = Math.max(5, Math.min(25, Math.round(weight * 10)));
                    const newPoints = (user.gader || 0) + earnedPoints;
                    await supabase
                        .from('profiles')
                        .update({ gader_points: newPoints })
                        .eq('id', user.id);
                } catch (e) {
                    console.error('Error awarding points:', e);
                }
            }
```

**Replace with:**
```javascript
            // ✅ BUG-01 FIX: Award Gader Points atomically via RPC
            if (user?.id) {
                try {
                    const earnedPoints = Math.max(5, Math.min(25, Math.round(weight * 10)));
                    await supabase.rpc('increment_gader_points', {
                        p_profile_id: user.id,
                        p_amount: earnedPoints,
                    });
                } catch (e) {
                    console.error('Error awarding points:', e);
                }
            }
```

**Constraints:**
- Do **NOT** change any other line in `InlineReviewBlock.jsx`.
- This component does NOT have access to `setUser`, so we do NOT update local state here (the Discover page layout handles that).
- The `supabase` variable comes from `useTagdeer()` on line 16 and must remain unchanged.

---

### TASK 1D: Modify `src/actions/adminUserActions.js`

**What to change:** Replace the `adminManageUserGader` function (lines 80-107) to use the atomic RPC instead of read-then-write.

**Current code (lines 80-107):**
```javascript
export async function adminManageUserGader(userId, amount, reason) {
    await verifyAdmin()
    const supabase = getAdminSupabase()

    // First get current points
    const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('gader_points')
        .eq('id', userId)
        .single()

    if (fetchError) {
        return { error: fetchError.message || 'Failed to fetch user profile' }
    }

    const newPoints = Math.max((profile.gader_points || 0) + amount, 0)

    const { error: updateError } = await supabase
        .from('profiles')
        .update({ gader_points: newPoints })
        .eq('id', userId)

    if (updateError) {
        return { error: updateError.message || 'Failed to update points' }
    }

    return { success: true, newPoints }
}
```

**Replace with:**
```javascript
export async function adminManageUserGader(userId, amount, reason) {
    await verifyAdmin()
    const supabase = getAdminSupabase()

    // ✅ BUG-01 FIX: Use atomic RPC instead of read-then-write
    const { data: newPoints, error: rpcError } = await supabase.rpc('increment_gader_points', {
        p_profile_id: userId,
        p_amount: amount,
    })

    if (rpcError) {
        return { error: rpcError.message || 'Failed to update points' }
    }

    return { success: true, newPoints }
}
```

**Constraints:**
- Do **NOT** change any other function in this file.
- The `verifyAdmin()` call at the top must remain.
- The return shape `{ success: true, newPoints }` must remain identical.

---

### TASK 1E: Modify `src/app/api/consumer/business-stats/route.js`

**What to change:** Replace the read-modify-write pattern (lines 26-53) with an atomic RPC call.

**Current code (lines 26-53):**
```javascript
        // Fetch current stats
        const { data: business, error: fetchError } = await supabaseAdmin
            .from('businesses')
            .select('recommends, complains')
            .eq('id', id)
            .single();

        if (fetchError || !business) {
            return NextResponse.json({ error: 'Business not found' }, { status: 404 });
        }

        // Increment the appropriate counter
        const updates = {};
        if (type === 'recommend') {
            updates.recommends = (business.recommends || 0) + 1;
        } else if (type === 'complain') {
            updates.complains = (business.complains || 0) + 1;
        }

        const { error: updateError } = await supabaseAdmin
            .from('businesses')
            .update(updates)
            .eq('id', id);

        if (updateError) {
            console.error('Error updating business stats:', updateError);
            return NextResponse.json({ error: 'Failed to update stats' }, { status: 500 });
        }

        return NextResponse.json({ success: true, ...updates });
```

**Replace with:**
```javascript
        // ✅ BUG-01 FIX: Atomic increment via RPC (prevents read-modify-write race)
        const column = type === 'recommend' ? 'recommends' : 'complains';
        const { error: rpcError } = await supabaseAdmin.rpc('increment_business_stat', {
            p_business_id: id,
            p_column: column,
        });

        if (rpcError) {
            console.error('RPC error:', rpcError);
            // If the RPC fails because the business doesn't exist, return 404
            if (rpcError.message?.includes('does not exist') || rpcError.code === 'PGRST116') {
                return NextResponse.json({ error: 'Business not found' }, { status: 404 });
            }
            return NextResponse.json({ error: 'Failed to update stats' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
```

**Constraints:**
- Do **NOT** change lines 1-25 (imports, auth guard, parameter validation).
- The response shape changes from `{ success: true, recommends: N }` to `{ success: true }` — this is acceptable because no frontend consumer reads the returned count from this endpoint.

---

## TASK 2: BUG-03 — Profiles FK Mismatch in OTP Verify

**Root Cause:** `whatsapp-otp-verify/index.ts` creates profiles (line 81-90) by inserting a row with no explicit `id`, which means Supabase auto-generates a UUID. But if `profiles.id` has a foreign key to `auth.users(id)`, the insert will FAIL because no `auth.users` row exists with that UUID. Even if the FK was removed, the WhatsApp user has an "orphan" profile with no way to sign in via Supabase Auth.

**File:** `supabase/functions/whatsapp-otp-verify/index.ts` — MODIFY

**What to change:** Replace the profile creation block (lines 76-99) with logic that:
1. Creates a **real** Supabase Auth user first (phone-based, auto-confirmed)
2. Creates the profile with `id = authData.user.id` (FK-safe)
3. Uses `crypto.getRandomValues()` instead of `Math.random()` for the `user_id` VIP code

**Current code (lines 76-99):**
```typescript
        if (profileErr && profileErr.code === "PGRST116") {
            // No profile found — create one
            isNewUser = true;
            const randomAlphanumeric = Math.random().toString(36).substring(2, 7).toUpperCase();

            const { data: newProfile, error: insertErr } = await supabaseAdmin
                .from("profiles")
                .insert([{
                    phone: normalizedPhone,
                    user_id: `VIP-${randomAlphanumeric}`,
                    gader_points: 20,
                    vip_tier: "Bronze"
                }])
                .select()
                .single();

            if (insertErr) {
                console.error("Error creating profile:", insertErr);
                return new Response(
                    JSON.stringify({ error: "Failed to create user profile" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            profile = newProfile;
        } else if (profileErr) {
```

**Replace with:**
```typescript
        if (profileErr && profileErr.code === "PGRST116") {
            // No profile found — create auth user FIRST, then profile
            isNewUser = true;

            // ✅ BUG-03 FIX: Create a real Supabase Auth user (phone-based)
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                phone: normalizedPhone,
                phone_confirm: true,
                user_metadata: { signup_method: 'whatsapp_otp' },
            });

            if (authError) {
                console.error("Error creating auth user:", authError);
                return new Response(
                    JSON.stringify({ error: "Failed to create user account" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const authUserId = authData.user.id;

            // ✅ BUG-03 FIX: Use crypto-secure random for VIP code (not Math.random)
            const randomBytes = new Uint8Array(4);
            crypto.getRandomValues(randomBytes);
            const randomAlphanumeric = Array.from(randomBytes)
                .map(b => b.toString(36))
                .join('')
                .substring(0, 5)
                .toUpperCase();

            // ✅ BUG-03 FIX: Profile.id = auth user id (FK-safe)
            const { data: newProfile, error: insertErr } = await supabaseAdmin
                .from("profiles")
                .insert([{
                    id: authUserId,
                    phone: normalizedPhone,
                    user_id: `VIP-${randomAlphanumeric}`,
                    gader_points: 20,
                    vip_tier: "Bronze",
                    role: "consumer",
                }])
                .select()
                .single();

            if (insertErr) {
                console.error("Error creating profile:", insertErr);
                return new Response(
                    JSON.stringify({ error: "Failed to create user profile" }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            profile = newProfile;
        } else if (profileErr) {
```

**Constraints:**
- Do **NOT** change lines 1-75 (imports, CORS, rate limiting, OTP verification logic).
- Do **NOT** change lines 100-136 (error handling, profile return, catch block).
- The response shape (`profile: { id, phone, user_id, ... }`) must remain identical.
- The `supabaseAdmin` client is already created with the service role key (line 27-30), which is required for `auth.admin.createUser()`.

---

## TASK 3: BUG-04 — Anonymous Vote Limit Bypass

**Root Cause:** The 3-vote limit for anonymous users is stored only in `localStorage`. Clearing storage, using incognito, or switching browsers bypasses it. The server-side check in `InlineReviewBlock.jsx` uses fingerprint-in-`logs` but the `business-stats/route.js` API has no equivalent check.

**Fix strategy:** Create a dedicated `anonymous_votes` table and an RPC. Add a server-side anonymous vote limit check in `business-stats/route.js`. The existing `logs`-based fingerprint checks in `InlineReviewBlock.jsx` and `layout.jsx` serve as a first-pass client-side check and should remain untouched.

---

### TASK 3A: New Migration File

**File:** `supabase/migrations/20260311_anonymous_vote_limits.sql` — **NEW**

```sql
-- ============================================================
-- Anonymous Vote Tracking
-- Enforces vote limits for unauthenticated users using
-- IP address + device fingerprint hashing.
-- ============================================================

CREATE TABLE IF NOT EXISTS anonymous_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint_hash TEXT NOT NULL,
    ip_address INET,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('recommend', 'complain')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fingerprint lookups (primary limit enforcement)
CREATE INDEX IF NOT EXISTS idx_anon_votes_fingerprint ON anonymous_votes(fingerprint_hash);

-- Index for IP lookups (secondary limit enforcement)
CREATE INDEX IF NOT EXISTS idx_anon_votes_ip ON anonymous_votes(ip_address);

-- Enable RLS (deny all by default — only service role should access this)
ALTER TABLE anonymous_votes ENABLE ROW LEVEL SECURITY;

-- RPC: Check if an anonymous user has exceeded the vote limit.
-- Returns TRUE if the vote is allowed, FALSE if rate-limited.
CREATE OR REPLACE FUNCTION check_anonymous_vote_limit(
    p_fingerprint TEXT,
    p_ip TEXT,
    p_max_votes INTEGER DEFAULT 3,
    p_window_days INTEGER DEFAULT 7
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM anonymous_votes
    WHERE (fingerprint_hash = p_fingerprint OR ip_address = p_ip::INET)
      AND created_at > NOW() - (p_window_days || ' days')::INTERVAL;

    RETURN v_count < p_max_votes;
END;
$$;
```

---

### TASK 3B: Modify `src/app/api/consumer/business-stats/route.js`

**What to change:** After the auth check (line 13-16), add a fallback path for anonymous users. Currently, unauthenticated requests get a 401. We need to **keep** the 401 for fully unauthenticated requests BUT introduce a new header-based fingerprint path for anonymous votes that are tracked server-side.

> [!IMPORTANT]
> **Design Decision:** The Sprint 1 SEC-01 fix made this route require authentication. The execution plan's BUG-04 says anonymous users should be allowed to vote (up to 3 times). These two requirements conflict. Resolution: **Keep authentication required.** Anonymous voting limits are already enforced in the `logs`-based checks in `layout.jsx` and `InlineReviewBlock.jsx`, which insert directly into the `logs` table via the Supabase client (not via this API route). This API route is a separate endpoint for stat counter manipulation. Therefore, **TASK 3B modifies nothing** — the anonymous vote limit is enforced at the component level, and the `business-stats` route stays authenticated. This task only creates the migration in TASK 3A for future use if the anonymous voting path is refactored to go through a dedicated API route.

**No code change required in this file for BUG-04.**

---

## TASK 4: BUG-02 — Content Filter False Positives

**Root Cause:** `contentFilter.js` uses `String.includes()` for substring matching. "classic" matches "ass", "therapist" matches "crap", "assassin" matches "ass".

**File:** `src/lib/contentFilter.js` — MODIFY (full file replacement)

**Replace entire file with:**

```javascript
/**
 * Utility for Content Integrity (The Judge).
 * Implements a Bad Word Dictionary filter for all logs.
 * If a log contains prohibited slang or harassment, it returns true,
 * meaning it must be flagged for review and not impact the Gader Index until cleared.
 *
 * ✅ BUG-02 FIX: Uses word-boundary regex for English and space/punctuation
 * boundaries for Arabic to prevent false positives on words like
 * "classic", "therapist", "assassin", etc.
 */

// English bad words — matched with \b word boundaries
const ENGLISH_BAD_WORDS = [
    'spam', 'fake', 'scam', 'fraud', 'fuck', 'shit', 'bitch', 'asshole',
    'idiot', 'stupid', 'crap', 'bastard',
];

// Arabic bad words — matched with space/punctuation boundaries
const ARABIC_BAD_WORDS = [
    'نصاب', 'سارق', 'كذاب', 'غشاش', 'تفو', 'كلب', 'حمار', 'زبالة',
    'محتال', 'سرقة', 'عنصري', 'شتم', 'سب',
];

// ✅ English: Word-boundary regex prevents substring false positives
// Escapes special characters in words, then wraps in \b ... \b
const englishPattern = new RegExp(
    '\\b(' + ENGLISH_BAD_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
    'i'
);

// ✅ Arabic: Space/punctuation/start/end boundaries
// Arabic doesn't use \b correctly, so we use Unicode-aware boundaries
const arabicPattern = new RegExp(
    '(?:^|[\\s\\u060C\\u061B\\u061F\\u0021-\\u002F\\u003A-\\u0040])(' + ARABIC_BAD_WORDS.join('|') + ')(?=[\\s\\u060C\\u061B\\u061F\\u0021-\\u002F\\u003A-\\u0040]|$)',
    'u'
);

export const containsBadWords = (text) => {
    if (!text || typeof text !== 'string') return false;

    const normalizedText = text.toLowerCase();

    return englishPattern.test(normalizedText) || arabicPattern.test(text);
};
```

**Constraints:**
- The function name `containsBadWords` and its export must remain identical.
- The function signature `(text) => boolean` must remain identical.
- The bad word lists remain the same — only the matching logic changes.
- Arabic bad words are tested against the **original** text (not lowercased), because Arabic has no case concept.

---

### TASK 4B: Update `src/lib/contentFilter.test.js`

**File:** `src/lib/contentFilter.test.js` — MODIFY (full file replacement)

**Replace entire file with:**

```javascript
import { describe, it, expect } from 'vitest';
import { containsBadWords } from './contentFilter';

describe('contentFilter – containsBadWords', () => {
    // ── Should FLAG prohibited content ──────────────────────────────
    it('flags English bad words', () => {
        expect(containsBadWords('This place is a total scam')).toBe(true);
    });

    it('flags bad words regardless of casing', () => {
        expect(containsBadWords('FAKE reviews everywhere')).toBe(true);
        expect(containsBadWords('What a Fraud!')).toBe(true);
    });

    it('flags Arabic prohibited words', () => {
        expect(containsBadWords('هذا المحل نصاب')).toBe(true);
        expect(containsBadWords('صاحبه غشاش')).toBe(true);
    });

    it('flags standalone bad words at start/end of string', () => {
        expect(containsBadWords('scam detected here')).toBe(true);
        expect(containsBadWords('this is a scam')).toBe(true);
        expect(containsBadWords('crap')).toBe(true);
    });

    // ── BUG-02 FIX: Should NOT flag words that CONTAIN bad words as substrings ──
    it('does NOT flag "classic" (contains "ass")', () => {
        expect(containsBadWords('What a classic restaurant')).toBe(false);
    });

    it('does NOT flag "therapist" (contains "crap" shifted? — no, but it should not match "the")', () => {
        expect(containsBadWords('She is a great therapist')).toBe(false);
    });

    it('does NOT flag "assassin" (contains "ass")', () => {
        expect(containsBadWords('The movie is about an assassin')).toBe(false);
    });

    it('does NOT flag "scrapbook" (contains "crap")', () => {
        expect(containsBadWords('I made a scrapbook for her birthday')).toBe(false);
    });

    it('does NOT flag "Islamabad" (no bad word)', () => {
        expect(containsBadWords('I visited Islamabad last year')).toBe(false);
    });

    it('does NOT flag "spammer" partial match — flags because "spam" is a standalone word within "spammer"', () => {
        // NOTE: \b treats "spammer" as having "spam" at its start.
        // "spam" IS at a word boundary in "spammer" — this is intentional.
        // We want to catch "spammer" because it derives from a bad word.
        expect(containsBadWords('Stop being a spammer')).toBe(true);
    });

    // ── Should ALLOW clean content ──────────────────────────────────
    it('allows clean English text', () => {
        expect(containsBadWords('Great service and friendly staff!')).toBe(false);
    });

    it('allows clean Arabic text', () => {
        expect(containsBadWords('خدمة ممتازة وأسعار معقولة')).toBe(false);
    });

    // ── Edge cases ──────────────────────────────────────────────────
    it('returns false for empty string', () => {
        expect(containsBadWords('')).toBe(false);
    });

    it('returns false for null or undefined', () => {
        expect(containsBadWords(null)).toBe(false);
        expect(containsBadWords(undefined)).toBe(false);
    });

    it('returns false for non-string input', () => {
        expect(containsBadWords(12345)).toBe(false);
    });
});
```

**Constraints:**
- The test file uses `vitest` (matching the existing import pattern).
- All original test cases are preserved.
- New test cases added specifically for the false-positive regression.

---

## TASK 5: BUG-05 — Coupon Cron N+1 Queries

**Root Cause:** `coupon-expiry-cron/index.ts` fetches all expired coupons, then loops and fires 2 queries per coupon (1 status update + 1 RPC call). With 1000 expired coupons, this is 2001 queries.

**Fix strategy:** Create a batch RPC that does all updates in a single SQL transaction. Simplify the edge function to a single RPC call.

---

### TASK 5A: New Migration File

**File:** `supabase/migrations/20260311_coupon_expiry_batch.sql` — **NEW**

```sql
-- ============================================================
-- Batch Coupon Expiry Processing
-- Replaces the N+1 loop in the coupon-expiry-cron edge function
-- with a single SQL transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION expire_coupons_batch()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expired_count INTEGER;
    v_returned_count INTEGER;
BEGIN
    -- Step 1: Batch-update all expired user_coupons to EXPIRED status
    WITH expired AS (
        UPDATE user_coupons
        SET status = 'EXPIRED'
        WHERE status = 'ACTIVE'
          AND valid_until IS NOT NULL
          AND valid_until < NOW()
        RETURNING id, campaign_id, source
    )
    SELECT COUNT(*) INTO v_expired_count FROM expired;

    -- Step 2: Decrement claimed_count for all affected campaigns in one pass.
    -- Groups by campaign_id to batch the decrements.
    WITH recently_expired AS (
        SELECT campaign_id, COUNT(*) AS cnt
        FROM user_coupons
        WHERE status = 'EXPIRED'
          AND valid_until IS NOT NULL
          AND valid_until < NOW() + INTERVAL '1 minute'
          AND valid_until >= NOW() - INTERVAL '1 minute'
        GROUP BY campaign_id
    )
    UPDATE merchant_coupons mc
    SET claimed_count = GREATEST(0, mc.claimed_count - re.cnt)
    FROM recently_expired re
    WHERE mc.id = re.campaign_id;

    GET DIAGNOSTICS v_returned_count = ROW_COUNT;

    RETURN json_build_object(
        'expired_count', v_expired_count,
        'campaigns_adjusted', v_returned_count
    );
END;
$$;
```

---

### TASK 5B: Modify `supabase/functions/coupon-expiry-cron/index.ts`

**Replace entire file with:**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        const supabase = createClient(supabaseUrl, supabaseKey);

        // ✅ BUG-05 FIX: Single batch RPC replaces N+1 loop
        const { data, error } = await supabase.rpc('expire_coupons_batch');

        if (error) {
            throw error;
        }

        console.log(`Coupon expiry batch result:`, data);

        return new Response(JSON.stringify({
            message: "Successfully processed expired coupons.",
            ...data
        }), { status: 200 });

    } catch (error) {
        console.error("Cron Job Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
```

**Constraints:**
- The import paths must stay `https://deno.land/std@0.168.0/http/server.ts` and `https://esm.sh/@supabase/supabase-js@2.7.1` (matching original versions).
- The env var names `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must match the Deno runtime injected variables.
- The HTTP response must remain a JSON object with a `message` key for compatibility with any cron monitoring.

---

## TASK 6: BUG-06 — set-password setTimeout Race

**Root Cause:** `set-password/route.js` line 69 uses `await new Promise(resolve => setTimeout(resolve, 1000))` hoping the database trigger creates the profile within 1 second. Under load, the trigger may take longer, causing the subsequent `UPDATE profiles SET role = 'merchant'` to silently fail (no row to update).

**File:** `src/app/api/merchant/set-password/route.js` — MODIFY

**What to change:** Replace lines 68-79 (the setTimeout + update block) with a poll-and-fallback pattern.

**Current code (lines 68-79):**
```javascript
            // Wait a moment for trigger to create the plain profile
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Explicitly set role to merchant for these newly created accounts
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({ role: 'merchant', has_password: true })
                .eq('id', userId);

            if (profileError) {
                console.error('Profile update error:', profileError);
            }
```

**Replace with:**
```javascript
            // ✅ BUG-06 FIX: Poll for profile creation with exponential backoff
            let profileReady = false;
            for (let attempt = 0; attempt < 5; attempt++) {
                const { data: checkProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('id', userId)
                    .maybeSingle();

                if (checkProfile) {
                    profileReady = true;
                    break;
                }
                // Exponential backoff: 200ms, 400ms, 800ms, 1600ms, 3200ms
                await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt)));
            }

            if (!profileReady) {
                // Trigger didn't create the profile — create it explicitly
                const { error: insertError } = await supabaseAdmin
                    .from('profiles')
                    .insert({
                        id: userId,
                        email: email.toLowerCase().trim(),
                        role: 'merchant',
                        has_password: true,
                    });

                if (insertError) {
                    console.error('Profile insert fallback error:', insertError);
                }
            } else {
                // Profile exists — just update the role and password flag
                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .update({ role: 'merchant', has_password: true })
                    .eq('id', userId);

                if (profileError) {
                    console.error('Profile update error:', profileError);
                }
            }
```

**Constraints:**
- Do **NOT** change lines 1-67 (imports, input validation, user lookup, user creation).
- Do **NOT** change lines 80-112 (the early return, existing-user password update, and catch block).
- The `supabaseAdmin` variable is already created on line 30 and must remain unchanged.
- The `userId` variable is set on line 65 and must remain unchanged.
- The `email` variable is set on line 13 and must remain unchanged.

---

## TASK 7: Coupon Serial Collision

**Root Cause:** `serialCodeGenerator.js` uses `Math.random()` (non-cryptographic, easily predictable). Two concurrent coupon creations could generate the same serial code. There is no database uniqueness constraint to catch this.

---

### TASK 7A: Modify `src/lib/serialCodeGenerator.js`

**Replace entire file with:**

```javascript
/**
 * Serial Code Generator for Tagdeer Coupons
 * Format: TAG-{MERCHANT_PREFIX}-{RANDOM_ALPHANUM}
 * Example: TAG-CAF-8X99AB
 *
 * ✅ COLLISION FIX: Uses crypto.getRandomValues() for cryptographic randomness
 * instead of Math.random(). Combined with the UNIQUE constraint on serial_code
 * in the database, this makes collisions virtually impossible.
 */

/**
 * Generates a unique serial code for a coupon.
 * @param {string} businessName - The name of the business to derive the prefix.
 * @param {number} randomLength - Length of the random alphanumeric part (default 6).
 * @returns {string} - The generated serial code.
 */
export function generateCouponSerial(businessName, randomLength = 6) {
    if (!businessName) {
        businessName = "MER"; // Fallback
    }

    // 1. Clean business name: remove special chars, keep alphanumeric, uppercase
    const cleanName = businessName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // 2. Get prefix (first 3 letters, padded with 'X' if too short)
    let prefix = cleanName.substring(0, 3);
    while (prefix.length < 3) {
        prefix += 'X';
    }

    // 3. Generate random alphanumeric string using crypto-secure randomness
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars: I, O, 1, 0
    let randomPart = '';

    // ✅ COLLISION FIX: Use crypto.getRandomValues instead of Math.random
    const values = new Uint8Array(randomLength);
    crypto.getRandomValues(values);
    for (let i = 0; i < randomLength; i++) {
        randomPart += characters.charAt(values[i] % characters.length);
    }

    // 4. Combine parts
    return `TAG-${prefix}-${randomPart}`;
}
```

**Constraints:**
- The function name, export, and signature must remain identical.
- The format `TAG-{PREFIX}-{RANDOM}` must remain identical.
- The character set (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`) must remain identical.
- `crypto.getRandomValues` is available in both browser and Node.js 18+ (which Next.js 16 requires).

---

### TASK 7B: New Migration File

**File:** `supabase/migrations/20260311_coupon_serial_unique.sql` — **NEW**

```sql
-- ============================================================
-- Coupon Serial Code Uniqueness Constraint
-- Prevents duplicate serial codes in the merchant_coupons table.
-- Combined with crypto-secure generation, makes collisions
-- virtually impossible, and catches them at the DB level if they occur.
-- ============================================================

-- Add unique constraint (IF NOT EXISTS is not supported for constraints,
-- so we use a DO block to check first)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_serial_code'
    ) THEN
        ALTER TABLE merchant_coupons
        ADD CONSTRAINT unique_serial_code UNIQUE (serial_code);
    END IF;
END;
$$;
```

**Constraints:**
- The constraint name must be `unique_serial_code`.
- The migration is idempotent (safe to run multiple times).

---

## Verification Plan

### Automated Tests

**Content Filter (BUG-02) — run with vitest:**

```bash
cd /Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom
npx vitest run src/lib/contentFilter.test.js
```

This test covers:
- All original positive and negative test cases
- New false-positive regression tests ("classic", "therapist", "assassin", "scrapbook")

### Build Verification

```bash
cd /Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom
npm run build
```

The build must exit with code 0. All API routes and components must compile without errors.

### Manual Verification (Staging)

After deploying to staging, run the following checks:

**1. Gader Points (BUG-01):**
- Open two browser tabs logged into the same consumer account.
- Vote on the same business simultaneously in both tabs.
- Verify that `gader_points` incremented by the correct total (not lost one increment).
- Verify the admin "Manage Gader" action still works from the admin panel.

**2. Profile Creation (BUG-03):**
- Use a new phone number via the WhatsApp OTP flow.
- Verify the user can log in and has a profile in `profiles` table.
- Verify `profiles.id` matches the corresponding `auth.users.id`.

**3. Content Filter (BUG-02):**
- Submit a review containing "classic restaurant" — should NOT be flagged.
- Submit a review containing "scam artist" — should be flagged.

**4. Coupon Cron (BUG-05):**
- Create a test coupon with `valid_until` in the past.
- Invoke the cron edge function manually.
- Verify the coupon status changed to `EXPIRED` and `claimed_count` was decremented.

**5. Set Password (BUG-06):**
- Create a new merchant via the OTP flow, then set a password.
- Verify the profile has `role = 'merchant'` and `has_password = true`.

**6. Serial Collision (TASK 7):**
- Generate 100 coupon serials in a loop and verify all are unique.
- Attempt to insert two coupons with the same serial code directly in SQL — verify the UNIQUE constraint rejects the second.

### SQL Migration Verification

Apply all 4 new migrations to the staging database:

```bash
supabase db push --linked
```

Verify that:
1. `increment_gader_points` RPC exists and returns the new points value.
2. `increment_business_stat` RPC exists and atomically increments the column.
3. `anonymous_votes` table exists with proper indexes.
4. `expire_coupons_batch` RPC exists and returns `{ expired_count, campaigns_adjusted }`.
5. `unique_serial_code` constraint exists on `merchant_coupons.serial_code`.
