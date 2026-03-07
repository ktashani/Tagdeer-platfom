---
description: Comprehensive Storefront System Overhaul — Builder, Public Page, Save Fix, Products, Pixels, Arabic Support
---

# Storefront System Overhaul — Agent Instructions

> **Priority:** Execute phases in order. Each phase has dependencies noted.
> **Testing:** User cannot auto-test (magic link auth required). Build must pass (`npm run build`).

---

## Project Context

- **Framework:** Next.js 16 (Turbopack, App Router)
- **Database:** Supabase (PostgreSQL + PostgREST + RLS)
- **Storage:** Cloudflare R2 (presigned URL uploads)
- **Styling:** Tailwind CSS 3
- **i18n:** Custom `translations.js` at `src/i18n/translations.js` (EN/AR)
- **Auth:** Supabase Auth (OTP + password), fingerprint-based anti-fraud
- **Context:** `src/context/TagdeerContext.jsx` provides `supabase`, `user`, `showToast`, `t()`, `lang`, `isRTL`

### Key Tables
- `storefronts` — 1:1 with `businesses` via `business_id`
- `catalog_items` — 1:N with `storefronts` via `storefront_id`
- `logs` — interaction logs (NOT `interaction_logs`), columns: `interaction_type`, `reason_text`, `profile_id`
- `businesses` — parent entity, columns: `recommends`, `complains`, `claimed_by`

### Tagdeer Brand Terminology (MUST USE)
| English | Arabic | Context |
|---------|--------|---------|
| Recommend | أنصح به | Positive business vote |
| Complain | لا أنصح به | Negative business vote |
| Gader Score | مؤشر القَدْر | Trust percentage |
| Community Reviews | تجارب المجتمع | Review section heading |
| Share Your Tagdeer | شاركنا تقديرك | CTA for leaving review |
| Like | أعجبني | Product thumbs up |
| Dislike | لم يعجبني | Product thumbs down |
| Products | المنتجات | Product catalog section |
| Gallery | المعرض | Image gallery |
| Call Now | اتصل الآن | Phone CTA |
| Directions | الاتجاهات | Maps CTA |
| Powered By | مدعوم بواسطة | Footer branding |

---

## Phase 1: Database Migration

**File:** `supabase/migrations/20260314_storefront_overhaul.sql`

```sql
-- 1. Extend catalog_items with SKU, ordering, and reaction counts
ALTER TABLE public.catalog_items
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0;

-- 2. Catalog reaction tracking (fingerprint-based, 1 reaction per device per item)
CREATE TABLE IF NOT EXISTS public.catalog_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
    fingerprint TEXT NOT NULL,
    reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(item_id, fingerprint)
);

-- 3. RLS for catalog_reactions
ALTER TABLE public.catalog_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert reactions"
    ON public.catalog_reactions FOR INSERT
    TO PUBLIC
    WITH CHECK (true);

CREATE POLICY "Allow public read reactions"
    ON public.catalog_reactions FOR SELECT
    TO PUBLIC
    USING (true);

-- 4. Index for performance
CREATE INDEX IF NOT EXISTS idx_catalog_reactions_item ON public.catalog_reactions(item_id);

-- 5. Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload_schema';
```

**Run this SQL in Supabase Dashboard → SQL Editor before proceeding.**

---

## Phase 2: Fix Save Logic in Storefront Builder

**File:** `src/app/(portals)/merchant/storefront-builder/[businessId]/page.jsx`

### What to Remove
- All `>>> [DIAGNOSTIC]` console.log lines
- The raw `fetch()` call with localStorage JWT extraction (lines ~128-209)
- The `isDone`, `fallbackTimeout`, `performance.now()` diagnostic variables
- The `Promise.race` / manual timeout patterns

### What to Replace With

Replace the entire save body inside `try {}` (after payload construction and Base64 validation) with:

