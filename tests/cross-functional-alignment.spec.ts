import { test, expect } from '@playwright/test';

// Use this mock user phone for the E2E bypass
const E2E_PHONE = '+218999999999';

test.describe('Tagdeer Cross-Functional Alignment Tests', () => {

    test('Consumer: Dev Bypass Login & VIP Status Allocation', async ({ page }) => {
        await page.goto('/');

        // Ensure the banner CTA works
        await page.click('text=Earn Rewards');

        // Enter E2E phone number
        await page.fill('input[placeholder*=""]', E2E_PHONE); // Note: selector might need precision

        // Submit the login
        await page.click('button:has-text("Send VIP Code")'); // Mocks immediate bypass

        // Expect the system to immediately bypass to logged-in state without OTP 
        // because +218999999999 is hardcoded in TagdeerContext.js
        await expect(page.locator('text=VIP-E2ETST')).toBeVisible({ timeout: 5000 });
    });

    test('Consumer: Trust Shield Blocking Logic', async ({ page, context }) => {
        // 1. Verify anonymous state (don't log in)
        await page.goto('/');

        // 2. Click Complain on a Shielded Business (e.g. Al-Madina Tech which is shielded by default)
        // In actual implementation, we'd add data-testid="complain-business-1"
        const shieldedBusinessComplainBtn = page.locator('button').filter({ hasText: 'Complain' }).first();
        await shieldedBusinessComplainBtn.click();

        // 3. Expect a toast indicating Shield protection
        await expect(page.locator('text=You must be a verified VIP')).toBeVisible();

        // 4. Test anonymous vote limit (3 votes max)
        // We mock the localstorage 'trust_ledger_interactions' to 3.
        await page.evaluate(() => {
            window.localStorage.setItem('trust_ledger_interactions', '3');
        });

        // Attempt to recommend another unshielded business
        await page.goto('/');
        const unshieldedRecommendBtn = page.locator('button').filter({ hasText: 'Recommend' }).nth(1);
        await unshieldedRecommendBtn.click();

        // The Global limitation limit modal must appear
        await expect(page.locator('text=Guest Limit Reached')).toBeVisible();
    });

    // Flow: Test QR Scanning Across Tabs (Multi-page test context)
    test('Merchant <-> Consumer QR Code Redemption Flow', async ({ browser }) => {
        // Create two isolated contexts for Merchant and Consumer
        const consumerContext = await browser.newContext();
        const merchantContext = await browser.newContext();

        const consumerPage = await consumerContext.newPage();
        const merchantPage = await merchantContext.newPage();

        // -- 1. Setup Merchant --
        await merchantPage.goto('/merchant/login');
        // Using bypass login for merchant (token: 999999)
        await merchantPage.fill('input[type="tel"]', '12345678');
        await merchantPage.click('button:has-text("Send Code")');
        await merchantPage.fill('input[placeholder="• • • • • •"]', '999999');
        await merchantPage.click('button:has-text("Verify Secure Login")');

        // Navigate to Merchant Scanner
        await merchantPage.goto('/merchant/dashboard');
        await merchantPage.click('text=Terminal'); // Assuming there's a quick launch button

        // -- 2. Setup Consumer --
        await consumerPage.goto('/');
        // Login as consumer using bypass
        await consumerPage.click('text=Earn Rewards');
        await consumerPage.fill('input[placeholder*=""]', E2E_PHONE);
        await consumerPage.click('button:has-text("Send VIP Code")');

        // Open Gader Pass to reveal QR payload
        await consumerPage.click('text=Gader Pass');
        await expect(consumerPage.locator('svg[xmlns="http://www.w3.org/2000/svg"]')).toBeVisible();

        // In a real automated test we'd extract the QR Code URL to scan it,
        // but here we simulate the merchant manually inputting the 6 digit alphanumeric bypass code
        const devBypassCode = 'mock-user-id'; // using the scanner dev bypass

        // -- 3. Cross portal test --
        await merchantPage.click('button:has-text("Enter Code")');
        await merchantPage.fill('input[placeholder="e.g. A49X-8M"]', devBypassCode);
        await merchantPage.click('button:has-text("Verify Code")');

        // Verify merchant gets success message
        await expect(merchantPage.locator('text=Verification Successful!')).toBeVisible();

        // Push highly-rated coupon
        await merchantPage.click('button:has-text("Push Instant Coupon")');

        await consumerContext.close();
        await merchantContext.close();
    });

});
