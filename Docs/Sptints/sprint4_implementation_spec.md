# Sprint 4 — Polish & Missing Features: File-by-File Implementation Specification

**Date:** 2026-03-11
**Author:** Lead Systems Architect
**Sprint Duration:** Week 7-8+
**Dependencies:** Sprints 1-3 committed (`875941c`, `9ad3d94`) must be deployed first.
**Scope:** 4 tasks — INFRA-01, INFRA-02, INFRA-04, INFRA-05
**Note:** INFRA-03 (Root Test File Cleanup) was already completed in Sprint 3.

---

## Table of Contents

1. [TASK 1: INFRA-01 — Enable Supabase Connection Pooling](#task-1-infra-01--enable-supabase-connection-pooling)
2. [TASK 2: INFRA-02 — Add Sentry Error Tracking](#task-2-infra-02--add-sentry-error-tracking)
3. [TASK 3: INFRA-04 — Change License from MIT to BUSL-1.1](#task-3-infra-04--change-license-from-mit-to-busl-11)
4. [TASK 4: INFRA-05 — Rewrite README for Next.js Stack](#task-4-infra-05--rewrite-readme-for-nextjs-stack)
5. [Verification Plan](#verification-plan)

---

## Critical Rules for the Implementer

1. **Do NOT rename, delete, or reorganize** any file not explicitly listed in a task.
2. **Do NOT run any `git` commands.** Write code only.
3. **Do NOT add placeholder comments** like `// ... existing code`. Write the complete, functional file content for every modification.
4. **Execute tasks in order.** TASK 2 depends on TASK 1 being committed (but not deployed).
5. **Do NOT modify any context providers, API routes, or consumer pages.** Sprint 4 is infrastructure-only.
6. **Do NOT install packages other than `@sentry/nextjs`** without explicit approval.

---

## TASK 1: INFRA-01 — Enable Supabase Connection Pooling

**Root Cause:** The local Supabase config has `[db.pooler] enabled = false`. In production, this means every request opens a new database connection. Under sustained load, PostgreSQL's `max_connections` limit (default: 100) is hit, causing `FATAL: too many connections` errors.

**Affected files:**
- `supabase/config.toml` — **MODIFY** (3 line changes)

### TASK 1A: Modify `supabase/config.toml`

**Find [db.pooler] section (currently around line 27-33):**

```toml
[db.pooler]
enabled = false
# Port to use for the local connection pooler.
port = 54329
# Specifies when a server connection can be reused by other clients.
# Configure one of the supported pooler modes: `transaction`, `session`.
default_pool_size = 20
max_client_conn = 100
```

**Replace with:**

```toml
[db.pooler]
enabled = true
# Port to use for the local connection pooler.
port = 54329
# Specifies when a server connection can be reused by other clients.
# Configure one of the supported pooler modes: `transaction`, `session`.
pool_mode = "transaction"
default_pool_size = 15
max_client_conn = 100
```

**Changes:**
1. `enabled = false` → `enabled = true`
2. Add `pool_mode = "transaction"` (line was missing entirely)
3. `default_pool_size = 20` → `default_pool_size = 15` (conservative to leave headroom)

**Constraints:**
- Do NOT change any other section of `config.toml`.
- Do NOT change `port`, `max_client_conn`, or any auth/storage/studio settings.
- `pool_mode = "transaction"` is required — session mode would break Supabase Realtime subscriptions.

---

## TASK 2: INFRA-02 — Add Sentry Error Tracking

**Root Cause:** There is zero production error visibility. When users hit bugs, the team has no way to know. The `.env.example` already has a `NEXT_PUBLIC_SENTRY_DSN=` placeholder, but the Sentry SDK is not installed and no configuration files exist.

**Affected files:**
- `package.json` — **MODIFY** (add dependency via npm)
- `sentry.client.config.js` — **NEW**
- `sentry.server.config.js` — **NEW**
- `sentry.edge.config.js` — **NEW**
- `next.config.mjs` — **MODIFY** (wrap with Sentry)
- `src/app/global-error.jsx` — **NEW**

> [!IMPORTANT]
> The developer must run `npm install @sentry/nextjs` as the first step. This is necessary before any config files will work. Do NOT use `npx @sentry/wizard` — we are writing the config manually to avoid automatic modifications to files outside the spec scope.

### TASK 2A: Install Sentry package

**Run this command:**

```bash
npm install @sentry/nextjs
```

### TASK 2B: New File `sentry.client.config.js`

**File:** `sentry.client.config.js` — **NEW** (project root)

```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance monitoring: sample 10% of transactions in production
    tracesSampleRate: 0.1,

    // Session replay: capture 5% of sessions, 100% on error
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,

    // Only enable in production
    enabled: process.env.NODE_ENV === "production",

    // Environment tag
    environment: process.env.NODE_ENV,

    // Filter out noisy errors
    ignoreErrors: [
        "ResizeObserver loop",
        "Network request failed",
        "AbortError",
        "Load failed",
    ],
});
```

### TASK 2C: New File `sentry.server.config.js`

**File:** `sentry.server.config.js` — **NEW** (project root)

```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
    environment: process.env.NODE_ENV,
});
```

### TASK 2D: New File `sentry.edge.config.js`

**File:** `sentry.edge.config.js` — **NEW** (project root)

```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
    environment: process.env.NODE_ENV,
});
```

### TASK 2E: Modify `next.config.mjs`

**Replace the entire file with:**

```javascript
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async headers() {
        return [{
            source: '/(.*)',
            headers: [
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
            ],
        }];
    },
};

export default withSentryConfig(nextConfig, {
    // Suppresses all Sentry build-time logs
    silent: true,

    // Upload source maps to Sentry for debugging
    // Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars
    // These are only needed during the build step on CI/CD
    org: process.env.SENTRY_ORG || "tagdeer",
    project: process.env.SENTRY_PROJECT || "tagdeer-platform",

    // Hides source maps from clients in production
    hideSourceMaps: true,

    // Disables Sentry's automatic instrumentation if no DSN is set
    disableLogger: true,
});
```

**Constraints:**
- The `headers()` function must remain **character-identical** to the current implementation.
- Do NOT add any middleware configuration.
- The `silent: true` flag prevents noisy build logs when `SENTRY_AUTH_TOKEN` is not set (local dev).

### TASK 2F: New File `src/app/global-error.jsx`

**File:** `src/app/global-error.jsx` — **NEW**

This is Next.js App Router's global error boundary. It catches unhandled errors and reports them to Sentry.

```jsx
'use client';

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="ar" dir="rtl">
            <body style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                fontFamily: 'system-ui, sans-serif',
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                textAlign: 'center',
                padding: '2rem',
            }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>
                        حدث خطأ غير متوقع
                    </h1>
                    <p style={{ fontSize: '1.125rem', color: '#94a3b8', marginBottom: '2rem' }}>
                        نعتذر عن هذا الخلل. فريق تقدير تم إبلاغه تلقائياً.
                    </p>
                    <button
                        onClick={() => reset()}
                        style={{
                            padding: '0.75rem 2rem',
                            borderRadius: '0.75rem',
                            border: 'none',
                            backgroundColor: '#10b981',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '1rem',
                            cursor: 'pointer',
                        }}
                    >
                        حاول مرة أخرى
                    </button>
                </div>
            </body>
        </html>
    );
}
```

**Constraints:**
- The error page must render standalone (`<html>` + `<body>`) because Next.js requires it for `global-error.jsx`.
- Arabic-first design matching the platform's default language.
- The `reset()` call re-renders the root layout, recovering from the error without a full page reload.

---

## TASK 3: INFRA-04 — Change License from MIT to BUSL-1.1

**Root Cause:** The MIT license allows any competitor to fork Tagdeer's codebase and launch a competing product. The Business Source License (BUSL-1.1) prevents commercial use while allowing open evaluation, converting to Apache 2.0 after 4 years.

**Affected files:**
- `LICENSE` — **REPLACE** (overwrite entire file)
- `package.json` — **MODIFY** (1 field change)

### TASK 3A: Replace `LICENSE` file

**Replace the entire file with:**

```
Business Source License 1.1

License text copyright (c) 2017 MariaDB Corporation Ab, All Rights Reserved.
"Business Source License" is a trademark of MariaDB Corporation Ab.

--------------------------------------------------------------------------

Parameters

Licensor:             Tagdeer Team
Licensed Work:        Tagdeer Platform
                      The Licensed Work is (c) 2026 Tagdeer Team.
Additional Use Grant: You may make use of the Licensed Work, provided that
                      you may not use the Licensed Work for a Commercial
                      Offering that competes with the Licensed Work. A
                      "Commercial Offering" is a product or service offered
                      to third parties on a paid basis or a free tier that
                      generates revenue through advertising, data, or usage.

Change Date:          Four years from the date the Licensed Work is published.

Change License:       Apache License, Version 2.0

--------------------------------------------------------------------------

For information about alternative licensing arrangements for the Licensed
Work, please contact: hello@tagdeer.app

Notice

The Business Source License (this document, or the "License") is not an
Open Source license. However, the Licensed Work will eventually be made
available under an Open Source License, as stated in this License.

License text below is subject to the BUSL-1.1 standard terms available at:
https://mariadb.com/bsl11/

THE LICENSED WORK IS PROVIDED "AS IS". THE LICENSOR HEREBY DISCLAIMS ALL
WARRANTIES, EXPRESS OR IMPLIED, INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

### TASK 3B: Modify `package.json`

**Find:**
```json
  "license": "MIT"
```

**Replace with:**
```json
  "license": "BUSL-1.1"
```

**Constraints:**
- Only modify the `license` field. Do NOT change `name`, `version`, `scripts`, `dependencies`, or any other field.

---

## TASK 4: INFRA-05 — Rewrite README for Next.js Stack

**Root Cause:** The current README (200 lines) is severely outdated. It references Vite 7, `VITE_*` environment variables, `main.jsx`, `App.jsx`, `vite.config.js`, StackBlitz deployment, and database tables that no longer exist (`interactions`, `pre_registrations`, `verified_users`). This misleads new contributors and wastes onboarding time.

**Affected files:**
- `README.md` — **REPLACE** (overwrite entire file)

### TASK 4A: Replace `README.md`

**Replace the entire file with:**

```markdown
# Tagdeer Platform | منصة تقدير

[![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4.svg)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E.svg)](https://supabase.io/)

**Tagdeer** (تقدير) is a Libyan community-powered business trust platform. Users leave honest evaluations ("Tagdeer") of local businesses and earn reputation points ("Gader") that unlock real-world rewards.

> **أعطيهم تقديرك، واكسب قَدْرك**
> *Give them your evaluation, and earn your value.*

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **UI** | React 19, Tailwind CSS 3.4, shadcn/ui, Lucide Icons |
| **Backend** | Supabase (PostgreSQL 15, Auth, Realtime, Edge Functions, Storage) |
| **State** | React Context (AuthProvider, BusinessDataProvider, UIProvider) |
| **i18n** | Custom bilingual system (Arabic RTL default, English LTR) |
| **Error Tracking** | Sentry |
| **Deployment** | Vercel with wildcard subdomain routing |

---

## Architecture

The application uses **Next.js App Router route groups** with subdomain-based routing:

```
src/app/
├── (consumer)/          # Public-facing pages (tagdeer.app)
│   ├── page.jsx         # Landing page
│   ├── discover/        # Business discovery + SSR/SEO layout
│   ├── b/[slug]/        # Public storefront (SSR)
│   ├── profile/         # User profile + wallet
│   ├── pricing/         # Subscription tiers
│   └── about/           # About page
├── (portals)/           # Authenticated portals
│   ├── merchant/        # Merchant dashboard (merchant.tagdeer.app)
│   │   ├── dashboard/
│   │   ├── coupons/
│   │   ├── storefront-builder/
│   │   └── settings/
│   └── admin/           # Admin panel (admin.tagdeer.app)
│       ├── businesses/
│       ├── users/
│       ├── campaigns/
│       ├── financials/
│       └── settings/
├── api/                 # API Routes
│   ├── consumer/        # Consumer endpoints (stats, logs)
│   ├── merchant/        # Merchant endpoints (password, trial)
│   └── admin/           # Admin endpoints (auth, claims, subscriptions)
```

**Context Providers** (refactored in Sprint 3):
- `AuthProvider` — Authentication, session sync, login methods
- `BusinessDataProvider` — Business data fetching, realtime subscriptions
- `UIProvider` — Modal state, anonymous interaction tracking

---

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm**
- **Supabase CLI** (`npm install -g supabase`)
- A Supabase project (free tier works)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tagdeer/tagdeer-platform.git
   cd tagdeer-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Fill in the required values (see [Environment Variables](#environment-variables) below).

4. **Start the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | ✅ |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Root domain for subdomain routing | Optional |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking | Optional |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID | Optional |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key | Optional |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key | Optional |
| `R2_BUCKET_NAME` | Cloudflare R2 bucket name | Optional |
| `R2_PUBLIC_URL` | Cloudflare R2 public URL | Optional |
| `META_ACCESS_TOKEN` | Meta WhatsApp API token (for OTP) | Optional |
| `META_PHONE_NUMBER_ID` | Meta phone number ID | Optional |
| `RESEND_API_KEY` | Resend API key (for email OTP) | Optional |

---

## Database

Supabase PostgreSQL with **67+ migrations** managed via `supabase/migrations/`.

### Core Tables

| Table | Purpose |
|---|---|
| `businesses` | Business listings with trust scores |
| `profiles` | User profiles with Gader points and VIP tiers |
| `logs` | Community evaluations (recommend/complain) |
| `storefronts` | Merchant public storefront pages |
| `catalog_items` | Storefront product catalogs |
| `merchant_coupons` | Loyalty reward coupons |
| `platform_config` | Dynamic platform configuration |
| `subscription_tiers` | Dynamic subscription tier definitions |
| `feature_allocations` | Per-business feature entitlements |

### Running Migrations

```bash
supabase db reset        # Reset and replay all migrations locally
supabase db push         # Push migrations to remote (staging/production)
```

See `supabase/migrations/README.md` for migration conventions.

---

## Deployment

### Vercel (Recommended)

1. Import the GitHub repository into Vercel
2. Add all environment variables in the Vercel dashboard
3. Configure wildcard subdomain: `*.tagdeer.app`
4. Map subdomains:
   - `tagdeer.app` → consumer routes
   - `merchant.tagdeer.app` → merchant portal
   - `admin.tagdeer.app` → admin panel
5. Deploy — zero build configuration needed

---

## Key Concepts (Tagdeer Protocol)

| Term | Arabic | Meaning |
|---|---|---|
| **Tagdeer** | تقدير | An evaluation or review |
| **Gader** | قَدْر | Trust points currency |
| **Gader Index** | مؤشر القَدْر | Business reputation score |
| **Migdar** | مقدار | Progress measure / ratio |

---

## License

This project is licensed under the **Business Source License 1.1** (BUSL-1.1).
See [LICENSE](LICENSE) for full details.

The license converts to **Apache 2.0** four years after each release.

---

<p align="center">
  Made with ❤️ in Libya
</p>
```

**Constraints:**
- Every table, route, and environment variable referenced must actually exist in the codebase at this point.
- Do NOT reference Vite, StackBlitz, `VITE_*` env vars, or any tables that don't exist.
- The badge URLs must use shields.io format with correct colors.

---

## Verification Plan

### Build Verification

```bash
cd /Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom
npm run build
```

The build must exit with code 0. The Sentry wrapper must not cause build failures when `SENTRY_AUTH_TOKEN` is not set (local dev). Verify the build output still lists all expected routes.

### Unit Tests (Existing)

```bash
cd /Users/tbs_capsule/Desktop/tagdeer/Tagdeer-platfom
npx vitest run
```

All existing tests must pass. Sprint 4 does not add new tests because:
- TASK 1 is a config-only change (no code under test)
- TASK 2 is SDK integration (Sentry's own tests validate SDK behavior)
- TASK 3 and 4 are documentation-only changes

### Manual Verification Checklist

**1. Connection Pooling (TASK 1):**
- Run `supabase start` locally.
- Verify `supabase status` shows the pooler port (54329) as active.

**2. Sentry Integration (TASK 2):**
- Set `NEXT_PUBLIC_SENTRY_DSN` in `.env.local` to a test DSN.
- Run `npm run build` — verify no Sentry-related errors.
- Run `npm run dev`, navigate to a page, and trigger a client-side error in DevTools console:
  ```javascript
  throw new Error("Sentry integration test");
  ```
- Check the Sentry dashboard to confirm the error was captured.

**3. License (TASK 3):**
- Open `LICENSE` — verify it contains BUSL-1.1 text with "Tagdeer Team" as Licensor.
- Run `cat package.json | grep license` — verify output is `"license": "BUSL-1.1"`.

**4. README (TASK 4):**
- Open `README.md` — verify no references to Vite, `VITE_*`, `main.jsx`, `App.jsx`, or `vite.config.js`.
- Verify all environment variable names match `.env.example`.
- Verify the architecture tree matches the actual `src/app/` directory structure.