```javascript
// Use AbortController for clean timeout
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 12000);

try {
    const { data, error } = await supabase
        .from('storefronts')
        .upsert(payload, { onConflict: 'business_id' })
        .select()
        .abortSignal(controller.signal);

    clearTimeout(timeout);

    if (error) {
        if (error.code === '23505') throw new Error('That URL slug is already taken by another business.');
        if (error.code === '23503') throw new Error('Business ID does not exist in the database.');
        throw new Error(error.message || 'Save failed');
    }

    setStorefront(prev => ({ ...prev, status: publish ? 'published' : prev.status }));
    setOriginalSlug(storefront.slug);
    showToast(publish ? 'Storefront Published Successfully!' : 'Draft Saved!', 'success');
} catch (err) {
    if (err.name === 'AbortError') {
        showToast('Save timed out. Please check your connection and try again.', 'error');
    } else {
        showToast(err.message || 'Failed to save storefront.', 'error');
    }
} finally {
    setIsSaving(false);
}
```

### Keep Intact
- The `useEffect` data loading logic
- The image upload handlers (`handleGalleryUpload`, `handleAssetUpload`)
- The Base64 validation guard
- The slug sanitization (`toLowerCase().trim()`)

---

## Phase 3: Add Products Tab to Builder

**File:** `src/app/(portals)/merchant/storefront-builder/[businessId]/page.jsx`

### Tab Structure
Change `TabsList` from `grid-cols-4` → `grid-cols-6` (adding Products + Marketing tabs).

Add after the Gallery tab:
```jsx
<TabsTrigger value="products" className="text-xs">
    <Store className="w-3 h-3 mr-1.5" /> Products
</TabsTrigger>
<TabsTrigger value="marketing" className="text-xs">
    <BarChart3 className="w-3 h-3 mr-1.5" /> Marketing
</TabsTrigger>
```

### Products Tab Content

**State additions:**
```javascript
const [catalogItems, setCatalogItems] = useState([]);
const [editingItem, setEditingItem] = useState(null); // null or item object
const [showImportModal, setShowImportModal] = useState(false);
```

**Load catalog items** in the existing `useEffect` after storefront loads:
```javascript
if (sfData?.id) {
    const { data: items } = await supabase
        .from('catalog_items')
        .select('*')
        .eq('storefront_id', sfData.id)
        .order('display_order', { ascending: true });
    setCatalogItems(items || []);
}
```

**Manual add form** (inline card):
- Name (Input, required)
- Description (Textarea)
- Price (Input type="number", step="0.01")
- Category (Input with datalist of existing categories)
- SKU (Input, optional, placeholder "e.g. PROD-001")
- Image (Upload button using same R2 pattern as gallery)
- Active toggle (Switch)
- Save / Cancel buttons

**Save product handler:**
```javascript
const handleSaveProduct = async (item) => {
    const payload = {
        storefront_id: storefront.id,
        name: item.name,
        description: item.description,
        price: parseFloat(item.price) || 0,
        category: item.category || 'General',
        sku: item.sku || null,
        image_url: item.image_url || null,
        is_active: item.is_active !== false,
        display_order: item.display_order || catalogItems.length,
    };

    if (item.id) {
        // Update
        const { error } = await supabase.from('catalog_items').update(payload).eq('id', item.id);
        if (error) { showToast('Failed to update product.', 'error'); return; }
        setCatalogItems(prev => prev.map(p => p.id === item.id ? { ...p, ...payload } : p));
    } else {
        // Insert
        const { data, error } = await supabase.from('catalog_items').insert(payload).select().single();
        if (error) { showToast('Failed to add product.', 'error'); return; }
        setCatalogItems(prev => [...prev, data]);
    }
    setEditingItem(null);
    showToast('Product saved!', 'success');
};
```

**Delete handler:**
```javascript
const handleDeleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;
    await supabase.from('catalog_items').delete().eq('id', id);
    setCatalogItems(prev => prev.filter(p => p.id !== id));
    showToast('Product deleted.', 'success');
};
```

**Import buttons:**
```jsx
<div className="flex gap-2 mt-4">
    <Button variant="outline" onClick={() => setShowImportModal(true)}>
        <UploadCloud className="w-4 h-4 mr-2" /> Import Products
    </Button>
    <Button variant="outline" onClick={() => setEditingItem({ name: '', price: '', category: '', sku: '' })}>
        + Add Product
    </Button>
</div>
```

---

## Phase 4: Catalog Import Modal

**File:** `src/components/merchant/CatalogImportModal.jsx` (NEW)

### Import Modes

