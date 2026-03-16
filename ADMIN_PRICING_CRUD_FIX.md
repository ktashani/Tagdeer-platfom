# ADMIN_PRICING_CRUD_FIX.md — Tier Create/Update Duplication Bug

## Problem Statement

When an admin edits an existing tier (e.g., the "Free" tier) from the Admin Settings Pricing page and clicks **"Save Tiers"**, the system creates a duplicate tier card on the public `/pricing` page instead of updating the existing one. Repeated edits continue to increment new cards.

---

## Audit Findings — Root Cause Analysis

### Data Architecture

Tiers are stored as a **single JSON array** in the `platform_config` table under key `tier_pricing`. There is **no** separate `subscription_tiers` table for individual tier rows. This means:

- All CRUD operations go through `saveConfig('tier_pricing', tierPricing)` which calls `.update({ value }).eq('key', 'tier_pricing')` on the single DB row.
- The local React state `tierPricing` (an array) is the source of truth during editing.

### The Save Pipeline

```
Admin Form (local state) → handleSaveTierPricing() → saveConfig('tier_pricing', tierPricing) → refreshConfig() → useEffect re-syncs local state from DB
```

### Root Cause #1: `saveConfig()` Uses `.update()` Not `.upsert()`

**File:** `src/app/(portals)/admin/settings/page.jsx`, lines 90–107

```javascript
const saveConfig = async (key, value) => {
    const { error } = await supabase
        .from('platform_config')
        .update({ value })       // ← .update() only, NOT .upsert()
        .eq('key', key)
    // ...
}
```

If the `tier_pricing` key **does not exist** in `platform_config` (e.g., first-time setup, or if manually deleted), `.update()` matches **zero rows** and silently succeeds without writing anything. The admin sees a success toast, but the data never persists. On the next page reload, `configTierPricing` comes back as `[]` or `undefined`, and the admin has to re-create tiers.

**Meanwhile**, contrast this with `handleSaveRibbonConfig()` (line 213) and `handleSaveGateways()` (line 230), which **correctly** use `.upsert()` with `{ onConflict: 'key' }`:

```javascript
// Ribbon — CORRECT pattern:
await supabase
    .from('platform_config')
    .upsert({ key: 'ribbon_config', value: ribbonConfig }, { onConflict: 'key' });
```

The tier save is the **only** config save still using the old `.update()` pattern.

### Root Cause #2: `useEffect` Re-Sync Race Condition

**File:** `src/app/(portals)/admin/settings/page.jsx`, lines 66–72

```javascript
useEffect(() => {
    if (configTierPricing?.length > 0) setTierPricing(configTierPricing)
}, [configCategories, configRegions, configShieldPricing, configTierPricing])
```

