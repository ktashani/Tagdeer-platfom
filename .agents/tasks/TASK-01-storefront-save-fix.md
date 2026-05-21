# TASK 01: Storefront Save Fix

**Goal:** Refactor the storefront save logic to use the standard Supabase SDK instead of raw `fetch()`.

## Target File
`src/app/(portals)/merchant/storefront-builder/[businessId]/page.jsx`

## Instructions

1. Locate the `handleSave` function (around line 114).
2. Look for the raw fetch logic (around lines 144-174) that looks like this:
   ```javascript
   // Bypass Supabase JS client entirely — use raw fetch to PostgREST
   ...
   const res = await fetch(\`\${supabaseUrl}/rest/v1/storefronts?on_conflict=business_id\`, ...);
   ```
3. Replace that entire raw fetch block with standard Supabase `upsert` using an `AbortController` for timeout:

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

    const saved = Array.isArray(data) ? data[0] : data;
    if (saved) {
        setStorefront(prev => ({ ...prev, ...saved, status: publish ? 'published' : prev.status }));
    }
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

4. Remove the `console.log('[SAVE]')` lines.
5. Ensure the surrounding try/catch and `setIsSaving(true/false)` logic is clean.

## Verification
- Build the app: `npm run build`
- No syntax errors in `page.jsx`.
