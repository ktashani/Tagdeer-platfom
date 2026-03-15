# Phase 2: Critical Bug Fixes — Worker Instruction Manual

> **Generated:** 2026-03-15
> **Source:** `health_report.md` → Phase 2 (Tasks #8–#14)
> **Branch:** Work on `feat/dynamic-pricing-sync` (or a sub-branch off it)

---

## Task #8 — Fix `email` TDZ Bug in Profile Page

> [!NOTE]
> **Current Status:** This bug appears to already be fixed in the current codebase. `handleSaveProfile` is defined at **line 98**, and the `email` state variable is declared at **line 40** — well above it. The original report referenced `handleSaveProfile` at line 91 referencing `email` at line 130, which no longer matches.
>
> **Worker Action:** Verify this yourself. Open the file and confirm `email` is declared *before* `handleSaveProfile`. If it is, **mark this task as DONE — no changes needed.**

### File to Open

`src/app/(consumer)/profile/page.jsx`

### What to Check

1. Find `const [email, setEmail] = useState(...)` — should be around **line 40**
2. Find `const handleSaveProfile = async () => {` — should be around **line 98**
3. Confirm `handleSaveProfile` uses `email` (line ~110: `email: email || null`)
4. The `email` declaration MUST come before `handleSaveProfile`

### Safety Check

```bash
# From project root — build check
npm run build 2>&1 | grep -i "error"

# Navigate to http://localhost:3000/profile (logged in)
# Click on the Name field, type something, click away (triggers onBlur → handleSaveProfile)
# ✅ PASS: No crash, toast says "Profile Updated"
# ❌ FAIL: ReferenceError in console mentioning "email"
```

---

## Task #9 — Fix `setShowLoginModal` Undefined in Discover Page

### File to Open

`src/app/(consumer)/discover/page.jsx`

### The Problem

**Lines 11–14** — the `DiscoverContent` component destructures from `useTagdeer()` but does NOT include `setShowLoginModal`:

```jsx
// CURRENT (BROKEN) — Line 11-14:
const {
    t, lang, isRTL, businesses, anonInteractions, refreshAnonInteractions,
    showToast, setShowLimitModal, setVoteModal, setVoteReason, user,
    categories = [], regions = [], supabase
} = useTagdeer();
```

But at **line 133**, inside `openVoteModal`, it calls `setShowLoginModal(true)`:

```jsx
// Line 133:
setShowLoginModal(true);
```

This crashes when a non-logged-in user tries to complain on a shielded business.

### The Fix

**Replace lines 11–14** with this (adding `setShowLoginModal` to the destructure):

```jsx
const {
    t, lang, isRTL, businesses, anonInteractions, refreshAnonInteractions,
    showToast, setShowLimitModal, setShowLoginModal, setVoteModal, setVoteReason, user,
    categories = [], regions = [], supabase
} = useTagdeer();
```

> [!IMPORTANT]
> The ONLY change is inserting `setShowLoginModal,` between `setShowLimitModal,` and `setVoteModal,` on what is currently line 13.

### Safety Check

```bash
# 1. Build check
npm run build 2>&1 | grep -i "error"

# 2. Functional check — open http://localhost:3000/discover
#    - Make sure you are LOGGED OUT
#    - Find a business with a shield icon (shield_level >= 1)
#    - Click the 👎 "Complain" button on that business
#    ✅ PASS: Login modal appears
#    ❌ FAIL: Console shows "setShowLoginModal is not a function"

# 3. Regression check — verify voting still works for logged-in users
#    - Log in, go to /discover, click 👍 Recommend on any business
#    ✅ PASS: Inline vote panel expands, submit works
```

---

## Task #10 — Resolve `mathEngine.js` vs `mathEngine.ts` Conflict

### Files to Open

1. `src/lib/mathEngine.js` (58 lines — **DELETE THIS FILE**)
2. `src/lib/mathEngine.ts` (55 lines — **KEEP THIS FILE**)
3. `src/app/(consumer)/discover/page.jsx` (the only file that imports it)

### The Problem

Two versions of the math engine exist:

| File | What it does | Signature |
|------|-------------|-----------|
| `mathEngine.js` | Simple percentage: `recommends / total * 100`. Takes a **business object**. | `calculateBusinessScore(business)` → `number` |
| `mathEngine.ts` | Weighted average per AGENTS.md spec. Takes a **logs array**. | `calculateBusinessScore(logs)` → `{rawRecommends, rawComplains, gaderIndex, ...}` |

The `.ts` version follows the Tagdeer brand rules (weighted average where Verified logs have weight `1 + (Points / 1000)`). The `.js` version is a legacy simplification.

**Only one file imports `mathEngine`:** `src/app/(consumer)/discover/page.jsx` at line 6:
```jsx
import { calculateBusinessScore } from '@/lib/mathEngine';
```

Currently this import resolves to the `.js` file (Next.js resolution order: `.js` > `.ts` when both exist). After deleting `.js`, it will resolve to `.ts`.

### Step-by-Step Fix

#### Step 1: Verify the `.ts` version is the correct one

Open `src/lib/mathEngine.ts` and confirm it contains the **weighted formula** at lines 22–24:

```ts
if (log.is_verified && log.trust_points !== undefined && log.trust_points !== null) {
    weight = 1 + (log.trust_points / 1000);
}
```

✅ This matches the AGENTS.md spec.

#### Step 2: Delete the `.js` version

```bash
# From project root:
rm src/lib/mathEngine.js
```

#### Step 3: Update the import in discover page

Open `src/app/(consumer)/discover/page.jsx` — **line 224** currently calls:

```jsx
const { rawRecommends, rawComplains } = calculateBusinessScore(business.logs || []);
```

This call is already passing `logs` (an array), which matches the `.ts` signature `calculateBusinessScore(logs: Log[])`. **No change needed to line 224.**

However, verify the import at **line 6** still works:

```jsx
import { calculateBusinessScore } from '@/lib/mathEngine';
```

After deleting `.js`, Next.js will resolve this to `mathEngine.ts` automatically. **No import change needed.**

#### Step 4: Check that NO other files import from mathEngine.js

```bash
# Run this from project root:
grep -rn "from.*mathEngine" src/ --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx'
```

**Expected output:** Only `src/app/(consumer)/discover/page.jsx:6` should appear.

If ANY other files show up, verify they use the `.ts` signature `(logs: Log[])` and not the `.js` signature `(business)`.

### Safety Check

```bash
# 1. Build check — CRITICAL (will catch type mismatches)
npm run build 2>&1 | grep -i "error"

# 2. Unit test check
npx vitest run src/lib/mathEngine

# 3. Functional check — open http://localhost:3000/discover
#    - Look at any business card's Gader Index score
#    ✅ PASS: Scores display with recommend/complain counts
#    ❌ FAIL: NaN or blank where scores should be
```

---

## Task #11 — Delete `playwright.config.ts`, Consolidate E2E Tests

### Files to Open / Manage

1. `playwright.config.ts` (83 lines — **DELETE THIS FILE**)
2. `playwright.config.js` (29 lines — **KEEP THIS FILE**)
3. `e2e/example.spec.ts` — **DELETE** (Playwright boilerplate)
4. `e2e/financial_engine_flow.spec.js` — **MOVE to `tests/e2e/`**
5. `tests/e2e/temp_screenshot.spec.js` — **DELETE** (debug artifact)

### The Problem

Two Playwright configs exist:

| File | `testDir` | Browsers | Issue |
|------|-----------|----------|-------|
| `playwright.config.js` | `./tests/e2e` | chromium only | ✅ Correct — project's real config |
| `playwright.config.ts` | `./e2e` | chromium + firefox + webkit | ❌ Vite scaffold — points to wrong dir, loads `.env.local` |

The `.ts` file wins over `.js` in Playwright resolution, so running `npx playwright test` uses the wrong config.

The `e2e/` directory contains:
- `example.spec.ts` — Default Playwright boilerplate that tests `playwright.dev`. **Not a project test.**
- `financial_engine_flow.spec.js` — Real test. **Must be moved.**

The `tests/e2e/` directory contains:
- `auth.spec.js` — Real test. **Keep.**
- `temp_screenshot.spec.js` — Debug artifact. **Delete.**

### Step-by-Step Fix

#### Step 1: Move the real test from `e2e/` into `tests/e2e/`

```bash
# From project root:
mv e2e/financial_engine_flow.spec.js tests/e2e/financial_engine_flow.spec.js
```

#### Step 2: Delete the junk files

```bash
# Delete the boilerplate spec
rm e2e/example.spec.ts

# Delete the debug spec
rm tests/e2e/temp_screenshot.spec.js

# Delete the empty e2e directory
rmdir e2e
```

#### Step 3: Delete the wrong Playwright config

```bash
rm playwright.config.ts
```

#### Step 4: Verify `playwright.config.js` is intact

Open `playwright.config.js` and confirm:
- **Line 5:** `testDir: './tests/e2e',` (correct directory)
- **Line 14:** `baseURL: 'http://localhost:3000',`

### Safety Check

```bash
# 1. Verify Playwright now uses the .js config
npx playwright test --list
# ✅ PASS: Shows tests from tests/e2e/ (auth.spec.js and financial_engine_flow.spec.js)
# ❌ FAIL: Shows tests from e2e/ or "no tests found"

# 2. Verify no leftover files
ls e2e/ 2>&1
# ✅ PASS: "No such file or directory"

ls tests/e2e/
# ✅ PASS: Shows auth.spec.js and financial_engine_flow.spec.js

# 3. Build check
npm run build 2>&1 | grep -i "error"
```

---

## Task #12 — Fix ESLint Glob to Include JS/JSX Files

### File to Open

`eslint.config.js`

### The Problem

**Line 10** only targets TypeScript files:

```js
files: ['**/*.{ts,tsx}'],
```

The vast majority of the codebase is `.js` and `.jsx`. ESLint currently scans **none** of those files.

### The Fix

**Replace line 10** with:

```js
files: ['**/*.{js,jsx,ts,tsx}'],
```

### Full File After Fix (for reference)

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.next']),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
```

> [!WARNING]
> After making this change, running `npx eslint .` will likely produce many new warnings/errors from JS files that were previously invisible. This is expected and correct — those errors always existed, they just weren't being caught. Do NOT revert this change because of new warnings.

### Safety Check

```bash
# 1. Test that ESLint now scans JS files
npx eslint src/app/\(consumer\)/profile/page.jsx --max-warnings 999
# ✅ PASS: Outputs lint results (warnings are OK, but it should NOT say "0 files linted")

# 2. Build check (ESLint config doesn't affect build)
npm run build 2>&1 | grep -i "error"
```

---

## Task #13 — Fix CI Branch Pattern (`feature/*` → `feat/*`)

### File to Open

`.github/workflows/test.yml`

### The Problem

**Line 5** uses the branch pattern `feature/*`:

```yaml
on:
  push:
    branches: [main, feature/*]
```

But the team's actual branch naming convention uses `feat/*` (e.g., `feat/dynamic-pricing-sync`, `feat/subscription-core`). This means CI never runs on any feature branches.

### The Fix

**Replace line 5** with both patterns to cover existing and future branches:

```yaml
    branches: [main, feat/*, feature/*]
```

### Full `on:` Block After Fix

```yaml
on:
  push:
    branches: [main, feat/*, feature/*]
  pull_request:
    branches: [main]
```

### Safety Check

```bash
# 1. YAML syntax check
npx yaml-lint .github/workflows/test.yml 2>/dev/null || python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test.yml'))"
# ✅ PASS: No syntax errors

# 2. Verify the pattern matches your current branch
git branch --show-current
# Should output something like "feat/dynamic-pricing-sync"
# Confirm this would match "feat/*" ✅

# 3. No build impact — this file only affects GitHub Actions
```

---

## Task #14 — Fix or Remove Broken `playwright.yml` Workflow

### File to Open

`.github/workflows/playwright.yml`

### The Problem

This workflow has **two critical issues:**

1. **Line 20–21:** It runs `npx playwright test` without starting the dev server first. Tests will fail because nothing is running on `localhost:3000`.
2. **Lines 3–6:** It triggers on `main` and `master` only, not on `feat/*` branches.
3. **It's redundant** — `test.yml` already has a properly configured E2E job (with `npm run build`, `npm run start`, and `npx wait-on`).

### Recommended Fix: Delete the File

Since `test.yml` already handles E2E tests correctly (it builds, starts the server, waits for it, then runs Playwright), this duplicate workflow should be removed:

```bash
# From project root:
rm .github/workflows/playwright.yml
```

### Alternative Fix (If You Want to Keep It)

If the team wants to keep a separate Playwright workflow, **replace the entire file** with this corrected version:

```yaml
name: Playwright Tests
on:
  push:
    branches: [main, feat/*, feature/*]
  pull_request:
    branches: [main]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - name: Install dependencies
      run: npm ci
    - name: Install Playwright Browsers
      run: npx playwright install --with-deps chromium
    - name: Build application
      run: npm run build
    - name: Start server & run tests
      run: |
        npm run start &
        npx wait-on http://localhost:3000 --timeout 30000
        npx playwright test
    - uses: actions/upload-artifact@v4
      if: ${{ !cancelled() }}
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 7
```

> [!CAUTION]
> If you **delete** this file (recommended), make sure `test.yml` has the E2E job. Open `.github/workflows/test.yml` and verify the `e2e-tests` job exists (lines 33–69). If it does, you're safe to delete `playwright.yml`.

### Safety Check

```bash
# 1. Verify test.yml still has e2e coverage
grep -c "playwright" .github/workflows/test.yml
# ✅ PASS: Returns a number > 0

# 2. Verify no broken workflow references
ls .github/workflows/
# ✅ PASS: Shows test.yml (and optionally the fixed playwright.yml, but NOT the broken one)

# 3. No local build impact — workflows only run in GitHub Actions
```

---

## Post-Phase-2 Global Safety Check

After completing ALL tasks above, run this final verification:

```bash
# 1. Full build — must pass with zero errors
npm run build

# 2. All unit tests — must pass
npx vitest run

# 3. Playwright test list (don't run full suite, just verify config)
npx playwright test --list

# 4. Check for broken imports
grep -rn "from.*mathEngine.js" src/ --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx'
# ✅ PASS: No results (nobody should import with explicit .js extension)

# 5. Auth smoke test — navigate these routes and confirm no crashes:
#    - http://localhost:3000/           (consumer home)
#    - http://localhost:3000/discover   (discover page — Task #9)
#    - http://localhost:3000/profile    (profile page — Task #8)
#    - http://localhost:3000/merchant   (merchant portal)
#    - http://localhost:3000/admin      (admin portal)
```

> [!IMPORTANT]
> If ANY of the above fail, STOP and report which task caused the regression before proceeding.