**Tab 1: CSV Upload**
```javascript
// Parse CSV in browser (no dependencies)
const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((h, i) => { obj[h] = values[i]?.trim(); });
        return {
            name: obj.name || obj.title || obj.product_name || '',
            description: obj.description || obj.desc || '',
            price: parseFloat(obj.price || obj.amount || 0),
            category: obj.category || obj.type || 'General',
            image_url: obj.image_url || obj.image || obj.photo || '',
            sku: obj.sku || obj.id || '',
        };
    }).filter(item => item.name);
};
```

**Tab 2: URL Feed**
- Input field for URL (e.g. `https://example.com/gmc.xml?feed_id=2&access_token=abc`)
- Calls server-side API: `POST /api/merchant/parse-catalog-feed` with `{ url }`
- Shows preview table of parsed products
- Merchant confirms → bulk insert

### Preview Table
Show parsed products in a table with columns: Name, Price, Category, SKU
Merchant can toggle individual items on/off before importing.

### Bulk Insert
```javascript
const handleBulkInsert = async (items) => {
    const payload = items.map((item, i) => ({
        storefront_id: storefrontId,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        sku: item.sku,
        image_url: item.image_url,
        display_order: catalogItems.length + i,
        is_active: true,
    }));
    const { data, error } = await supabase.from('catalog_items').insert(payload).select();
    if (error) { showToast('Import failed.', 'error'); return; }
    setCatalogItems(prev => [...prev, ...data]);
    showToast(`${data.length} products imported!`, 'success');
};
```

---

## Phase 5: Server-Side Feed Parser

**File:** `src/app/api/merchant/parse-catalog-feed/route.js` (NEW)

```javascript
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const { url } = await req.json();
        if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

        const response = await fetch(url, { headers: { 'User-Agent': 'Tagdeer-Bot/1.0' } });
        const text = await response.text();
        const contentType = response.headers.get('content-type') || '';

        let products = [];

        if (contentType.includes('xml') || text.trim().startsWith('<?xml') || text.trim().startsWith('<')) {
            // XML parsing (Google Merchant Center format)
            // Extract <item> or <entry> elements
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
                    description: get('description'),
                    price: parseFloat(get('price') || get('sale_price') || 0),
                    category: get('product_type') || get('category') || 'General',
                    image_url: get('image_link') || get('image'),
                    sku: get('id') || get('sku') || get('mpn'),
                });
            }
        } else if (contentType.includes('json') || text.trim().startsWith('[') || text.trim().startsWith('{')) {
            // JSON parsing
            const json = JSON.parse(text);
            const items = Array.isArray(json) ? json : (json.products || json.items || json.data || []);
            products = items.map(item => ({
                name: item.name || item.title || '',
                description: item.description || item.body_html || '',
                price: parseFloat(item.price || item.variants?.[0]?.price || 0),
                category: item.category || item.product_type || 'General',
                image_url: item.image_url || item.image?.src || item.images?.[0]?.src || '',
                sku: item.sku || item.id?.toString() || '',
            }));
        } else {
            // CSV fallback
            const lines = text.split('\n').filter(l => l.trim());
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            products = lines.slice(1).map(line => {
                const values = line.split(',');
                const obj = {};
                headers.forEach((h, i) => { obj[h] = values[i]?.trim(); });
                return {
                    name: obj.name || obj.title || '',
                    description: obj.description || '',
                    price: parseFloat(obj.price || 0),
                    category: obj.category || 'General',
                    image_url: obj.image_url || obj.image || '',
                    sku: obj.sku || obj.id || '',
                };
            });
        }

        products = products.filter(p => p.name);
        return NextResponse.json({ products, count: products.length });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
```

---

## Phase 6: Product Like/Dislike API

**File:** `src/app/api/catalog/react/route.js` (NEW)

```javascript
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
    const { item_id, fingerprint, reaction } = await req.json();

    if (!item_id || !fingerprint || !['like', 'dislike'].includes(reaction)) {
        return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
    }

    // Upsert reaction (one per device per item)
    const { error: reactErr } = await supabase
        .from('catalog_reactions')
        .upsert({ item_id, fingerprint, reaction }, { onConflict: 'item_id,fingerprint' });

    if (reactErr) return NextResponse.json({ error: reactErr.message }, { status: 500 });

    // Recount
    const { count: likes } = await supabase.from('catalog_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', item_id).eq('reaction', 'like');
    const { count: dislikes } = await supabase.from('catalog_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('item_id', item_id).eq('reaction', 'dislike');

    await supabase.from('catalog_items').update({ likes, dislikes }).eq('id', item_id);

    return NextResponse.json({ likes, dislikes });
}
```

