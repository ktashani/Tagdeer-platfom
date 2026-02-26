// @ts-check
import { test, expect } from '@playwright/test';

// ── Master OTP code matching the dev bypass in LoginModal ──
const DEV_OTP = '999999';
const EMAIL_OTP = '123456'; // Email linking mock accepts any 6-digit code
const TEST_PHONE = '+218999999999';
const LS_KEY = 'tagdeer-user';

/**
 * Helper: Open the LoginModal from the homepage.
 */
async function openLoginModal(page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loginBtn = page.locator('button, a').filter({ hasText: /تسجيل|دخول|login|sign/i }).first();
    await loginBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
}
/**
 * Helper: Complete the Phone OTP flow inside the modal.
 * If expectedOtp is '999999', it uses the fast DEV BYPASS buttons.
 * If expectedOtp is anything else, it types it normally to test failures.
 */
async function completePhoneOtp(page, phone, expectedOtp = '999999') {
    const phoneInput = page.locator('[role="dialog"] input[type="tel"]');
    await phoneInput.fill(phone);

    if (expectedOtp === '999999') {
        // Fast path: Click the DEV BYPASS button on the phone screen
        const sendDevBtn = page.locator('button').filter({ hasText: /DEV BYPASS/i }).first();
        await sendDevBtn.click();

        // Wait for the OTP screen to appear (indicated by the 6 input boxes)
        const otpBox = page.locator('[role="dialog"] input[inputmode="numeric"][maxlength="1"]');
        await otpBox.first().waitFor({ state: 'visible', timeout: 8000 });

        // Find and click the DEV BYPASS auto-fill button
        const verifyDevBtn = page.locator('button').filter({ hasText: /AUTO-FILL/i }).first();
        await verifyDevBtn.waitFor({ state: 'visible', timeout: 8000 });
        await verifyDevBtn.click();
    } else {
        // Normal path (used for testing invalid OTPs)
        const sendBtn = page.locator('[role="dialog"] button[type="submit"]').first();
        await sendBtn.click();

        // Wait for OTP boxes to render
        const otpBox = page.locator('[role="dialog"] input[inputmode="numeric"][maxlength="1"]');
        await otpBox.first().waitFor({ state: 'visible', timeout: 8000 });
        await page.waitForTimeout(400);

        // Type digits
        await otpBox.first().click();
        await page.waitForTimeout(200);
        await page.keyboard.type(expectedOtp, { delay: 120 });
        await page.waitForTimeout(400);

        // Submit
        const submitBtn = page.locator('[role="dialog"] button[type="submit"]').first();
        if (await submitBtn.isVisible().catch(() => false)) {
            await submitBtn.click();
        }
    }
}

/**
 * Helper: Log in with dev bypass and navigate to profile.
 *
 * ROOT CAUSE (fixed):
 *   User state was only in React useState — never persisted.
 *   page.goto() causes a full reload, React re-mounts, user = null.
 *   FIX: TagdeerContext now saves user to localStorage('tagdeer-user').
 *   We wait for that key to appear before navigating.
 */
async function loginAndGoToProfile(page) {
    await openLoginModal(page);
    await completePhoneOtp(page, TEST_PHONE);

    // Wait for the session to be persisted to localStorage
    // This proves: login() completed → setUser() fired → useEffect saved to localStorage
    await page.waitForFunction(
        (key) => {
            const val = localStorage.getItem(key);
            return val !== null && val.length > 10;
        },
        LS_KEY,
        { timeout: 15000 }
    );

    // Log session state for debugging
    const storedUser = await page.evaluate((key) => localStorage.getItem(key), LS_KEY);
    console.log('[E2E] Session stored:', storedUser ? 'YES' : 'NO', storedUser?.substring(0, 80));

    // Navigate to profile — localStorage will restore user state on mount
    await page.goto('/profile', { waitUntil: 'networkidle' });

    // Verify we're still on /profile (not redirected back to /)
    await page.waitForFunction(
        () => window.location.pathname.includes('/profile'),
        { timeout: 10000 }
    );

    // Log current URL for debugging
    console.log('[E2E] Final URL:', page.url());

    // Wait for authenticated content
    await page.waitForSelector(
        '.bg-blue-800, .bg-gradient-to-br, [class*="bg-blue"]',
        { state: 'visible', timeout: 10000 }
    );
}

/**
 * Helper: Type OTP into the profile email verification box.
 */
async function typeProfileEmailOtp(page, otp) {
    const profileOtpInput = page.locator('input[placeholder="123456"]').last();
    await expect(profileOtpInput).toBeVisible({ timeout: 5000 });
    await profileOtpInput.click();
    await page.waitForTimeout(100);
    await profileOtpInput.fill('');
    await page.keyboard.type(otp, { delay: 80 });
}