After `handleSaveTierPricing()` calls `saveConfig()` → `refreshConfig()`, the `usePlatformConfig` hook re-fetches from the DB. If the save silently failed (Root Cause #1), the re-fetched `configTierPricing` is the **old** array. But because of the guard `configTierPricing?.length > 0`, the local state is overwritten back to the stale DB array — losing the admin's edits.

Even when the save **does** succeed, there's a subtle race: `refreshConfig()` triggers an async fetch. If the admin clicks "Add Tier" or edits a field **before** the fetch completes, the `useEffect` fires and overwrites the local edits with the just-fetched (pre-edit) data.

### Root Cause #3: No Delete Tier Handler

There is **no** `handleDeleteTier` function anywhere in the file. The admin can "Disable" a tier (`isActive: false`), but disabled tiers remain in the JSON array forever. Combined with the save failure above, this means:

1. Admin adds Tier A → save fails silently → array resets to old state.
2. Admin adds Tier A again → now local state has two copies.
3. Eventually a successful save writes the duplicated array to the DB.

---

## Proposed Changes

> [!CAUTION]
> All changes are restricted to `src/app/(portals)/admin/settings/page.jsx`. Do NOT modify the database schema, Stripe logic, or the public pricing page.

---

### Fix 1: Convert `saveConfig()` to Use `.upsert()`

**Why:** Align with the pattern already used by `handleSaveRibbonConfig()` and `handleSaveGateways()`. This guarantees the row is created if missing, or updated if it exists.

Replace lines 90–107:

```javascript
const saveConfig = async (key, value) => {
    setIsSaving(true)
    try {
        const { error } = await supabase
            .from('platform_config')
            .upsert({ key, value }, { onConflict: 'key' })

        if (error) throw error
        showToast(`${key} updated successfully.`)
        refreshConfig()
    } catch (err) {
        console.error(err)
        showToast(`Failed to update ${key}.`, 'error')
    } finally {
        setIsSaving(false)
    }
}
```

**Key change:** `.update({ value }).eq('key', key)` → `.upsert({ key, value }, { onConflict: 'key' })`

---

### Fix 2: Guard Against `useEffect` Re-Sync Overwriting Local Edits

**Why:** After `refreshConfig()` fires, the `useEffect` on line 66 should **not** overwrite local state if the user is actively editing. Use a ref flag to skip the re-sync during the save cycle.

Add a `useRef` flag at the top of the component:

```javascript
import { useState, useEffect, useRef } from 'react'

// Inside the component:
const isSavingRef = useRef(false)
```

Then update `saveConfig` to set the ref:

```javascript
const saveConfig = async (key, value) => {
    setIsSaving(true)
    isSavingRef.current = true
    try {
        const { error } = await supabase
            .from('platform_config')
            .upsert({ key, value }, { onConflict: 'key' })

        if (error) throw error
        showToast(`${key} updated successfully.`)
        refreshConfig()
    } catch (err) {
        console.error(err)
        showToast(`Failed to update ${key}.`, 'error')
    } finally {
        setIsSaving(false)
        // Delay clearing the flag so the useEffect from refreshConfig has time to fire and be skipped
        setTimeout(() => { isSavingRef.current = false }, 500)
    }
}
```

Then guard the `useEffect` re-sync:

```javascript
useEffect(() => {
    // Skip re-sync if we just saved (to prevent overwriting local edits)
    if (isSavingRef.current) return

    if (configCategories?.length > 0) setCategories(configCategories)
    if (configRegions?.length > 0) setRegions(configRegions)
    if (configShieldPricing) setShieldPricing(configShieldPricing)
    if (configTierPricing?.length > 0) setTierPricing(configTierPricing)
}, [configCategories, configRegions, configShieldPricing, configTierPricing])
```

---

### Fix 3: Add `handleDeleteTier()` Handler

**Why:** Without a delete function, duplicate or unwanted tiers accumulate in the JSON array and can never be cleaned up through the admin UI.

Add this handler after `handleAddTier` (after line 207):

```javascript
const handleDeleteTier = (tierId) => {
    if (!confirm('Are you sure you want to permanently delete this tier? This cannot be undone.')) return
    const updated = tierPricing.filter(t => t.id !== tierId)
    setTierPricing(updated)
    saveConfig('tier_pricing', updated)
}
```

Then add a **Delete button** inside the tier card UI. In the flex container at line 643 (the area with "Set Freebie" and "Disable Tier" buttons), add:

```jsx
<button
    onClick={() => handleDeleteTier(tier.id)}
    className="text-xs px-3 py-1.5 rounded font-bold bg-red-500/10 text-red-400 hover:bg-red-500/30 transition-all flex items-center gap-1"
>
    <Trash2 className="w-3 h-3" /> Delete
</button>
```

> [!WARNING]
> The `Trash2` icon is already imported on line 4. No new imports needed.

---

### Fix 4: Deduplicate Tiers Before Saving

**Why:** As a safety net, prevent the same tier `id` from being saved twice into the JSON array.

Modify `handleSaveTierPricing` (line 209):

```javascript
const handleSaveTierPricing = () => {
    // Deduplicate by id before saving — last occurrence wins
    const seen = new Map()
    tierPricing.forEach(t => {
        if (t.id) seen.set(t.id, t)
    })
    const deduped = Array.from(seen.values())
    setTierPricing(deduped)
    saveConfig('tier_pricing', deduped)
}
```

---

### Fix 5: Clean Up Existing Duplicate Tiers in the Database

The current `platform_config` row for `tier_pricing` likely contains duplicate entries from the bug. The worker agent must clean this up.

**Option A — Via Supabase Dashboard (Recommended):**

1. Open the Supabase Dashboard → Table Editor → `platform_config`.
2. Find the row where `key = 'tier_pricing'`.
3. Click to edit the `value` column (JSON).
4. Manually remove duplicate tier objects, keeping only one of each unique `id`.
5. Save the row.

**Option B — Via SQL (if dashboard access is unavailable):**

```sql
-- First, inspect the current state:
SELECT value FROM platform_config WHERE key = 'tier_pricing';

-- Then update with the deduplicated array.
-- Replace the JSON below with your actual clean tier array.
UPDATE platform_config
SET value = '[
    {"id":"free","name":"Free","name_ar":"مجاني","price":0,"isActive":true,"isFree":true, ...},
    {"id":"tier_starter","name":"Starter","name_ar":"أساسي","price":49,"isActive":true, ...},
    {"id":"tier_pro","name":"Pro","name_ar":"برو","price":99,"isActive":true,"isPopular":true, ...}
]'::jsonb
WHERE key = 'tier_pricing';
```

> [!IMPORTANT]
> After running the cleanup, reload the Admin Settings page and the public `/pricing` page to confirm exactly 3 unique tier cards appear.

---

## Files Modified (Summary)

| File | Change |
|---|---|
| `src/app/(portals)/admin/settings/page.jsx` | Fix `saveConfig` to upsert, add save-guard ref, add `handleDeleteTier`, add dedup-before-save |
| `platform_config` table (DB) | Manual cleanup of duplicate `tier_pricing` entries |

---

## Verification Plan

### Automated

```bash
# Type check
npx tsc --noEmit

# Build
npm run build

# Tests
npx vitest run
```

### Manual QA

1. **Upsert Fix:** Delete the `tier_pricing` row from `platform_config`. Go to Admin Settings → Pricing → click "Save Tiers". Verify the row is **created** (not silently lost).

2. **Edit Round-Trip:** Edit the "Starter" tier name to "Starter Pro" → Save → Reload Admin page → Confirm the name stuck. Reload `/pricing` → Confirm one card says "Starter Pro", **not** two cards.

3. **Delete Tier:** Click the new "Delete" button on a test tier → Confirm it disappears from the admin list and the public page after save.

4. **Race Condition:** Quickly click "Add Tier" → immediately click "Save" → Confirm no duplication after page reload.

5. **Fallback Safety:** With the DB cleanup done and only 3 tiers saved, load `/pricing` and confirm the 3-column grid renders symmetrically.