---

## Phase 7: Public Storefront Page Overhaul

**File:** `src/app/(consumer)/b/[slug]/page.jsx` — FULL REWRITE

### Architecture

This is a **Server Component** (no `"use client"`). It uses:
- `generateMetadata()` for SEO + pixel script injection
- ISR with `revalidate = 60`
- `?lang=ar` query param for Arabic mode
- Client components imported for interactive elements (like/dislike, social embeds)

### Data Fetching
```javascript
const { data: storefront } = await supabase
    .from('storefronts')
    .select(`
        *,
        businesses (
            id, name, category, region, external_url, recommends, complains,
            feature_allocations ( feature_type, status )
        ),
        catalog_items ( id, name, description, price, image_url, category, sku, is_active, likes, dislikes, display_order )
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

// Recent reviews — CORRECT table and columns
const { data: recentLogs } = await supabase
    .from('logs')
    .select('id, interaction_type, reason_text, created_at, profile_id')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(5);
```

### Metadata with Pixel Injection
```javascript
export async function generateMetadata({ params, searchParams }) {
    // ... fetch storefront ...
    const seo = storefront.seo_metadata || {};
    const meta = {
        title: seo.title || `${biz.name} | Tagdeer`,
        description: seo.description || `Discover ${biz.name} on Tagdeer`,
        openGraph: {
            title: seo.title || biz.name,
            description: seo.description,
            images: seo.og_image ? [{ url: seo.og_image }] : [],
        },
    };
    // Search Console verification
    if (seo.search_console_id) {
        meta.verification = { google: seo.search_console_id };
    }
    return meta;
}
```

### Pixel Scripts (inside the component, NOT metadata)
```jsx
import Script from 'next/script';

// Inside return, before </main>:
{seo.meta_pixel_id && (
    <Script id="fb-pixel" strategy="afterInteractive">{`
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
        (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init','${seo.meta_pixel_id}');fbq('track','PageView');
    `}</Script>
)}