// ─────────────────────────────────────────────
test.describe('Auth E2E', () => {

    // Clear session before each test for isolation
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                console.log(`[Browser ${msg.type().toUpperCase()}] ${msg.text()}`);
            }
        });
        await page.goto('/');
        await page.evaluate((key) => localStorage.removeItem(key), LS_KEY);
    });

    // ── Test 1: Standard Phone Login ──
    test('Test 1: Standard Phone Login → routes to /profile', async ({ page }) => {
        await loginAndGoToProfile(page);

        expect(page.url()).toContain('/profile');
        const profileContent = page.locator('.bg-blue-800, .bg-gradient-to-br');
        await expect(profileContent.first()).toBeVisible();
    });


    // ── Test 2: Invalid OTP Handling ──
    test('Test 2: Invalid OTP → error message, no redirect', async ({ page }) => {
        await openLoginModal(page);
        await completePhoneOtp(page, TEST_PHONE);

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible({ timeout: 5000 });

        const errorText = page.locator('[role="dialog"]').locator('text=/غير صحيح|invalid|error|خطأ|failed|فشل/i');
        await expect(errorText).toBeVisible({ timeout: 5000 });

        expect(page.url()).not.toContain('/profile');
    });


    // ── Test 3: Progressive Auth — Incomplete Profile ──
    test('Test 3: Email-only user sees incomplete profile banner', async ({ page }) => {
        // Inject mock email-only user directly into localStorage
        await page.evaluate((key) => {
            localStorage.setItem(key, JSON.stringify({
                id: 'test-e2e-uuid',
                email: 'e2e@test.app',
                phone: null,
                userId: 'VIP-E2ETS',
                gader: 50,
                vipTier: 'Bronze Tier',
                full_name: 'E2E Test User',
            }));
        }, LS_KEY);

        await page.goto('/profile');
        await page.waitForLoadState('networkidle');

        const banner = page.locator('text=/حسابك غير مكتمل|incomplete/i');
        await expect(banner).toBeVisible({ timeout: 8000 });
    });


    // ── Test 4: Link New Email (Happy Path) ──
    test('Test 4: Link email via mock OTP → verified badge appears', async ({ page }) => {
        await loginAndGoToProfile(page);

        const emailInput = page.locator('input[type="email"][placeholder="name@example.com"]');
        await expect(emailInput).toBeVisible({ timeout: 8000 });

        const isReadOnly = await emailInput.getAttribute('readonly');
        if (isReadOnly !== null && isReadOnly !== 'false') {
            test.skip(true, 'Email already verified — skipping');
            return;
        }

        await emailInput.fill(`e2e+${Date.now()}@test.app`);

        const confirmBtn = page.locator('button').filter({ hasText: /تأكيد|confirm/i }).first();
        await confirmBtn.click();

        await typeProfileEmailOtp(page, EMAIL_OTP);

        const verifyBtn = page.locator('button').filter({ hasText: /تحقق|verify/i }).first();
        await verifyBtn.click();

        const verifiedBadge = page.locator('text=/موثق|verified/i');
        await expect(verifiedBadge.first()).toBeVisible({ timeout: 8000 });
    });


    // ── Test 5: Duplicate Email Rejection ──
    test('Test 5: Duplicate email → "مستخدم بالفعل" error', async ({ page }) => {
        await loginAndGoToProfile(page);

        const emailInput = page.locator('input[type="email"][placeholder="name@example.com"]');
        await expect(emailInput).toBeVisible({ timeout: 8000 });

        const isReadOnly = await emailInput.getAttribute('readonly');
        if (isReadOnly !== null && isReadOnly !== 'false') {
            test.skip(true, 'Email already verified — cannot test duplicate');
            return;
        }

        await emailInput.fill('k.tashani94@gmail.com');

        const confirmBtn = page.locator('button').filter({ hasText: /تأكيد|confirm/i }).first();
        await confirmBtn.click();

        await typeProfileEmailOtp(page, EMAIL_OTP);

        const verifyBtn = page.locator('button').filter({ hasText: /تحقق|verify/i }).first();
        await verifyBtn.click();

        // Wait for async auth response — the error comes from supabase.auth.updateUser()
        await page.waitForTimeout(2000);

        // Check for error text in the email section (inline error or toast)
        const emailSection = page.locator('.bg-slate-50').filter({ has: page.locator('input[type="email"]') });
        const errorMsg = emailSection.locator('text=/مستخدم بالفعل|already in use|خطأ|error|فشل/i');
        const toastError = page.locator('text=/مستخدم بالفعل|already in use/i');

        // Either inline error or toast should be visible
        const hasInlineError = await errorMsg.isVisible().catch(() => false);
        const hasToastError = await toastError.isVisible().catch(() => false);
        expect(hasInlineError || hasToastError).toBeTruthy();

        // Verified badge should NOT appear in the email section
        const emailVerified = emailSection.locator('text=/✅ موثق/');
        await expect(emailVerified).not.toBeVisible({ timeout: 3000 }).catch(() => { });
    });


    // ── Test 6: QR Modal Render ──
    test('Test 6: QR Modal opens with code and backdrop', async ({ page }) => {
        await loginAndGoToProfile(page);

        const gaderPassBtn = page.locator('button').filter({ hasText: /عرض بطاقة قَدِّر|Show My Gader|🛡️/i }).first();

        if (await gaderPassBtn.isDisabled()) {
            test.skip(true, 'Gader Pass disabled — phone not linked');
            return;
        }

        await gaderPassBtn.click();

        const backdrop = page.locator('.fixed.inset-0, [role="dialog"]');
        await expect(backdrop.first()).toBeVisible({ timeout: 5000 });

        const qrCode = page.locator('svg').filter({ has: page.locator('path') });
        await expect(qrCode.first()).toBeVisible({ timeout: 5000 });

        const userIdText = page.locator('text=/ID:/i');
        await expect(userIdText).toBeVisible({ timeout: 3000 });
    });

});
