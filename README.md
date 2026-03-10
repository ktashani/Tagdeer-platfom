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
