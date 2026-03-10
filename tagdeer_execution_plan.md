# 🦌 Tagdeer Platform — Prioritized Execution Plan & Comprehensive Solutions

**Date:** 2026-03-10
**Based on:** [tagdeer_platform_full_analysis.md](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/tagdeer_platform_full_analysis.md) (commit `505485a`)
**Scope:** 7 security vulnerabilities, 7 bugs, architectural concerns, code smells, missing features

---

## Table of Contents

1. [Phase 1: Prioritized Execution Roadmap](#phase-1-prioritized-execution-roadmap)
2. [Phase 2: Comprehensive Solutions](#phase-2-comprehensive-solutions)
   - [Sprint 1 — Critical Security (Week 1-2)](#sprint-1--critical-security-week-1-2)
   - [Sprint 2 — Bug Fixes & Stability (Week 3-4)](#sprint-2--bug-fixes--stability-week-3-4)
   - [Sprint 3 — Architecture & Scalability (Week 5-6)](#sprint-3--architecture--scalability-week-5-6)
   - [Sprint 4 — Polish & Missing Features (Week 7-8+)](#sprint-4--polish--missing-features-week-78)

---

## Phase 1: Prioritized Execution Roadmap

```mermaid
gantt
    title Tagdeer Remediation Roadmap
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Sprint 1: Security
    SEC-01 Unauthenticated Stats     :crit, s1a, 2026-03-11, 1d
    SEC-03 Trial Claim Spoofing      :crit, s1b, 2026-03-11, 1d
    SEC-04 Hardcoded Supabase Key    :crit, s1c, 2026-03-12, 1d
    SEC-05 OTP Math.random           :crit, s1d, 2026-03-12, 1d
    SEC-06 CORS Wildcard             :crit, s1e, 2026-03-13, 1d
    SEC-02 SSRF Catalog Feed         :crit, s1f, 2026-03-13, 2d
    SEC-07 OTP Rate Limiting         :crit, s1g, 2026-03-15, 2d
    Auth middleware hardening        :crit, s1h, 2026-03-17, 2d
    BUG-07 Permissions-Policy        :s1i, 2026-03-19, 1d

    section Sprint 2: Bugs & Stability
    BUG-01 Gader Points Race         :s2a, 2026-03-20, 1d
    BUG-03 Profiles FK Mismatch     :s2b, 2026-03-20, 2d
    BUG-04 Anonymous Limit Bypass    :s2c, 2026-03-22, 2d
    BUG-02 Content Filter            :s2d, 2026-03-24, 1d
    BUG-05 Coupon Cron N+1           :s2e, 2026-03-25, 1d
    BUG-06 set-password setTimeout   :s2f, 2026-03-26, 1d
    Coupon Serial Collision          :s2g, 2026-03-27, 1d

    section Sprint 3: Architecture
    Context Refactor                 :s3a, 2026-03-28, 3d
    Business Listing Pagination      :s3b, 2026-03-31, 2d
    Consumer SSR/SEO                 :s3c, 2026-04-02, 3d
    Migration Squash + CI            :s3d, 2026-04-05, 2d
    Cleanup Root Test Files          :s3e, 2026-04-07, 1d

    section Sprint 4: Polish
    Supabase Connection Pooling      :s4a, 2026-04-08, 1d
    Error Tracking (Sentry)          :s4b, 2026-04-09, 2d
    Content Moderation Pipeline      :s4c, 2026-04-11, 3d
    License + README Update          :s4d, 2026-04-14, 1d
```

### Priority Tiers

| Priority | ID | Issue | Risk | Effort |
|---|---|---|---|---|
| 🔴 P0 | SEC-01 | Unauthenticated business stats manipulation | Data integrity destruction | ⚡ 1-2h |
| 🔴 P0 | SEC-03 | Trial claim identity spoofing | Financial fraud | ⚡ 1-2h |
| 🔴 P0 | SEC-04 | Hardcoded Supabase anon key in source | Blocks key rotation, credential leak | ⚡ 30min |
| 🔴 P0 | SEC-05 | OTP uses `Math.random()` | Predictable OTP codes | ⚡ 30min |
| 🔴 P0 | SEC-06 | CORS wildcard on Edge Functions | Cross-origin OTP abuse | ⚡ 30min |
| 🔴 P0 | SEC-02 | SSRF in catalog feed parser | Internal network exposure | 🔧 2-3h |
| 🔴 P0 | SEC-07 | No rate limiting on OTP | Brute-force + WhatsApp cost attack | 🔧 3-4h |
| 🟡 P1 | BUG-07 | Permissions-Policy blocks camera | Merchant QR scanning broken | ⚡ 15min |
| 🟡 P1 | BUG-01 | Race condition in Gader points | Incorrect point balances | 🔧 1-2h |
| 🟡 P1 | BUG-03 | Profiles without auth.users FK | Profile insert failures | 🔧 2-3h |
| 🟡 P1 | BUG-04 | Anonymous vote limit bypass | Score manipulation | 🔧 2-3h |
| 🟡 P1 | BUG-02 | Content filter false positives | Legitimate reviews blocked | 🔧 1-2h |
| 🟡 P1 | BUG-05 | Coupon cron N+1 queries | DB overload at scale | 🔧 1-2h |
| 🟡 P1 | BUG-06 | set-password `setTimeout(1000)` race | Password setup failures | 🔧 1h |
| 🟡 P1 | — | Coupon serial collision risk | Duplicate coupons | 🔧 1h |
| 🟢 P2 | ARCH-01 | TagdeerContext God Component (702 lines) | Developer velocity | 🏗️ 4-6h |
| 🟢 P2 | ARCH-02 | No business listing pagination | Page crash at ~500 businesses | 🏗️ 3-4h |
| 🟢 P2 | ARCH-03 | No SSR/SEO for consumer pages | Zero organic search traffic | 🏗️ 6-8h |
| 🟢 P2 | ARCH-04 | 58 unsquashed migrations | Contributor onboarding pain | 🏗️ 2-3h |
| ⚪ P3 | INFRA-01 | No connection pooling | Connection exhaustion | ⚡ 30min |
| ⚪ P3 | INFRA-02 | No error tracking | Blind to prod issues | 🏗️ 2-3h |
| ⚪ P3 | INFRA-03 | Root test file sprawl (20+ files) | Technical debt | ⚡ 30min |
| ⚪ P3 | INFRA-04 | MIT license on commercial SaaS | Competitor forking risk | ⚡ 30min |
| ⚪ P3 | INFRA-05 | README documents Vite, app uses Next.js | Team misalignment | ⚡ 30min |

---

## Phase 2: Comprehensive Solutions

---

### Sprint 1 — Critical Security (Week 1-2)

---

#### SEC-01: Unauthenticated Business Stats Manipulation

**Root Cause:**
[business-stats/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/consumer/business-stats/route.js) accepts POST requests with no authentication. It uses the **service role key** to directly increment `recommends`/`complains` counters. Any HTTP client can inflate or deflate any business's score.

**Proposed Fix:**
1. Require a valid Supabase session (via `Authorization` header or cookie)
2. Log the `user_id` against each vote to prevent duplicate votes
3. Use atomic increment via RPC rather than read-modify-write

```javascript
// src/app/api/consumer/business-stats/route.js — FIXED

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: extract authenticated user from server session
async function getAuthUser(req) {
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
}

export async function POST(req) {
    try {
        // ✅ AUTHENTICATION: Extract user from server session
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const type = searchParams.get('type');

        if (!id || !type || !['recommend', 'complain'].includes(type)) {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        // ✅ DUPLICATE CHECK: Prevent the same user from voting twice
        const { data: existingVote } = await supabaseAdmin
            .from('logs')
            .select('id')
            .eq('profile_id', user.id)
            .eq('business_id', id)
            .eq('interaction_type', type)
            .maybeSingle();

        if (existingVote) {
            return NextResponse.json(
                { error: 'You have already voted on this business' },
                { status: 409 }
            );
        }

        // ✅ ATOMIC INCREMENT via RPC (instead of read-modify-write)
        const column = type === 'recommend' ? 'recommends' : 'complains';
        const { error: rpcError } = await supabaseAdmin.rpc('increment_business_stat', {
            p_business_id: id,
            p_column: column,
        });

        if (rpcError) {
            console.error('RPC error:', rpcError);
            return NextResponse.json({ error: 'Failed to update stats' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
```

**Required Database Migration:**

```sql
-- New RPC for atomic stat increment
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
        RAISE EXCEPTION 'Invalid column: %', p_column;
    END IF;
END;
$$;
```

---

#### SEC-02: SSRF in Catalog Feed Parser

**Root Cause:**
[parse-catalog-feed/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/merchant/parse-catalog-feed/route.js) accepts a user-supplied URL and fetches it directly with no validation. An attacker can:
- Access internal network resources (`http://169.254.169.254/` for cloud metadata)
- Scan internal ports
- Use the server as an open proxy
- Additionally, there is no authentication on this endpoint

**Proposed Fix:**
1. Add session-based authentication (merchant-only)
2. Validate URL against an allowlist of schemes and block private IP ranges
3. Resolve the hostname and block any private/reserved IP

```javascript
// src/app/api/merchant/parse-catalog-feed/route.js — FIXED (security portion)

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// ✅ SSRF Protection: Block private/reserved IP ranges
function isPrivateUrl(urlString) {
    try {
        const parsed = new URL(urlString);

        // Only allow http/https
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return true;
        }

        const hostname = parsed.hostname;

        // Block obvious private patterns
        const privatePatterns = [
            /^localhost$/i,
            /^127\./,
            /^10\./,
            /^172\.(1[6-9]|2\d|3[01])\./,
            /^192\.168\./,
            /^169\.254\./,         // Link-local / cloud metadata
            /^0\./,
            /^\[::1\]$/,           // IPv6 loopback
            /^\[fc/i,              // IPv6 private
            /^\[fd/i,              // IPv6 private
            /^\[fe80:/i,           // IPv6 link-local
            /\.internal$/i,
            /\.local$/i,
            /\.localhost$/i,
        ];

        return privatePatterns.some(pattern => pattern.test(hostname));
    } catch {
        return true; // Invalid URL → block
    }
}

export async function POST(req) {
    // ✅ AUTHENTICATION: Merchant session required
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { cookies: { getAll: () => cookieStore.getAll() } }
    );
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    try {
        const { url } = await req.json();
        if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

        // ✅ SSRF CHECK
        if (isPrivateUrl(url)) {
            return NextResponse.json(
                { error: 'URL points to a restricted address' },
                { status: 403 }
            );
        }

        // ... existing feed parsing logic remains unchanged ...

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Tagdeer-Bot/1.0' },
            signal: AbortSignal.timeout(10000), // Reduced from 15s to 10s
            redirect: 'error', // ✅ Prevent redirect-based SSRF
        });

        // ... rest of parsing ...
    } catch (err) {
        console.error('Feed parse error:', err);
        return NextResponse.json({ error: err.message || 'Failed to parse feed' }, { status: 500 });
    }
}
```

---

#### SEC-03: Trial Claim Identity Spoofing

**Root Cause:**
[trial/claim/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/merchant/trial/claim/route.js) takes `userId` directly from the request body (`const { businessId, campaignId, userId } = body`). Any attacker can substitute any user's ID — the "ownership check" (`business.claimed_by !== userId`) passes because the attacker controls both the spoofed `userId` and knows which businesses to target.

**Proposed Fix:**
Extract `userId` from the authenticated server session, never from the request body.

```diff
// src/app/api/merchant/trial/claim/route.js

 import { createClient } from '@supabase/supabase-js';
+import { createServerClient } from '@supabase/ssr';
+import { cookies } from 'next/headers';
 import { NextResponse } from 'next/server';

 export async function POST(req) {
     try {
-        const body = await req.json();
-        const { businessId, campaignId, userId } = body;
+        // ✅ Extract userId from authenticated session
+        const cookieStore = await cookies();
+        const supabaseAuth = createServerClient(
+            process.env.NEXT_PUBLIC_SUPABASE_URL,
+            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
+            { cookies: { getAll: () => cookieStore.getAll() } }
+        );
+        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
+        if (authError || !user) {
+            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
+        }
+        const userId = user.id;
+
+        const body = await req.json();
+        const { businessId, campaignId } = body;

-        if (!businessId || !campaignId || !userId) {
+        if (!businessId || !campaignId) {
             return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
         }
         // ... rest of logic (now userId is trustworthy) ...
```

> [!IMPORTANT]
> The same pattern must also be applied to any other API route that reads `userId` from the request body. Audit all routes in `src/app/api/` for this pattern.

---

#### SEC-04: Hardcoded Supabase Anon Key

**Root Cause:**
[supabaseClient.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/lib/supabaseClient.js) line 4 has a real JWT token as a fallback:
```javascript
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIs...';
```
This means the key is in Git history forever, key rotation requires a code deploy, and local dev works without `.env` (masking misconfiguration).

**Proposed Fix:**

```javascript
// src/lib/supabaseClient.js — FIXED

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ✅ Fail fast if env vars are missing (instead of silently using hardcoded key)
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
    );
}

let supabaseInstance;

if (typeof window !== 'undefined') {
    if (!window.tagdeer_supabase) {
        window.tagdeer_supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storageKey: 'tagdeer-auth-v1',
                broadcast: false,
            }
        });
    }
    supabaseInstance = window.tagdeer_supabase;
} else {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseInstance;
```

**Additional steps:**
1. Create `.env.example` file with placeholder values
2. Rotate the exposed Supabase anon key in the Supabase dashboard
3. Add `.env*` to `.gitignore` (verify it's already there)
4. Consider using `git filter-branch` or BFG Repo-Cleaner to remove the key from Git history

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
META_ACCESS_TOKEN=your-meta-token
META_PHONE_NUMBER_ID=your-phone-number-id
```

---

#### SEC-05: OTP Uses `Math.random()`

**Root Cause:**
[whatsapp-otp-send/index.ts](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/whatsapp-otp-send/index.ts) line 30:
```typescript
const code = String(Math.floor(100000 + Math.random() * 900000));
```
`Math.random()` uses a non-cryptographic PRNG. If an attacker knows the approximate time the OTP was generated, they can narrow the possible codes significantly.

**Proposed Fix:**

```diff
// supabase/functions/whatsapp-otp-send/index.ts

-        // Generate 6-digit OTP
-        const code = String(Math.floor(100000 + Math.random() * 900000));
+        // ✅ Generate 6-digit OTP using cryptographic randomness
+        const array = new Uint32Array(1);
+        crypto.getRandomValues(array);
+        const code = String(100000 + (array[0] % 900000));
```

> [!NOTE]
> Deno has native `crypto.getRandomValues()` support — no additional imports needed.

---

#### SEC-06: CORS Wildcard on Edge Functions

**Root Cause:**
Both [whatsapp-otp-send/index.ts](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/whatsapp-otp-send/index.ts) and [whatsapp-otp-verify/index.ts](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/whatsapp-otp-verify/index.ts) use `Access-Control-Allow-Origin: *`. This allows **any website** to call the OTP endpoints — enabling cross-site OTP abuse.

**Proposed Fix:**
Create a shared CORS utility and restrict origins:

```typescript
// supabase/functions/_shared/cors.ts

const ALLOWED_ORIGINS = [
    'https://tagdeer.app',
    'https://merchant.tagdeer.app',
    'https://admin.tagdeer.app',
];

// Allow localhost in development
if (Deno.env.get('ENVIRONMENT') !== 'production') {
    ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:3001');
}

export function getCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get('origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
    };
}
```

Then in each edge function:

```diff
-const corsHeaders = {
-    "Access-Control-Allow-Origin": "*",
-    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
-    "Access-Control-Allow-Methods": "POST, OPTIONS",
-};
+import { getCorsHeaders } from "../_shared/cors.ts";

 serve(async (req) => {
+    const corsHeaders = getCorsHeaders(req);
     if (req.method === "OPTIONS") {
         return new Response("ok", { headers: corsHeaders });
     }
```

---

#### SEC-07: No Rate Limiting on OTP Endpoints

**Root Cause:**
There is no rate limiting on OTP send or verify. Attackers can:
1. **Brute-force 6-digit OTPs** — only 900,000 combinations
2. **Spam WhatsApp messages** — each OTP costs money via Meta API
3. **Denial of Service** — flood the `otp_verifications` table

**Proposed Fix:**
Implement rate limiting using the Supabase database as the state store (since edge functions are stateless).

**Database migration for rate limiting:**

```sql
-- Rate limiting table for OTP
CREATE TABLE IF NOT EXISTS otp_rate_limits (
    phone TEXT NOT NULL,
    action TEXT NOT NULL,           -- 'send' or 'verify'
    attempt_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (phone, action)
);

-- Function to check and increment rate limit
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
    -- Clean expired windows first
    DELETE FROM otp_rate_limits
    WHERE window_start < NOW() - (p_window_minutes || ' minutes')::INTERVAL;

    -- Check current window
    SELECT * INTO v_record
    FROM otp_rate_limits
    WHERE phone = p_phone AND action = p_action;

    IF v_record IS NULL THEN
        -- First attempt in this window
        INSERT INTO otp_rate_limits (phone, action, attempt_count, window_start)
        VALUES (p_phone, p_action, 1, NOW());
        RETURN TRUE; -- allowed
    END IF;

    IF v_record.attempt_count >= p_max_attempts THEN
        RETURN FALSE; -- rate limited
    END IF;

    -- Increment counter
    UPDATE otp_rate_limits
    SET attempt_count = attempt_count + 1
    WHERE phone = p_phone AND action = p_action;

    RETURN TRUE; -- allowed
END;
$$;
```

**Edge function integration:**

```typescript
// In whatsapp-otp-send/index.ts — add before sending OTP:

// ✅ Rate limit: max 3 OTP sends per phone per hour
const { data: allowed, error: rlError } = await supabaseAdmin.rpc(
    'check_otp_rate_limit',
    { p_phone: normalizedPhone, p_action: 'send', p_max_attempts: 3, p_window_minutes: 60 }
);

if (rlError || !allowed) {
    return new Response(
        JSON.stringify({ error: "Too many OTP requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
}
```

```typescript
// In whatsapp-otp-verify/index.ts — add before checking OTP:

// ✅ Rate limit: max 5 verify attempts per phone per 15 minutes
const { data: allowed } = await supabaseAdmin.rpc(
    'check_otp_rate_limit',
    { p_phone: normalizedPhone, p_action: 'verify', p_max_attempts: 5, p_window_minutes: 15 }
);

if (!allowed) {
    return new Response(
        JSON.stringify({ error: "Too many verification attempts. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
}
```

---

#### Auth Middleware Hardening

**Root Cause (from Senior Next.js Developer analysis):**
1. Admin auth checks if a cookie value `!== 'true'` — trivially spoofable
2. Merchant auth checks for _any_ cookie starting with `sb-` — doesn't validate the token
3. No CSRF protection

**Proposed Fix:**
Create a shared server-side auth utility:

```javascript
// src/lib/serverAuth.js — NEW FILE

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side auth utility. Returns the authenticated user
 * from the Supabase session cookie, or null.
 */
export async function getServerUser() {
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
}

/**
 * Get the user's profile (with role) from the database.
 */
export async function getServerUserWithRole() {
    const user = await getServerUser();
    if (!user) return null;

    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { cookies: { getAll: () => cookieStore.getAll() } }
    );

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    return { ...user, role: profile?.role || 'consumer' };
}
```

Then in API routes, replace cookie-sniffing with proper auth:

```javascript
// Example: any API route that needs auth

import { getServerUser } from '@/lib/serverAuth';

export async function POST(req) {
    const user = await getServerUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // user.id is now trustworthy
}
```

---

#### BUG-07: Permissions-Policy Blocks Camera

**Root Cause:**
[next.config.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/next.config.js) line 11 sets `camera=()` which completely blocks camera access. The merchant QR scanner (`html5-qrcode` dependency) requires camera.

**Proposed Fix:**

```diff
// next.config.js

-                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
+                { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
```

> [!NOTE]
> `(self)` allows the camera for same-origin requests. Since subdomains share the same origin at the Permissions-Policy level when served from the same Vercel deployment, the merchant QR scanner will work. Geolocation is also allowed for future "nearby businesses" features.

---

### Sprint 2 — Bug Fixes & Stability (Week 3-4)

---

#### BUG-01: Race Condition in Gader Points

**Root Cause:**
The client reads `user.gader`, adds 10, then writes back. Two concurrent votes both read the same value and write `+10`, losing one increment.

**Proposed Fix — Database RPC:**

```sql
-- Migration: create atomic increment RPC
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
    SET gader_points = COALESCE(gader_points, 0) + p_amount
    WHERE id = p_profile_id
    RETURNING gader_points INTO v_new_points;

    RETURN v_new_points;
END;
$$;
```

**Client-side change (in the voting logic):**

```javascript
// Instead of:
// await supabase.from('profiles').update({ gader_points: user.gader + 10 }).eq('id', user.id);

// Use:
const { data: newPoints, error } = await supabase.rpc('increment_gader_points', {
    p_profile_id: user.id,
    p_amount: 10,
});
if (!error) {
    setUser(prev => ({ ...prev, gader_points: newPoints }));
}
```

---

#### BUG-03: Profiles Without Auth Users (FK Violation)

**Root Cause:**
The [whatsapp-otp-verify/index.ts](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/whatsapp-otp-verify/index.ts) creates profiles via `INSERT` with a random UUID, but the `profiles.id` column has `REFERENCES auth.users(id)`. This means:
- The INSERT will **fail** because no corresponding `auth.users` row exists
- OR (if the FK was later removed) WhatsApp-only users have "orphan" profiles

**Proposed Fix:**
Create a Supabase Auth user during the OTP verification flow, then create the profile with that user's ID:

```typescript
// supabase/functions/whatsapp-otp-verify/index.ts — FIXED

// Step 3: Check/create auth user and profile
let isNewUser = false;
let { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("phone", normalizedPhone)
    .single();

if (profileErr && profileErr.code === "PGRST116") {
    // No profile found — create auth user FIRST, then profile
    isNewUser = true;

    // ✅ Create a real Supabase Auth user (phone-based)
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
    const randomAlphanumeric = crypto.getRandomValues(new Uint8Array(4))
        .reduce((acc, b) => acc + b.toString(36), '')
        .substring(0, 5)
        .toUpperCase();

    // ✅ Profile.id now matches auth.users.id
    const { data: newProfile, error: insertErr } = await supabaseAdmin
        .from("profiles")
        .insert([{
            id: authUserId,          // ← FK-safe
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
}
```

---

#### BUG-04: Anonymous Vote Limit Bypass

**Root Cause:**
The 3-vote limit for anonymous users is stored only in `localStorage`. Clearing storage, using incognito mode, or switching browsers resets it.

**Proposed Fix:**
Enforce limits server-side using IP + fingerprint hashing:

```sql
-- Migration: anonymous vote tracking
CREATE TABLE IF NOT EXISTS anonymous_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint_hash TEXT NOT NULL,
    ip_address INET,
    business_id UUID NOT NULL REFERENCES businesses(id),
    interaction_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anon_votes_fingerprint ON anonymous_votes(fingerprint_hash);
CREATE INDEX idx_anon_votes_ip ON anonymous_votes(ip_address);

-- Function to check anonymous vote limit
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

**API route integration (add to `business-stats`):**

```javascript
// For anonymous (unauthenticated) users, use IP + fingerprint
const forwarded = req.headers.get('x-forwarded-for');
const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
const fingerprint = req.headers.get('x-device-fingerprint') || '';

const { data: allowed } = await supabaseAdmin.rpc('check_anonymous_vote_limit', {
    p_fingerprint: fingerprint,
    p_ip: ip,
    p_max_votes: 3,
    p_window_days: 7,
});

if (!allowed) {
    return NextResponse.json(
        { error: 'Anonymous vote limit reached. Sign up for unlimited voting.' },
        { status: 429 }
    );
}
```

---

#### BUG-02: Content Filter False Positives

**Root Cause:**
[contentFilter.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/lib/contentFilter.js) uses `String.includes()` for substring matching. "classic" matches "ass", "therapist" matches "crap".

**Proposed Fix — Word-boundary regex for English, smarter Arabic matching:**

```javascript
// src/lib/contentFilter.js — FIXED

const ENGLISH_BAD_WORDS = [
    'spam', 'fake', 'scam', 'fraud', 'fuck', 'shit', 'bitch', 'asshole',
    'idiot', 'stupid', 'crap', 'bastard',
];

const ARABIC_BAD_WORDS = [
    'نصاب', 'سارق', 'كذاب', 'غشاش', 'تفو', 'كلب', 'حمار', 'زبالة',
    'محتال', 'سرقة', 'عنصري', 'شتم', 'سب',
];

// ✅ English: Use word boundaries to prevent substring false positives
const englishPattern = new RegExp(
    '\\b(' + ENGLISH_BAD_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
    'i'
);

// ✅ Arabic: Use spaces/punctuation as boundaries (Arabic doesn't use \b well)
// Arabic words are matched when preceded/followed by space, start/end, or punctuation
const arabicPattern = new RegExp(
    '(?:^|[\\s\\p{P}])(' + ARABIC_BAD_WORDS.join('|') + ')(?=[\\s\\p{P}]|$)',
    'u'
);

export const containsBadWords = (text) => {
    if (!text || typeof text !== 'string') return false;

    const normalizedText = text.toLowerCase();

    return englishPattern.test(normalizedText) || arabicPattern.test(text);
};
```

---

#### BUG-05: Coupon Expiry Cron N+1 Problem

**Root Cause:**
[coupon-expiry-cron/index.ts](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/supabase/functions/coupon-expiry-cron/index.ts) loops through each expired coupon and fires 2 individual queries per coupon.

**Proposed Fix — Single batch SQL operation:**

```sql
-- Migration: batch coupon expiry RPC
CREATE OR REPLACE FUNCTION expire_coupons_batch()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Batch update all expired coupons in one query
    WITH expired AS (
        UPDATE merchant_coupons
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
        RETURNING id, business_id
    )
    SELECT COUNT(*) INTO v_count FROM expired;

    -- Also refund wallet balances in bulk if needed
    -- (moved from individual RPC calls to a single UPDATE)
    UPDATE merchant_wallets mw
    SET reserved_balance = GREATEST(0, reserved_balance - mc.total_value)
    FROM (
        SELECT business_id, SUM(discount_value * remaining_uses) as total_value
        FROM merchant_coupons
        WHERE status = 'expired'
          AND updated_at > NOW() - INTERVAL '1 minute'
        GROUP BY business_id
    ) mc
    WHERE mw.business_id = mc.business_id;

    RETURN json_build_object('expired_count', v_count);
END;
$$;
```

**Simplified edge function:**

```typescript
// supabase/functions/coupon-expiry-cron/index.ts — SIMPLIFIED

const { data, error } = await supabaseAdmin.rpc('expire_coupons_batch');
// 1 query instead of 2000!
```

---

#### BUG-06: `set-password` setTimeout(1000) Race

**Root Cause:**
[set-password/route.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/app/api/merchant/set-password/route.js) line 69 uses `setTimeout(1000)` hoping the DB trigger creates the profile. Under load, this is unreliable.

**Proposed Fix — Poll with retry:**

```diff
// src/app/api/merchant/set-password/route.js

-            // Wait a moment for trigger to create the plain profile
-            await new Promise(resolve => setTimeout(resolve, 1000));
+            // ✅ Poll for profile creation with exponential backoff
+            let profileExists = false;
+            for (let attempt = 0; attempt < 5; attempt++) {
+                const { data: checkProfile } = await supabaseAdmin
+                    .from('profiles')
+                    .select('id')
+                    .eq('id', userId)
+                    .maybeSingle();
+                if (checkProfile) {
+                    profileExists = true;
+                    break;
+                }
+                await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt)));
+                // Waits: 200ms, 400ms, 800ms, 1600ms, 3200ms
+            }
+
+            // If trigger didn't create profile, create it explicitly
+            if (!profileExists) {
+                await supabaseAdmin.from('profiles').insert({
+                    id: userId,
+                    email: email.toLowerCase().trim(),
+                    role: 'merchant',
+                    has_password: true,
+                });
+            }
```

---

#### Coupon Serial Collision Fix

**Root Cause:**
[serialCodeGenerator.js](file:///Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom/src/lib/serialCodeGenerator.js) uses `Math.random()` and has no collision detection. Two concurrent requests could generate the same serial code.

**Proposed Fix:**

```javascript
// src/lib/serialCodeGenerator.js — FIXED

/**
 * Generates a cryptographically random coupon serial code.
 * Format: TAG-{PREFIX}-{RANDOM}
 */
export function generateCouponSerial(businessName, randomLength = 6) {
    if (!businessName) businessName = 'MER';

    const cleanName = businessName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    let prefix = cleanName.substring(0, 3);
    while (prefix.length < 3) prefix += 'X';

    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    // ✅ Use crypto-secure random
    let randomPart = '';
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const values = new Uint8Array(randomLength);
        crypto.getRandomValues(values);
        for (let i = 0; i < randomLength; i++) {
            randomPart += characters.charAt(values[i] % characters.length);
        }
    } else {
        // Server-side Node.js fallback
        const { randomInt } = require('crypto');
        for (let i = 0; i < randomLength; i++) {
            randomPart += characters.charAt(randomInt(0, characters.length));
        }
    }

    return `TAG-${prefix}-${randomPart}`;
}
```

> [!IMPORTANT]
> Additionally, add a `UNIQUE` constraint on the `serial_code` column in the `merchant_coupons` table and implement retry logic on collision:
> ```sql
> ALTER TABLE merchant_coupons ADD CONSTRAINT unique_serial_code UNIQUE (serial_code);
> ```

---

### Sprint 3 — Architecture & Scalability (Week 5-6)

---

#### ARCH-01: TagdeerContext God Component Refactor

**Root Cause:**
`TagdeerContext.jsx` is 702 lines mixing authentication, data fetching, UI state, and gamification into a single context provider. Changes to any one concern re-render the entire component tree.

**Proposed Refactoring Strategy:**

Split into 3 focused providers:

| Provider | Responsibility | Lines (est) |
|---|---|---|
| `AuthProvider` | Session management, user profile, login/logout | ~150 |
| `BusinessDataProvider` | Business fetching, filtering, search | ~200 |
| `UIProvider` | Sidebar state, theme, toast, viewport | ~80 |

```
src/context/
├── AuthProvider.jsx        ← session, user, role
├── BusinessDataProvider.jsx ← businesses, categories, logs
├── UIProvider.jsx           ← sidebar, theme, breakpoints
└── index.js                 ← re-exports all providers
```

**Example wrapper in layout:**

```jsx
// src/app/(consumer)/layout.jsx

import { AuthProvider } from '@/context/AuthProvider';
import { BusinessDataProvider } from '@/context/BusinessDataProvider';
import { UIProvider } from '@/context/UIProvider';

export default function ConsumerLayout({ children }) {
    return (
        <AuthProvider>
            <BusinessDataProvider>
                <UIProvider>
                    {children}
                </UIProvider>
            </BusinessDataProvider>
        </AuthProvider>
    );
}
```

---

#### ARCH-02: Business Listing Pagination

**Root Cause:**
The current `select *` fetches ALL businesses with ALL logs on every page load. At ~500 businesses, the page will crash.

**Proposed Fix — Cursor-based pagination:**

```sql
-- RPC for paginated business listings
CREATE OR REPLACE FUNCTION get_businesses_paginated(
    p_cursor TIMESTAMPTZ DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_city TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    city TEXT,
    category TEXT,
    recommends INTEGER,
    complains INTEGER,
    gader_index NUMERIC,
    profile_image TEXT,
    created_at TIMESTAMPTZ,
    has_more BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH filtered AS (
        SELECT b.*
        FROM businesses b
        WHERE (p_cursor IS NULL OR b.created_at < p_cursor)
          AND (p_city IS NULL OR b.city = p_city)
          AND (p_category IS NULL OR b.category = p_category)
          AND (p_search IS NULL OR b.name ILIKE '%' || p_search || '%')
        ORDER BY b.created_at DESC
        LIMIT p_limit + 1
    )
    SELECT
        f.id, f.name, f.city, f.category,
        f.recommends, f.complains, f.gader_index, f.profile_image,
        f.created_at,
        (COUNT(*) OVER() > p_limit) AS has_more
    FROM filtered f
    LIMIT p_limit;
END;
$$;
```

---

#### ARCH-03: Consumer SSR/SEO

**Root Cause:**
Consumer pages are fully client-rendered (`'use client'` everywhere), making them invisible to search engines. Google cannot index any businesses.

**Proposed Fix:**
Convert the consumer Discover page and individual business pages to React Server Components:

```jsx
// src/app/(consumer)/discover/page.jsx — Server Component (no 'use client')

import { createClient } from '@supabase/supabase-js';

export const metadata = {
    title: 'Discover Businesses — Tagdeer',
    description: 'Find and review trusted businesses in Tripoli and Benghazi, Libya.',
};

// ISR: Revalidate every 60 seconds
export const revalidate = 60;

async function getBusinesses() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data } = await supabase.rpc('get_businesses_paginated', {
        p_limit: 20,
    });

    return data || [];
}

export default async function DiscoverPage() {
    const businesses = await getBusinesses();

    return (
        <main>
            <h1>Discover Businesses</h1>
            {/* Render businesses server-side for SEO */}
            {/* Client-side interactive elements can be separate 'use client' components */}
        </main>
    );
}
```

---

#### ARCH-04: Migration Squash

**Root Cause:**
58 migrations with no squashing creates onboarding friction and increases the risk of schema drift.

**Proposed Strategy:**
1. Create a snapshot of the current schema as a single baseline migration
2. Archive old migrations in a `_archive/` directory
3. Add CI migration testing

```bash
# Step 1: Generate current schema snapshot
supabase db dump --local > supabase/migrations/00000000000000_baseline.sql

# Step 2: Move old migrations to archive
mkdir -p supabase/migrations/_archive
mv supabase/migrations/2025*.sql supabase/migrations/_archive/
mv supabase/migrations/2026*.sql supabase/migrations/_archive/

# Step 3: Keep only the baseline
# Then test: supabase db reset (should create the full schema from baseline)
```

> [!WARNING]
> Migration squashing should be done carefully. Test `supabase db reset` against a local instance before touching staging or production.

---

### Sprint 4 — Polish & Missing Features (Week 7-8+)

---

#### INFRA-01: Enable Connection Pooling

**Fix:**
In `supabase/config.toml`:

```toml
[db.pooler]
enabled = true
port = 6543
pool_mode = "transaction"
default_pool_size = 15
max_client_conn = 100
```

---

#### INFRA-02: Add Error Tracking (Sentry)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Then configure in `sentry.client.config.js`:

```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1, // 10% of transactions
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === "production",
});
```

---

#### INFRA-03: Clean Root Test Files

```bash
# Remove debugging artifacts from project root
rm -f test_*.js test_*.mjs kill_locks.js

# Add to .gitignore
echo "test_*.js" >> .gitignore
echo "test_*.mjs" >> .gitignore
echo "kill_locks.js" >> .gitignore
```

---

#### INFRA-04: Change License

Replace MIT license in `package.json` and `LICENSE` file:

```json
{
    "license": "BUSL-1.1"
}
```

Or create a `LICENSE.md` with a Business Source License that converts to Apache 2.0 after 4 years, preventing commercial competitors from forking while allowing open evaluation.

---

#### INFRA-05: Update README

The README needs to be rewritten to reflect the actual Next.js 16 stack, Supabase backend, and current architecture. Key sections:
- Stack: Next.js 16, React 19, Supabase, Tailwind CSS, shadcn/ui
- Setup: `.env.local` from `.env.example`, `npm install`, `npm run dev`
- Architecture: Subdomain routing (consumer/merchant/admin)
- Deployment: Vercel with wildcard domain configuration

---

## Summary: Effort Breakdown

| Sprint | Focus | Issues | Estimated Time |
|---|---|---|---|
| Sprint 1 | 🔴 Critical Security | SEC-01→07 + Auth + BUG-07 | ~20-25 hours |
| Sprint 2 | 🟡 Bug Fixes & Stability | BUG-01→06 + Serial Collision | ~12-15 hours |
| Sprint 3 | 🟢 Architecture & Scale | Context, Pagination, SSR, Migrations | ~20-25 hours |
| Sprint 4 | ⚪ Polish & Features | Pooling, Sentry, Cleanup, License | ~8-10 hours |
| **Total** | | **24 distinct items** | **~60-75 hours** |

> [!TIP]
> Sprint 1 is **non-negotiable before launch**. Sprints 2-3 should be completed before opening to public traffic. Sprint 4 can be done incrementally post-launch.