{(seo.google_ads_id || seo.gtm_id) && (
    <>
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${seo.google_ads_id || seo.gtm_id}`} strategy="afterInteractive" />
        <Script id="gtag-init">{`
            window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
            gtag('js',new Date());
            ${seo.google_ads_id ? `gtag('config','${seo.google_ads_id}');` : ''}
            ${seo.gtm_id ? `gtag('config','${seo.gtm_id}');` : ''}
        `}</Script>
    </>
)}
```

### Page Layout Order
1. **Banner** (full-width image with gradient overlay)
2. **Logo + Business Name + Trust Badge** (ShieldCheck if active)
3. **Category • Region** (themed color)
4. **Social CTA Bar** (WhatsApp, Phone, Instagram, Facebook, Website, Directions icons)
5. **Description** (bilingual)
6. **Products/Menu** (grouped by category, with like/dislike thumbs)
7. **Image Gallery** (horizontal scroll carousel)
8. **Gader Score** (3-column: Recommends, Complains, Trust %)
9. **Community Reviews** (latest 5 logs)
10. **Review CTA** ("Share Your Tagdeer" card)
11. **Social Media Grid** (Instagram/Facebook embed)
12. **Tagdeer Footer Branding**
13. **Mobile Sticky Footer** (Call + WhatsApp + Directions)

### Google Maps Directions Link
```javascript
// Use dir mode, not search mode
const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(business.name + ', ' + business.region + ', Libya')}`;
```

### Social CTA Icons
```jsx
{contacts.phone && <a href={`tel:${contacts.phone}`}><Phone /></a>}
{seo.whatsapp && <a href={`https://wa.me/${seo.whatsapp.replace(/\D/g,'')}`}><MessageCircle /></a>}
{contacts.instagram && <a href={contacts.instagram} target="_blank"><Instagram /></a>}
{contacts.facebook && <a href={contacts.facebook} target="_blank"><Facebook /></a>}
{(contacts.website || business.external_url) && <a href={contacts.website || business.external_url} target="_blank"><Globe /></a>}
<a href={mapsUrl} target="_blank"><MapPin /></a>
```

### Product Card with Like/Dislike (Client Component)
```jsx
// src/components/consumer/ProductCard.jsx
'use client';
import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

export default function ProductCard({ item, theme, lang }) {
    const [likes, setLikes] = useState(item.likes || 0);
    const [dislikes, setDislikes] = useState(item.dislikes || 0);
    const [voted, setVoted] = useState(null);

    const handleReact = async (reaction) => {
        // Get fingerprint
        const { getDeviceFingerprint } = await import('@/lib/fingerprint');
        const fingerprint = getDeviceFingerprint();

        const res = await fetch('/api/catalog/react', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: item.id, fingerprint, reaction }),
        });
        const data = await res.json();
        if (res.ok) {
            setLikes(data.likes);
            setDislikes(data.dislikes);
            setVoted(reaction);
        }

        // Fire pixel events
        if (typeof fbq !== 'undefined') {
            fbq('track', 'ViewContent', {
                content_ids: [item.sku || item.id],
                content_type: 'product',
                value: item.price,
                currency: 'LYD'
            });
        }
        if (typeof gtag !== 'undefined') {
            gtag('event', 'view_item', {
                items: [{ id: item.sku || item.id, name: item.name, price: item.price }]
            });
        }
    };

    return (
        <div className="flex gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm group">
            {item.image_url && (
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0">
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <h4 className="font-bold text-lg truncate">{item.name}</h4>
                {item.description && <p className="text-sm text-slate-500 line-clamp-2 mt-1">{item.description}</p>}
                <div className="flex items-center justify-between mt-2">
                    {item.price > 0 && <span className="font-black" style={{ color: theme.primaryColor }}>{item.price} LYD</span>}
                    <div className="flex gap-3 text-sm">
                        <button onClick={() => handleReact('like')}
                            className={`flex items-center gap-1 ${voted === 'like' ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                            <ThumbsUp className="w-4 h-4" /> {likes}
                        </button>
                        <button onClick={() => handleReact('dislike')}
                            className={`flex items-center gap-1 ${voted === 'dislike' ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                            <ThumbsDown className="w-4 h-4" /> {dislikes}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
```

---

## Phase 8: Marketing Tab in Builder

**File:** `src/app/(portals)/merchant/storefront-builder/[businessId]/page.jsx`

Add `TabsContent value="marketing"` with fields:

```jsx
<TabsContent value="marketing" className="space-y-6">
    <div className="space-y-4 p-4 rounded-xl border bg-slate-50">
        <Label className="font-bold">SEO & Search</Label>
        <div className="space-y-2">
            <Label className="text-xs text-slate-500">Meta Description</Label>
            <Textarea value={storefront.seo_metadata.description}
                onChange={e => setStorefront({...storefront, seo_metadata: {...storefront.seo_metadata, description: e.target.value}})}
                placeholder="A compelling description for Google search results..."
                className="min-h-[80px]" />
        </div>
        <div className="space-y-2">
            <Label className="text-xs text-slate-500">OG Image URL (Social Sharing)</Label>
            <Input value={storefront.seo_metadata.og_image || ''}
                onChange={e => setStorefront({...storefront, seo_metadata: {...storefront.seo_metadata, og_image: e.target.value}})}
                placeholder="https://example.com/og-image.jpg" />
        </div>
        <div className="space-y-2">
            <Label className="text-xs text-slate-500">Google Search Console Verification ID</Label>
            <Input value={storefront.seo_metadata.search_console_id || ''}
                onChange={e => setStorefront({...storefront, seo_metadata: {...storefront.seo_metadata, search_console_id: e.target.value}})}
                placeholder="e.g. abc123XYZ" />
        </div>
    </div>

    <div className="space-y-4 p-4 rounded-xl border bg-slate-50">
        <Label className="font-bold">Tracking & Retargeting Pixels</Label>
        <p className="text-xs text-slate-500">Paste your pixel IDs. Scripts auto-inject on your public storefront.</p>
        <div className="space-y-2">
            <Label className="text-xs text-slate-500">Meta Pixel ID (Facebook/Instagram)</Label>
            <Input value={storefront.seo_metadata.meta_pixel_id || ''}
                onChange={e => setStorefront({...storefront, seo_metadata: {...storefront.seo_metadata, meta_pixel_id: e.target.value}})}
                placeholder="e.g. 123456789012345" />
        </div>
        <div className="space-y-2">
            <Label className="text-xs text-slate-500">Google Ads Conversion ID</Label>
            <Input value={storefront.seo_metadata.google_ads_id || ''}
                onChange={e => setStorefront({...storefront, seo_metadata: {...storefront.seo_metadata, google_ads_id: e.target.value}})}
                placeholder="e.g. AW-123456789" />
        </div>
        <div className="space-y-2">
            <Label className="text-xs text-slate-500">Google Tag Manager Container ID</Label>
            <Input value={storefront.seo_metadata.gtm_id || ''}
                onChange={e => setStorefront({...storefront, seo_metadata: {...storefront.seo_metadata, gtm_id: e.target.value}})}
                placeholder="e.g. GTM-XXXXXXX" />
        </div>
    </div>

    <div className="space-y-4 p-4 rounded-xl border bg-slate-50">
        <Label className="font-bold">WhatsApp CTA</Label>
        <Input value={storefront.seo_metadata.whatsapp || ''}
            onChange={e => setStorefront({...storefront, seo_metadata: {...storefront.seo_metadata, whatsapp: e.target.value}})}
            placeholder="+218 9X XXX XXXX" />
        <p className="text-xs text-slate-500">Separate from phone number. Used for WhatsApp button on your page.</p>
    </div>
</TabsContent>
```

---

## Phase 9: Password Reset Fix

### Fix 1: Settings page redirect
**File:** `src/app/(portals)/merchant/settings/page.jsx`

Change line ~325:
```javascript
// FROM:
const redirectUrl = `${window.location.origin}/auth/callback?next=/merchant/reset-password`;
// TO:
const redirectUrl = `${window.location.origin}/auth/callback?next=/merchant/reset-password&from=merchant`;
```

### Fix 2: Auth callback handling RECOVERY event
**File:** `src/app/(consumer)/auth/callback/page.jsx`

In the `onAuthStateChange` handler, add `PASSWORD_RECOVERY` to the event check:
```javascript
if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY') && newSession?.user) {
```

---

## Design Guidelines

### Color Palette (Tagdeer Brand)
- Primary: `#10b981` (emerald)
- Dark: `#0f172a` (slate-900)
- Accent: `#8b5cf6` (purple for merchant portal)
- Recommend: `emerald-500`
- Complain: `rose-500`
- Trust Score: themed `primaryColor`

### Typography
- Headings: `font-black` (900 weight)
- Body: default (400)
- Labels: `font-bold text-xs text-slate-500`

### Spacing
- Section gaps: `mt-12`
- Card padding: `p-6`
- Border radius: `rounded-2xl` (cards), `rounded-3xl` (hero sections)

### Mobile-First
- All layouts start mobile, expand with `md:` breakpoints
- Sticky footer on mobile only (`md:hidden`)
- Touch targets minimum 44x44px

### RTL Support
- Wrap `<main>` with `dir={lang === 'ar' ? 'rtl' : 'ltr'}`
- Use logical properties where possible
- Mirror icon positions in RTL

---

## Files Summary

| Action | Path | Phase |
|--------|------|-------|
| NEW | `supabase/migrations/20260314_storefront_overhaul.sql` | 1 |
| MODIFY | `src/app/(portals)/merchant/storefront-builder/[businessId]/page.jsx` | 2,3,8 |
| NEW | `src/components/merchant/CatalogImportModal.jsx` | 4 |
| NEW | `src/app/api/merchant/parse-catalog-feed/route.js` | 5 |
| NEW | `src/app/api/catalog/react/route.js` | 6 |
| REWRITE | `src/app/(consumer)/b/[slug]/page.jsx` | 7 |
| NEW | `src/components/consumer/ProductCard.jsx` | 7 |
| MODIFY | `src/app/(portals)/merchant/settings/page.jsx` | 9 |
| MODIFY | `src/app/(consumer)/auth/callback/page.jsx` | 9 |
| MODIFY | `src/i18n/translations.js` | 7 |
