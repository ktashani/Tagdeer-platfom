# 🔒 Sprint 1 — Critical Security: File-by-File Implementation Specification

**Author:** Lead Systems Architect
**Date:** 2026-03-11
**Sprint Window:** Week 1-2 (Target: 2026-03-11 → 2026-03-22)
**Executor:** Junior Developer
**Prerequisite:** Read this document end-to-end before writing any code.

---

## Table of Contents

1. [Overview & Dependency Order](#overview--dependency-order)
2. [TASK 1: Create Shared Server Auth Utility](#task-1-create-shared-server-auth-utility-new-file)
3. [TASK 2: Create Shared Admin Auth Utility](#task-2-create-shared-admin-auth-utility-new-file)
4. [TASK 3: SEC-04 — Remove Hardcoded Supabase Key](#task-3-sec-04--remove-hardcoded-supabase-key)
5. [TASK 4: SEC-01 — Authenticate Business Stats Route](#task-4-sec-01--authenticate-business-stats-route)
6. [TASK 5: Authenticate Consumer Logs Route](#task-5-authenticate-consumer-logs-route)
7. [TASK 6: SEC-03 — Fix Trial Claim Identity Spoofing](#task-6-sec-03--fix-trial-claim-identity-spoofing)
8. [TASK 7: SEC-02 — Fix SSRF in Catalog Feed Parser](#task-7-sec-02--fix-ssrf-in-catalog-feed-parser)
9. [TASK 8: Add Admin Auth to Subscriptions Routes](#task-8-add-admin-auth-to-subscriptions-routes)
10. [TASK 9: SEC-05 — Fix OTP Math.random](#task-9-sec-05--fix-otp-mathrandom)
11. [TASK 10: SEC-06 — Fix CORS Wildcard on Edge Functions](#task-10-sec-06--fix-cors-wildcard-on-edge-functions)
12. [TASK 11: SEC-07 — Add Rate Limiting to OTP Endpoints](#task-11-sec-07--add-rate-limiting-to-otp-endpoints)
13. [TASK 12: BUG-07 — Fix Permissions-Policy Blocking Camera](#task-12-bug-07--fix-permissions-policy-blocking-camera)
14. [TASK 13: Create .env.example](#task-13-create-envexample)
15. [Verification Plan](#verification-plan)

---

## Overview & Dependency Order

> [!CAUTION]
> Tasks MUST be implemented in the order listed. Later tasks depend on earlier ones.

```mermaid
graph LR
    T1["TASK 1<br>serverAuth.js"] --> T4["TASK 4<br>SEC-01"]
    T1 --> T5["TASK 5<br>logs auth"]
    T1 --> T6["TASK 6<br>SEC-03"]
    T1 --> T7["TASK 7<br>SEC-02"]
    T2["TASK 2<br>adminAuth.js"] --> T8["TASK 8<br>admin subs"]
    T3["TASK 3<br>SEC-04"] -.-> T1
    T9["TASK 9<br>SEC-05"] --> T10["TASK 10<br>SEC-06"]
    T10 --> T11["TASK 11<br>SEC-07"]
    T12["TASK 12<br>BUG-07"]
    T13["TASK 13<br>.env.example"]
```

**Files to create (2):**
| # | File Path | Purpose |
|---|-----------|---------|
| NEW-1 | `src/lib/serverAuth.js` | Shared server-side auth utility for API routes |
| NEW-2 | `src/lib/adminAuth.js` | Shared admin cookie verification utility |

**Files to modify (10):**
| # | File Path | Task |
|---|-----------|------|
| MOD-1 | [src/lib/supabaseClient.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/lib/supabaseClient.js) | TASK 3: Remove hardcoded key |
| MOD-2 | [src/app/api/consumer/business-stats/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/consumer/business-stats/route.js) | TASK 4: Add auth |
| MOD-3 | [src/app/api/consumer/logs/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/consumer/logs/route.js) | TASK 5: Add auth |
| MOD-4 | [src/app/api/merchant/trial/claim/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/merchant/trial/claim/route.js) | TASK 6: Fix identity spoofing |
| MOD-5 | [src/app/api/merchant/parse-catalog-feed/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/merchant/parse-catalog-feed/route.js) | TASK 7: Fix SSRF |
| MOD-6 | [src/app/api/admin/subscriptions/grant/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/admin/subscriptions/grant/route.js) | TASK 8: Add admin auth |
| MOD-7 | [src/app/api/admin/subscriptions/revoke/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/admin/subscriptions/revoke/route.js) | TASK 8: Add admin auth |
| MOD-8 | [supabase/functions/whatsapp-otp-send/index.ts](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/whatsapp-otp-send/index.ts) | TASK 9, 10, 11 |
| MOD-9 | [supabase/functions/whatsapp-otp-verify/index.ts](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/whatsapp-otp-verify/index.ts) | TASK 10, 11 |
| MOD-10 | [next.config.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/next.config.js) | TASK 12: Fix Permissions-Policy |

**New directories:**
| Path | Purpose |
|------|---------|
| `supabase/functions/_shared/` | Shared edge function utilities |

**SQL migration (1):**
| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDD_otp_rate_limiting.sql` | Rate limiting table + RPC for OTP |

---

## TASK 1: Create Shared Server Auth Utility [NEW FILE]

**File:** `src/lib/serverAuth.js`
**Purpose:** Provides a single reusable function that API routes call to extract the authenticated Supabase user from the request's cookies. This replaces all ad-hoc auth patterns.

> [!IMPORTANT]
> **This file is a dependency for TASKs 4, 5, 6, and 7.** It must be created first.

### Prerequisites (install if missing)

Check if `@supabase/ssr` is installed:

```bash
grep '"@supabase/ssr"' package.json
```

If it returns nothing, install it:

```bash
npm install @supabase/ssr
```

### Exact File Contents

Create the file at: `/Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/lib/serverAuth.js`

```javascript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Extracts the authenticated Supabase user from the server-side session cookies.
 *
 * Usage in any API route:
 *   import { getServerUser } from '@/lib/serverAuth';
 *   const user = await getServerUser();
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *
 * @returns {Promise<Object|null>} The user object { id, email, phone, ... } or null.
 */
export async function getServerUser() {
    try {
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll: () => cookieStore.getAll(),
                },
            }
        );

        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return null;
        return user;
    } catch {
        return null;
    }
}
```

### Constraints
- Do NOT import the service role key in this file. This uses the anon key with the user's session cookie.
- The `cookies()` call must use `await` (Next.js 16 async cookies API).
- Do NOT add any `'use client'` directive. This is server-only code.
- Do NOT add any caching or memoization. Each call must verify the session fresh.
- Do NOT export the `supabase` client. Only export the `getServerUser` function.

---

## TASK 2: Create Shared Admin Auth Utility [NEW FILE]

**File:** `src/lib/adminAuth.js`
**Purpose:** Provides a single reusable function to verify that a request is from a valid admin by checking the `admin_auth` cookie against the `profiles` table.

> [!IMPORTANT]
> **This file is a dependency for TASK 8.**

### Exact File Contents

Create the file at: `/Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/lib/adminAuth.js`

```javascript
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * List of profile roles that grant admin access.
 * Must be kept in sync with the check-auth route and the admin middleware.
 */
const ADMIN_ROLES = ['super_admin', 'admin', 'assistant_admin', 'support_agent'];

/**
 * Verifies the admin_auth cookie and returns the admin's user ID and role.
 *
 * The admin_auth cookie stores the admin's profile UUID (not a boolean).
 * This function cross-references the UUID against the profiles table
 * to confirm the role is in the allowed ADMIN_ROLES list.
 *
 * Usage:
 *   import { verifyAdmin } from '@/lib/adminAuth';
 *   const admin = await verifyAdmin();
 *   if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *
 * @returns {Promise<{ id: string, role: string } | null>}
 */
export async function verifyAdmin() {
    try {
        const cookieStore = await cookies();
        const adminCookie = cookieStore.get('admin_auth');

        // Reject missing cookie or legacy 'true' format
        if (!adminCookie?.value || adminCookie.value === 'true') {
            return null;
        }

        const userId = adminCookie.value;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return null;
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (error || !profile || !ADMIN_ROLES.includes(profile.role)) {
            return null;
        }

        return { id: userId, role: profile.role };
    } catch {
        return null;
    }
}
```

### Constraints
- This is an **exact extraction** of the auth logic already in [src/app/api/admin/check-auth/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/admin/check-auth/route.js). The `ADMIN_ROLES` array and the cookie check logic MUST remain identical.
- The function must return `null` for ANY failure case — never throw.
- Do NOT modify [src/app/api/admin/check-auth/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/admin/check-auth/route.js) itself. It can be refactored later, but not in this sprint to avoid risk.
- Do NOT modify [src/app/api/admin/claims/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/admin/claims/route.js) or [src/app/api/admin/claims/update/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/admin/claims/update/route.js). They already have their own inline admin cookie check that works. Leave them alone.

---

## TASK 3: SEC-04 — Remove Hardcoded Supabase Key

**File:** [src/lib/supabaseClient.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/lib/supabaseClient.js)
**Current state:** 26 lines. Lines 3-4 contain hardcoded fallback values for the Supabase URL and anon key.

### What to Change

Replace lines 3-4 (the `const` declarations with fallback strings) with versions that have NO fallbacks and throw an error if the environment variables are missing.

### Exact Change

**Find this (lines 3-4):**
```javascript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ipjvgbxkouadovjqwncx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwanZnYnhrb3VhZG92anF3bmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTEwODgsImV4cCI6MjA4NzE4NzA4OH0._t52YKSYIjnqFmBycXEkmq3nJnXnVrKB0H3ZD8ju14s';
```

**Replace with:**
```javascript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file.'
    );
}
```

### Constraints
- Do NOT change anything else in this file. Lines 6-26 must remain exactly as they are.
- Do NOT change the `window.tagdeer_supabase` singleton pattern.
- After making this change, the app will **crash on startup** if `.env.local` is missing the Supabase URL/Key. This is intentional — it's better to fail loudly than silently use a leaked key.
- If the `.env.local` file on your machine does not have these values, add them **before** testing.

### Post-Change Verification
```bash
# The app must start without errors (assuming .env.local is correct):
npm run dev
# Visit http://localhost:3000 — it should load normally.
```

---

## TASK 4: SEC-01 — Authenticate Business Stats Route

**File:** [src/app/api/consumer/business-stats/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/consumer/business-stats/route.js)
**Current state:** 54 lines. No authentication. Anyone can POST to inflate/deflate business scores.

### What to Change

1. Import and use `getServerUser` from TASK 1.
2. Add an auth check at the top of the [POST](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/merchant/parse-catalog-feed/route.js#3-88) handler.
3. Keep the rest of the logic **exactly the same**.

### Exact Replacement — Full File

Replace the ENTIRE file with:

```javascript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/serverAuth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    try {
        // ✅ SEC-01 FIX: Require authenticated user
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const type = searchParams.get('type');

        if (!id || !type || !['recommend', 'complain'].includes(type)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

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
    } catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

### Constraints
- The only change is adding the `getServerUser` import and the 4-line auth check after `try {`.
- All existing parameter validation, Supabase queries, and response shapes are **unchanged**.
- The `supabaseAdmin` client at the top (service role) is still needed for the actual data mutations.
- Do NOT add rate limiting here — that is a Sprint 2 task.
- Do NOT change the read-modify-write pattern to an RPC yet — that is BUG-01, a Sprint 2 task.

### Impact on Frontend
- The consumer app's voting buttons will now require the user to be logged in.
- If the frontend currently calls this endpoint for anonymous users, those calls will now receive a `401` response.
- The frontend should handle this 401 by showing a "please log in to vote" message. **This is expected behavior — do NOT remove the auth check to fix this.** If the frontend currently allows anonymous voting, the frontend needs updating (Sprint 2 BUG-04).

---

## TASK 5: Authenticate Consumer Logs Route

**File:** [src/app/api/consumer/logs/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/consumer/logs/route.js)
**Current state:** 44 lines. No authentication. Anyone can insert arbitrary review logs.

### What to Change

Same pattern as TASK 4: add auth check.

### Exact Replacement — Full File

Replace the ENTIRE file with:

```javascript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/serverAuth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    try {
        // ✅ SEC FIX: Require authenticated user
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const body = await req.json();
        const { business_id, interaction_type, reason_text } = body;

        if (!business_id || !interaction_type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!['recommend', 'complain'].includes(interaction_type)) {
            return NextResponse.json({ error: 'Invalid interaction type' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('consumer_logs')
            .insert({
                business_id,
                interaction_type,
                reason_text: reason_text || null,
                source: 'storefront_inline'
            })
            .select()
            .single();

        if (error) {
            console.error('Error inserting log:', error);
            return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

### Constraints
- ONLY change: added `getServerUser` import + 4-line auth guard.
- Every other line is identical to the current file.
- Do NOT change the insert query, the table name, or the response format.

---

## TASK 6: SEC-03 — Fix Trial Claim Identity Spoofing

**File:** [src/app/api/merchant/trial/claim/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/merchant/trial/claim/route.js)
**Current state:** 151 lines. Takes `userId` from the request body (`const { businessId, campaignId, userId } = body`). Attackers can spoof any user's ID.

### What to Change

1. Import `getServerUser` from TASK 1.
2. Extract `userId` from the authenticated session, not the request body.
3. Remove `userId` from destructured body parameters.
4. Adjust the `if (!businessId || !campaignId || !userId)` validation.

### Exact Changes (Line-by-Line)

**Change 1 — Add import (after line 2):**

Find:
```javascript
import { NextResponse } from 'next/server';
```

Replace with:
```javascript
import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/serverAuth';
```

**Change 2 — Replace lines 4-11:**

Find:
```javascript
export async function POST(req) {
    try {
        const body = await req.json();
        const { businessId, campaignId, userId } = body;

        if (!businessId || !campaignId || !userId) {
            return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
        }
```

Replace with:
```javascript
export async function POST(req) {
    try {
        // ✅ SEC-03 FIX: Extract userId from authenticated session, NOT request body
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
        }
        const userId = user.id;

        const body = await req.json();
        const { businessId, campaignId } = body;

        if (!businessId || !campaignId) {
            return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
        }
```

### Constraints
- Lines 13 onward (the Supabase admin client creation, business ownership check, campaign logic, redemption logic) must remain **exactly as they are**.
- The existing `business.claimed_by !== userId` check on line 38 now uses the session-derived `userId`, which is trustworthy.
- Do NOT change any of the subscription/addon logic below line 12.
- Do NOT change the response format or status codes for any of the existing error cases.
- Do NOT remove the `userId` occurrences later in the file (lines 36-38, 70, 87, 93, 96, 105, 124-134). These all reference the local variable `userId` which is now set from `user.id`.

### Impact on Frontend
- The merchant portal currently sends `userId` in the request body. After this change, the body parameter is **ignored** — the server uses the session. The frontend can continue to send it (it will be harmlessly ignored) or remove it — either way works.

---

## TASK 7: SEC-02 — Fix SSRF in Catalog Feed Parser

**File:** [src/app/api/merchant/parse-catalog-feed/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/merchant/parse-catalog-feed/route.js)
**Current state:** 88 lines. Accepts a user-supplied URL and fetches it directly with `fetch(url)`. No auth, no URL validation.

### What to Change

1. Add authentication (merchant session required).
2. Add a URL validation function that blocks private/internal IPs.
3. Prevent redirect-based SSRF by setting `redirect: 'error'`.

### Exact Replacement — Full File

Replace the ENTIRE file with:

```javascript
import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/serverAuth';

/**
 * ✅ SEC-02 FIX: SSRF Protection — blocks private, reserved, and internal IPs.
 * Returns true if the URL is unsafe to fetch.
 */
function isBlockedUrl(urlString) {
    try {
        const parsed = new URL(urlString);

        // Only allow http and https schemes
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return true;
        }

        const hostname = parsed.hostname.toLowerCase();

        // Block private/internal hostnames and IP ranges
        const blockedPatterns = [
            /^localhost$/,
            /^127\.\d+\.\d+\.\d+$/,
            /^10\.\d+\.\d+\.\d+$/,
            /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
            /^192\.168\.\d+\.\d+$/,
            /^169\.254\.\d+\.\d+$/,
            /^0\.\d+\.\d+\.\d+$/,
            /^\[::1\]$/,
            /^\[fc/,
            /^\[fd/,
            /^\[fe80:/,
            /\.internal$/,
            /\.local$/,
            /\.localhost$/,
            /^metadata\.google\.internal$/,
        ];

        return blockedPatterns.some(pattern => pattern.test(hostname));
    } catch {
        return true; // Invalid URL → block
    }
}

export async function POST(req) {
    try {
        // ✅ SEC-02 FIX: Require authenticated merchant session
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { url } = await req.json();
        if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

        // ✅ SEC-02 FIX: Block private/internal URLs
        if (isBlockedUrl(url)) {
            return NextResponse.json(
                { error: 'URL points to a restricted or invalid address' },
                { status: 403 }
            );
        }

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Tagdeer-Bot/1.0' },
            signal: AbortSignal.timeout(15000),
            redirect: 'error', // ✅ SEC-02 FIX: Prevent redirect-based SSRF
        });

        if (!response.ok) {
            return NextResponse.json({ error: `Failed to fetch feed: ${response.status}` }, { status: 502 });
        }

        const text = await response.text();
        const contentType = response.headers.get('content-type') || '';

        let products = [];

        if (contentType.includes('xml') || text.trim().startsWith('<?xml') || text.trim().startsWith('<')) {
            // XML parsing (Google Merchant Center / RSS / Atom feeds)
            const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/gi;
            let match;
            while ((match = itemRegex.exec(text)) !== null) {
                const block = match[1] || match[2];
                const get = (tag) => {
                    const m = block.match(new RegExp(`<(?:g:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:g:)?${tag}>`, 'i'));
                    return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
                };
                products.push({
                    name: get('title'),
                    description: get('description').replace(/<[^>]+>/g, '').slice(0, 500),
                    price: parseFloat(get('price') || get('sale_price') || '0'),
                    category: get('product_type') || get('category') || 'General',
                    image_url: get('image_link') || get('image'),
                    sku: get('id') || get('sku') || get('mpn'),
                });
            }
        } else if (contentType.includes('json') || text.trim().startsWith('[') || text.trim().startsWith('{')) {
            // JSON parsing (Shopify, WooCommerce, custom APIs)
            const json = JSON.parse(text);
            const items = Array.isArray(json) ? json : (json.products || json.items || json.data || []);
            products = items.map(item => ({
                name: item.name || item.title || '',
                description: (item.description || item.body_html || '').replace(/<[^>]+>/g, '').slice(0, 500),
                price: parseFloat(item.price || item.variants?.[0]?.price || '0'),
                category: item.category || item.product_type || 'General',
                image_url: item.image_url || item.image?.src || item.images?.[0]?.src || '',
                sku: item.sku || item.id?.toString() || '',
            }));
        } else {
            // CSV/TSV fallback
            const delimiter = text.includes('\t') ? '\t' : ',';
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) {
                return NextResponse.json({ error: 'Feed appears empty or unrecognized format' }, { status: 400 });
            }
            const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
            products = lines.slice(1).map(line => {
                const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
                const obj = {};
                headers.forEach((h, i) => { obj[h] = values[i] || ''; });
                return {
                    name: obj.name || obj.title || obj.product_name || '',
                    description: (obj.description || obj.desc || '').slice(0, 500),
                    price: parseFloat(obj.price || obj.amount || '0'),
                    category: obj.category || obj.type || 'General',
                    image_url: obj.image_url || obj.image || obj.photo || '',
                    sku: obj.sku || obj.id || '',
                };
            });
        }

        products = products.filter(p => p.name);

        return NextResponse.json({
            products: products.slice(0, 200), // Cap at 200 products per import
            count: products.length,
            format: contentType.includes('xml') ? 'xml' : contentType.includes('json') ? 'json' : 'csv',
        });
    } catch (err) {
        console.error('Feed parse error:', err);
        return NextResponse.json({ error: err.message || 'Failed to parse feed' }, { status: 500 });
    }
}
```

### Constraints
- The XML/JSON/CSV parsing logic is **byte-for-byte identical** to the original file.
- The response shape (`{ products, count, format }`) is unchanged.
- The 200-product cap is unchanged.
- The `AbortSignal.timeout(15000)` timeout is unchanged.
- Do NOT remove the `User-Agent` header.
- The `redirect: 'error'` option will cause the `fetch` to throw a `TypeError` for any 3xx redirects. This is caught by the outer `try/catch` and returns a 500 with the error message. This is acceptable.

---

## TASK 8: Add Admin Auth to Subscriptions Routes

Two files are affected. Both currently have **ZERO authentication** — any user who knows the URL can grant or revoke subscriptions.

### File A: [src/app/api/admin/subscriptions/grant/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/admin/subscriptions/grant/route.js)

**Current state:** 72 lines. No cookie check, no role verification.

#### Exact Changes

**Change 1 — Add import (after line 2):**

Find:
```javascript
import { NextResponse } from 'next/server';
```

Replace with:
```javascript
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
```

**Change 2 — Add auth guard immediately inside POST function:**

Find:
```javascript
export async function POST(req) {
    try {
        const body = await req.json();
```

Replace with:
```javascript
export async function POST(req) {
    try {
        // ✅ SECURITY FIX: Require admin role
        const admin = await verifyAdmin();
        if (!admin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
```

#### Constraints
- Everything after `const body = await req.json();` stays **exactly the same**.
- Do NOT change the Supabase client instantiation or the subscription upsert logic.

---

### File B: [src/app/api/admin/subscriptions/revoke/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/admin/subscriptions/revoke/route.js)

**Current state:** 43 lines. No cookie check, no role verification.

#### Exact Changes

**Change 1 — Add import (after line 2):**

Find:
```javascript
import { NextResponse } from 'next/server';
```

Replace with:
```javascript
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
```

**Change 2 — Add auth guard immediately inside POST function:**

Find:
```javascript
export async function POST(req) {
    try {
        const body = await req.json();
```

Replace with:
```javascript
export async function POST(req) {
    try {
        // ✅ SECURITY FIX: Require admin role
        const admin = await verifyAdmin();
        if (!admin) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
```

#### Constraints
- Everything after `const body = await req.json();` stays **exactly the same**.
- Do NOT change the subscription delete or feature_allocations update logic.

---

## TASK 9: SEC-05 — Fix OTP Math.random()

**File:** [supabase/functions/whatsapp-otp-send/index.ts](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/whatsapp-otp-send/index.ts)
**Current state:** Line 30 uses `Math.random()` to generate a 6-digit OTP.

### What to Change

Replace the `Math.random()` OTP generation with `crypto.getRandomValues()`.

### Exact Change

**Find this (line 30):**
```typescript
        const code = String(Math.floor(100000 + Math.random() * 900000));
```

**Replace with:**
```typescript
        // ✅ SEC-05 FIX: Use cryptographic randomness instead of Math.random()
        const randomBuffer = new Uint32Array(1);
        crypto.getRandomValues(randomBuffer);
        const code = String(100000 + (randomBuffer[0] % 900000));
```

### Constraints
- This is a **3-line replacement** of 1 line. Do NOT change anything else in this file yet — TASK 10 and 11 will make additional changes to this same file.
- Do NOT import anything. `crypto.getRandomValues` is a Deno global — no import needed.
- The resulting code MUST still produce a 6-digit string (100000-999999). The formula `100000 + (randomBuffer[0] % 900000)` guarantees this because `Uint32Array` values are 0 to 4,294,967,295, and modulo 900000 gives 0-899999, +100000 gives 100000-999999.
- Do NOT change the `expiresAt` calculation on line 31.

---

## TASK 10: SEC-06 — Fix CORS Wildcard on Edge Functions

This affects **3 files** (two existing + one new).

### File A: Create `supabase/functions/_shared/cors.ts` [NEW FILE]

Create directory and file at: `/Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/_shared/cors.ts`

```typescript
/**
 * Shared CORS configuration for all Supabase Edge Functions.
 * Restricts Access-Control-Allow-Origin to known Tagdeer domains.
 */

const ALLOWED_ORIGINS: string[] = [
    'https://tagdeer.app',
    'https://www.tagdeer.app',
    'https://merchant.tagdeer.app',
    'https://admin.tagdeer.app',
    'https://staging.tagdeer.app',
    'https://merchant.staging.tagdeer.app',
    'https://admin.staging.tagdeer.app',
];

// Allow localhost during development
const DEV_ORIGINS: string[] = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://admin.localhost:3000',
    'http://merchant.localhost:3000',
];

export function getCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get('origin') || '';

    // Check production origins first, then dev origins
    const allAllowed = [...ALLOWED_ORIGINS, ...DEV_ORIGINS];
    const matchedOrigin = allAllowed.find(allowed => origin === allowed);

    return {
        'Access-Control-Allow-Origin': matchedOrigin || ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
    };
}
```

### Constraints for cors.ts
- The `Vary: Origin` header is **critical** — without it, CDNs may cache one origin's CORS headers and serve them to a different origin.
- If the request origin doesn't match any allowed origin, fall back to the first production origin. Do NOT return `*`.
- Keep `DEV_ORIGINS` in the same file. Do NOT use environment variable checks — edge function envs are set per-deployment.

---

### File B: Update [supabase/functions/whatsapp-otp-send/index.ts](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/whatsapp-otp-send/index.ts)

**Find this (lines 4-8):**
```typescript
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```

**Replace with:**
```typescript
import { getCorsHeaders } from "../_shared/cors.ts";
```

Then **every occurrence of `corsHeaders`** inside this file is reference-dependent on `req`. The `corsHeaders` variable is used in 5 places:
1. Line 13: `{ headers: corsHeaders }`
2. Line 22: `{ status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }`
3. Line 120: `{ status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }`
4. Line 126: `{ status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }`
5. Line 133: `{ status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }`

**You must add a `const corsHeaders = getCorsHeaders(req);` line inside the handler, right after the CORS import replaces the static const.**

**Find this (line 10):**
```typescript
serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
```

**Replace with:**
```typescript
serve(async (req) => {
    // ✅ SEC-06 FIX: Dynamic CORS based on request origin
    const corsHeaders = getCorsHeaders(req);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
```

### Constraints
- All 5 references to `corsHeaders` throughout the file now use the dynamic version. You do NOT need to change those lines because `corsHeaders` is still a `const` defined before they run.
- The `import` statement replaces lines 4-8 (the old static const). Make sure you delete those 5 lines and add the single import line.

---

### File C: Update [supabase/functions/whatsapp-otp-verify/index.ts](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/whatsapp-otp-verify/index.ts)

**Exact same pattern as File B.** 

**Find this (lines 4-8):**
```typescript
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```

**Replace with:**
```typescript
import { getCorsHeaders } from "../_shared/cors.ts";
```

**Find this (line 10):**
```typescript
serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
```

**Replace with:**
```typescript
serve(async (req) => {
    // ✅ SEC-06 FIX: Dynamic CORS based on request origin
    const corsHeaders = getCorsHeaders(req);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
```

### Constraints — Same as File B Above
- All existing `corsHeaders` references stay as-is.
- The `import` replaces the 5-line static `const` block.

---

## TASK 11: SEC-07 — Add Rate Limiting to OTP Endpoints

### Step 1: Create SQL Migration

Create a new migration file. Use the current date for the filename:

**File:** `supabase/migrations/20260311_otp_rate_limiting.sql`

```sql
-- ============================================================
-- OTP Rate Limiting
-- Prevents brute-force OTP verification and WhatsApp cost attacks.
-- ============================================================

-- Table to track OTP request rates per phone number
CREATE TABLE IF NOT EXISTS otp_rate_limits (
    phone TEXT NOT NULL,
    action TEXT NOT NULL,             -- 'send' or 'verify'
    attempt_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (phone, action)
);

-- Enable RLS (deny all by default — only service role should access this)
ALTER TABLE otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- RPC to check and increment rate limit
-- Returns TRUE if the request is allowed, FALSE if rate-limited.
CREATE OR REPLACE FUNCTION check_otp_rate_limit(
    p_phone TEXT,
    p_action TEXT,
    p_max_attempts INTEGER,
    p_window_minutes INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record otp_rate_limits%ROWTYPE;
BEGIN
    -- Delete expired windows for this phone+action
    DELETE FROM otp_rate_limits
    WHERE phone = p_phone
      AND action = p_action
      AND window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL;

    -- Check current window
    SELECT * INTO v_record
    FROM otp_rate_limits
    WHERE phone = p_phone AND action = p_action;

    IF v_record IS NULL THEN
        -- First attempt in this window — insert and allow
        INSERT INTO otp_rate_limits (phone, action, attempt_count, window_start)
        VALUES (p_phone, p_action, 1, NOW());
        RETURN TRUE;
    END IF;

    IF v_record.attempt_count >= p_max_attempts THEN
        -- Rate limit exceeded
        RETURN FALSE;
    END IF;

    -- Increment counter and allow
    UPDATE otp_rate_limits
    SET attempt_count = attempt_count + 1
    WHERE phone = p_phone AND action = p_action;

    RETURN TRUE;
END;
$$;
```

### Constraints for SQL
- The `PRIMARY KEY (phone, action)` ensures one row per phone per action type.
- RLS is enabled and there are **no policies** — this means only `service_role` can access the table. This is correct because only edge functions (which use service role) should touch this table.
- The `DELETE` at the top of the function cleans up only the specific phone+action window, not the entire table. Bulk cleanup can be added as a cron later if needed.

---

### Step 2: Add Rate Limiting to [whatsapp-otp-send/index.ts](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/whatsapp-otp-send/index.ts)

After TASK 9 and 10 changes, find this block (the phone validation block, approximately where lines 17-24 used to be):

**Find:**
```typescript
        const { phone } = await req.json();

        if (!phone || phone.length < 9) {
            return new Response(
                JSON.stringify({ error: "Invalid phone number" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Normalize phone: ensure it starts with +
        const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
```

**Replace with:**
```typescript
        const { phone } = await req.json();

        if (!phone || phone.length < 9) {
            return new Response(
                JSON.stringify({ error: "Invalid phone number" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Normalize phone: ensure it starts with +
        const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;

        // ✅ SEC-07 FIX: Rate limit — max 3 OTP sends per phone per 60 minutes
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing Supabase configuration");
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

        const { data: sendAllowed, error: rlError } = await supabaseAdmin.rpc(
            'check_otp_rate_limit',
            { p_phone: normalizedPhone, p_action: 'send', p_max_attempts: 3, p_window_minutes: 60 }
        );

        if (rlError || !sendAllowed) {
            return new Response(
                JSON.stringify({ error: "Too many OTP requests. Please try again later." }),
                { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
```

**Then delete the duplicate Supabase client creation that exists later in the file.** The original file creates `supabaseAdmin` around line 34-41. Since we now create it earlier (for rate limiting), **remove the duplicate creation** and keep only the one we just added above.

**Find and DELETE (the SECOND occurrence, approximately lines 33-41):**
```typescript
        // Store OTP in database
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseKey) {
            throw new Error("Missing Supabase configuration");
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
```

Replace those lines with just a comment:
```typescript
        // Store OTP in database (supabaseAdmin client created above for rate limiting)
```

### Constraints
- The Supabase client (`supabaseAdmin`) is now created earlier in the function. All subsequent uses of `supabaseAdmin` (OTP upsert, etc.) use the same instance.
- The rate limit check MUST happen BEFORE the OTP is generated and stored. If the user is rate-limited, we skip OTP generation entirely.
- HTTP 429 (Too Many Requests) is the correct status code.
- The rate limit thresholds are: **3 sends per phone per 60 minutes**. Do NOT change these without explicit approval.

---

### Step 3: Add Rate Limiting to [whatsapp-otp-verify/index.ts](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/whatsapp-otp-verify/index.ts)

After TASK 10 changes, find this block (the code validation block):

**Find:**
```typescript
        if (!phone || !code || code.length !== 6) {
            return new Response(
                JSON.stringify({ error: "Phone and 6-digit code are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
```

**Replace with:**
```typescript
        if (!phone || !code || code.length !== 6) {
            return new Response(
                JSON.stringify({ error: "Phone and 6-digit code are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // ✅ SEC-07 FIX: Rate limit — max 5 verify attempts per phone per 15 minutes
        const { data: verifyAllowed, error: rlError } = await supabaseAdmin.rpc(
            'check_otp_rate_limit',
            { p_phone: normalizedPhone, p_action: 'verify', p_max_attempts: 5, p_window_minutes: 15 }
        );

        if (rlError || !verifyAllowed) {
            return new Response(
                JSON.stringify({ error: "Too many verification attempts. Please try again later." }),
                { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }
```

### Constraints
- Rate limit check is AFTER `supabaseAdmin` creation, BEFORE the OTP database lookup.
- The thresholds are: **5 verifications per phone per 15 minutes**. Do NOT change.
- The existing OTP lookup logic (Step 1: Check OTP in database) stays exactly as-is.
- Do NOT change the profile creation logic later in the file.

---

## TASK 12: BUG-07 — Fix Permissions-Policy Blocking Camera

**File:** [next.config.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/next.config.js)
**Current state:** 18 lines. Line 11 blocks camera and geolocation entirely.

### Exact Change

**Find this (line 11):**
```javascript
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
```

**Replace with:**
```javascript
                { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
```

### Constraints
- [(self)](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/admin/claims/route.js#6-74) allows camera and geolocation for the **same origin** only.
- `microphone=()` remains blocked — the app has no microphone features.
- Do NOT add any other headers.
- Do NOT change the `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` headers.

---

## TASK 13: Create .env.example

**File:** `.env.example` (project root)
**Purpose:** Enable new developer onboarding without guessing variable names.

### Exact File Contents

Create the file at: `/Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/.env.example`

```bash
# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# === Domain (optional — defaults to tagdeer.app) ===
NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000

# === Cloudflare R2 (for document/image uploads) ===
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-r2-public-url

# === Meta WhatsApp API (for OTP) ===
META_ACCESS_TOKEN=your-meta-access-token
META_PHONE_NUMBER_ID=your-meta-phone-number-id
META_TEMPLATE_NAME=tagdeer_otp
META_TEMPLATE_LANG=ar

# === Resend (email) ===
RESEND_API_KEY=your-resend-api-key

# === Sentry (optional — for error tracking) ===
NEXT_PUBLIC_SENTRY_DSN=
```

### Constraints
- Use placeholder values, never real credentials.
- Keep the variable names **exactly as they appear in the codebase** (grep for `process.env.` and `Deno.env.get` to verify).
- The `META_TEMPLATE_NAME` and `META_TEMPLATE_LANG` have sensible defaults shown.

---

## Verification Plan

### Automated Verification

After ALL tasks are complete, run these commands to verify nothing is broken:

```bash
# 1. Build test — ensures no import errors or syntax issues
cd /Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom
npm run build

# 2. Lint check
npm run lint

# 3. Existing tests (if any pass currently)
npm run test
```

> [!IMPORTANT]
> The `npm run build` is the most critical check. If it passes, all imports resolve correctly and the TypeScript/JSX compilation succeeds.

### Manual Verification Checklist

After deploying to staging, test each endpoint:

#### Test SEC-01 (Business Stats Auth)
```bash
# Should return 401 (no auth cookie):
curl -X POST "https://staging.tagdeer.app/api/consumer/business-stats?id=ANY_UUID&type=recommend"
# Expected: {"error":"Authentication required"}
```

#### Test SEC-02 (SSRF Block)
```bash
# Should return 403 (blocked URL):
curl -X POST "https://merchant.staging.tagdeer.app/api/merchant/parse-catalog-feed" \
  -H "Content-Type: application/json" \
  -H "Cookie: <valid_merchant_session_cookie>" \
  -d '{"url":"http://169.254.169.254/latest/meta-data/"}'
# Expected: {"error":"URL points to a restricted or invalid address"}

# Should return 401 (no auth):
curl -X POST "https://merchant.staging.tagdeer.app/api/merchant/parse-catalog-feed" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/feed.xml"}'
# Expected: {"error":"Authentication required"}
```

#### Test SEC-03 (Trial Claim)
```bash
# Should use session userId, not body userId.
# Login as Merchant A, try to claim for Merchant B's business — should get 403.
```

#### Test SEC-04 (No Hardcoded Key)
```bash
# Verify no fallback key in source:
grep -n "eyJhbGciOiJIUzI1NiIs" src/lib/supabaseClient.js
# Expected: No output (zero matches)
```

#### Test SEC-06 (CORS)
```bash
# Should return the request origin (if allowed):
curl -X OPTIONS "https://<supabase-project>.supabase.co/functions/v1/whatsapp-otp-send" \
  -H "Origin: https://tagdeer.app" -v 2>&1 | grep "Access-Control-Allow-Origin"
# Expected: Access-Control-Allow-Origin: https://tagdeer.app

# Should NOT return * :
curl -X OPTIONS "https://<supabase-project>.supabase.co/functions/v1/whatsapp-otp-send" \
  -H "Origin: https://evil-site.com" -v 2>&1 | grep "Access-Control-Allow-Origin"
# Expected: Access-Control-Allow-Origin: https://tagdeer.app (fallback, NOT *)
```

#### Test SEC-07 (Rate Limiting)
```bash
# Apply the migration to staging:
supabase db push --linked

# Send 4 OTPs to the same number in rapid succession — the 4th should return 429.
```

#### Test BUG-07 (Camera)
```bash
# Verify the header:
curl -s -D - "https://merchant.staging.tagdeer.app/" -o /dev/null | grep "Permissions-Policy"
# Expected: Permissions-Policy: camera=(self), microphone=(), geolocation=(self)
```

#### Test Admin Auth (Subscriptions)
```bash
# Should return 401 (no admin cookie):
curl -X POST "https://admin.staging.tagdeer.app/api/admin/subscriptions/grant" \
  -H "Content-Type: application/json" \
  -d '{"profileId":"any","tier":"Pro","months":1}'
# Expected: {"success":false,"error":"Unauthorized"}
```

> [!CAUTION]
> After these tests pass on staging, request the team lead to do a final review of the PR before merging to production.
