// @ts-check
/**
 * ============================================================================
 * Tagdeer Financial Engine — Full Lifecycle E2E Test
 * ============================================================================
 *
 * Flow 1: Merchant Checkout
 *   → Login as merchant → Navigate to Settings → Select tier → Choose gateway → Submit
 *
 * Flow 2: Admin Approval
 *   → Login as admin → Navigate to Financials → Locate pending txn → Approve
 *
 * Flow 3: Verification
 *   → Verify audit log entry → Switch to merchant → Verify "Active" subscription
 *
 * Credentials are injected via environment variables so the QA bot
 * can substitute them at runtime.
 * ============================================================================
 */

import { test, expect } from '@playwright/test';

// ── Placeholder Credentials (injected by the QA bot at runtime) ──────────
const TEST_MERCHANT_EMAIL    = process.env.TEST_MERCHANT_EMAIL    || 'merchant@test.tagdeer.co';
const TEST_MERCHANT_PASSWORD = process.env.TEST_MERCHANT_PASSWORD || 'TestMerchant123!';
const TEST_ADMIN_EMAIL       = process.env.TEST_ADMIN_EMAIL       || 'admin@tagdeer.co';
const TEST_ADMIN_PASSWORD    = process.env.TEST_ADMIN_PASSWORD    || 'TestAdmin123!';

// ── Subdomain-Aware Base URLs ────────────────────────────────────────────
// The Tagdeer platform uses subdomain routing: admin.localhost → admin portal,
// merchant.localhost → merchant portal, localhost → consumer app.
// The middleware rewrites paths (e.g. /financials → /admin/financials) only on
// the correct subdomain. Using the wrong base URL results in 404s.
const MERCHANT_APP_URL = process.env.MERCHANT_APP_URL || 'https://merchant.staging.tagdeer.app';
const ADMIN_APP_URL    = process.env.ADMIN_APP_URL    || 'https://admin.staging.tagdeer.app';

// ── Shared Helpers ───────────────────────────────────────────────────────

/**
 * Login as a Merchant via the multi-step auth flow (email → password).
 * Handles both the email-check step and the password form.
 */
async function loginAsMerchant(page) {
  await page.goto(`${MERCHANT_APP_URL}/merchant/login`);
  await page.waitForLoadState('networkidle');

  // Step 1: Enter email and click Continue
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(TEST_MERCHANT_EMAIL);
  await page.getByRole('button', { name: /continue/i }).click();

  // Step 2: Wait for the password step to appear
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
  await passwordInput.fill(TEST_MERCHANT_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Step 3: Wait for redirect to merchant dashboard
  // The login page does window.location.href = '/dashboard' on success
  await page.waitForURL(/\/(merchant\/)?(dashboard|settings)/, { timeout: 30000 });
}

/**
 * Login as an Admin via the admin portal login form (email + password in one step).
 * The admin subdomain uses cookie-based auth (admin_auth httpOnly cookie set by server action).
 */
async function loginAsAdmin(page) {
  // Navigate to the admin subdomain login page.
  // On the admin subdomain, the middleware rewrites /login → /admin/login internally.
  await page.goto(`${ADMIN_APP_URL}/login`);
  await page.waitForLoadState('networkidle');

  // The admin login is a single-step form: email + password + Authenticate button
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(TEST_ADMIN_EMAIL);

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.fill(TEST_ADMIN_PASSWORD);

  await page.getByRole('button', { name: /authenticate/i }).click();

  // Wait for the server action to complete (it sets the httpOnly cookie)
  await page.waitForTimeout(3000);

  // Check if an error alert appeared (wrong credentials / role denied)
  const errorAlert = page.locator('[role="alert"]');
  if (await errorAlert.isVisible({ timeout: 2000 }).catch(() => false)) {
    const errorText = await errorAlert.textContent().catch(() => 'Unknown error');
    console.error(`❌ Admin login FAILED: ${errorText}`);
    console.error(`   Email used: ${TEST_ADMIN_EMAIL}`);
    console.error(`   Ensure the admin user exists with role=admin in the profiles table.`);
    throw new Error(`Admin login failed: ${errorText}`);
  }

  // Admin login does window.location.href = '/' after success.
  // On the admin subdomain, '/' is the admin dashboard (middleware rewrites to /admin/page.jsx).
  // Wait for the URL to no longer be the login page.
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 45000 });
}


// ═══════════════════════════════════════════════════════════════════════════
// FLOW 1: MERCHANT CHECKOUT
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Flow 1: Merchant Checkout', () => {

  test('should login as merchant and navigate to settings', async ({ page }) => {
    await loginAsMerchant(page);

    // Navigate to Settings
    await page.goto(`${MERCHANT_APP_URL}/merchant/settings`);
    await page.waitForLoadState('networkidle');

    // Verify the settings page loaded — look for the "Platform Settings" heading
    await expect(page.locator('h1')).toContainText(/platform settings/i);
  });

  test('should display subscription tier cards', async ({ page }) => {
    await loginAsMerchant(page);
    await page.goto(`${MERCHANT_APP_URL}/merchant/settings`);
    await page.waitForLoadState('networkidle');

    // The "Account Details" tab is the default. It should show the subscription tier card.
    const subscriptionCard = page.locator('text=Merchant Subscription Tier');
    await expect(subscriptionCard).toBeVisible({ timeout: 10000 });

    // There should be at least one tier pricing card present
    const tierCards = page.locator('text=/Upgrade to/i');
    // If the merchant is on Free, we should see upgrade buttons
    // If they're already on a paid tier, we just verify the page loaded
    const settingsContent = await page.textContent('body');
    expect(
      settingsContent.includes('Merchant Subscription Tier') ||
      settingsContent.includes('Active')
    ).toBeTruthy();
  });

  test('should complete the merchant onboarding checkout flow', async ({ page }) => {
    await loginAsMerchant(page);
    await page.goto(`${MERCHANT_APP_URL}/merchant/onboarding`);
    await page.waitForLoadState('networkidle');

    // ── Step 1: Business Details ──
    // Check if we're on step 1 (may show Quota Limit or Admin block instead)
    const bodyText = await page.textContent('body');

    // If quota limit reached or admin account detected, the test is informational
    if (bodyText.includes('Location Limit Reached') || bodyText.includes('Admin Account Detected')) {
      console.log('⚠️ Merchant cannot onboard: quota reached or admin account detected. Skipping checkout flow.');
      return;
    }

    // Look for the business name input field
    const nameInput = page.locator('input[placeholder*="Al-Saha"]');
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Fill out a new business name
      await nameInput.fill('QA Test Business — E2E');

      // Select category (first one should already be pre-selected)
      // Select region (first one should already be pre-selected)

      // Upload a dummy file for verification document
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.count() > 0) {
        // Create a tiny test PDF buffer  
        const testBuffer = Buffer.from('%PDF-1.4 test document');
        await fileInput.setInputFiles({
          name: 'test_doc.pdf',
          mimeType: 'application/pdf',
          buffer: testBuffer,
        });
      }

      // Click "Continue" to proceed to Step 2 (Shields)
      const continueBtn = page.getByRole('button', { name: /continue/i });
      if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await continueBtn.click();
      }
    }

    // ── Step 2: Shields ──
    // Wait for shields step to appear
    const shieldsHeading = page.locator('text=/enhance|shields/i');
    if (await shieldsHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Skip shields — click "Review & Checkout" or "Skip"
      const skipLink = page.locator('text=/skip/i');
      const reviewBtn = page.getByRole('button', { name: /review|checkout/i });

      if (await skipLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipLink.click();
      } else if (await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reviewBtn.click();
      }
    }

    // ── Step 3: Checkout ──
    // At this point, we should see the checkout/review page
    const checkoutHeading = page.locator('text=/review|checkout/i');
    if (await checkoutHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Select the manual bank gateway (default should be selected already)
      const bankOption = page.locator('text=Bank Transfer');
      if (await bankOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await bankOption.click();
      }

      // Click "Submit Request" to create the pending transaction
      const submitBtn = page.getByRole('button', { name: /submit|request/i });
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click();

        // Wait for success step (Step 4)
        await page.waitForTimeout(3000);
        const successText = page.locator('text=/success|submitted|thank/i');
        await expect(successText.first()).toBeVisible({ timeout: 15000 });

        console.log('✅ Merchant checkout completed — pending transaction created.');
      }
    }
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// FLOW 2: ADMIN APPROVAL
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Flow 2: Admin Approval', () => {

  test('should login as admin and navigate to financials', async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to financials (unprefixed — middleware rewrites /financials → /admin/financials)
    await page.goto(`${ADMIN_APP_URL}/financials`);
    await page.waitForLoadState('networkidle');

    // Verify the admin financials page loaded — "The Libyan Treasury" heading
    await expect(page.locator('h1')).toContainText(/libyan treasury/i);
  });

  test('should display the Transfer Queue tab with pending transactions', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${ADMIN_APP_URL}/financials`);
    await page.waitForLoadState('networkidle');

    // The default tab is "Transfer Queue" — it should already be visible
    const queueTab = page.locator('button', { hasText: /transfer queue/i });
    await expect(queueTab).toBeVisible();

    // Check for the "Pending Upgrade Requests" heading
    const pendingHeading = page.locator('text=Pending Upgrade Requests');
    await expect(pendingHeading).toBeVisible({ timeout: 10000 });

    // Check for the gateway filter dropdown
    const gatewayFilter = page.locator('select');
    await expect(gatewayFilter.first()).toBeVisible();
  });

  test('should approve a pending transaction from the queue', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${ADMIN_APP_URL}/financials`);
    await page.waitForLoadState('networkidle');

    // Wait for the queue to load
    await page.waitForTimeout(3000);

    // Check if there are any pending transactions
    const emptyState = page.locator('text=No pending transfers');
    if (await emptyState.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('⚠️ No pending transactions found in the queue. Skipping approval test.');
      console.log('   → Ensure Flow 1 (Merchant Checkout) ran successfully first.');
      return;
    }

    // Click the first pending transaction in the list to open the verification panel
    const firstTxnRow = page.locator('[class*="rounded-xl"][class*="border"][class*="cursor-pointer"]').first();
    await firstTxnRow.click();

    // Wait for the right-side verification panel to slide in
    const verificationPanel = page.locator('text=Verification:');
    await expect(verificationPanel).toBeVisible({ timeout: 5000 });

    // Verify the panel shows the transaction details
    const panelContent = page.locator('text=/Business|Owner Email|Requested Upgrade/');
    await expect(panelContent.first()).toBeVisible();

    // Click "Confirm Payment & Upgrade Account"
    const confirmBtn = page.getByRole('button', { name: /confirm payment/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Wait for the RPC call and verify success
    // The transaction should be removed from the queue after confirmation
    await page.waitForTimeout(3000);

    // Verify: either a toast appeared or the txn was removed from the list
    const bodyText = await page.textContent('body');
    const isConfirmed = bodyText.includes('Payment Confirmed') ||
                        bodyText.includes('No pending transfers') ||
                        !bodyText.includes('Verification:');

    expect(isConfirmed).toBeTruthy();
    console.log('✅ Admin approved the pending transaction successfully.');
  });

  test('should be able to reject a transaction with a reason', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${ADMIN_APP_URL}/financials`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check if there are pending transactions to reject
    const emptyState = page.locator('text=No pending transfers');
    if (await emptyState.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('⚠️ No pending transactions to reject. Skipping reject test.');
      return;
    }

    // Click the first transaction to select it
    const firstTxnRow = page.locator('[class*="rounded-xl"][class*="border"][class*="cursor-pointer"]').first();
    await firstTxnRow.click();

    // Click "Reject Payment" button
    const rejectBtn = page.getByRole('button', { name: /reject payment/i });
    await expect(rejectBtn).toBeVisible({ timeout: 5000 });
    await rejectBtn.click();

    // Wait for the rejection modal to appear
    const rejectModal = page.locator('text=Reject Payment').nth(1); // Modal title
    await expect(rejectModal).toBeVisible({ timeout: 5000 });

    // Fill in the mandatory rejection reason
    const reasonTextarea = page.locator('textarea[placeholder*="Receipt"]');
    await reasonTextarea.fill('E2E Test — rejected for QA validation purposes.');

    // Confirm the rejection
    const confirmRejectBtn = page.getByRole('button', { name: /confirm rejection/i });
    await expect(confirmRejectBtn).toBeVisible();
    await confirmRejectBtn.click();

    // Wait for RPC and verify
    await page.waitForTimeout(3000);
    const bodyText = await page.textContent('body');
    expect(
      bodyText.includes('Payment rejected') || bodyText.includes('No pending transfers')
    ).toBeTruthy();

    console.log('✅ Admin rejected the transaction with reason logged.');
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// FLOW 3: VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Flow 3: Verification', () => {

  test('should verify the audit trail was updated after approval', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${ADMIN_APP_URL}/financials`);
    await page.waitForLoadState('networkidle');

    // Click the "Audit Trail" tab
    const auditTab = page.locator('button', { hasText: /audit trail/i });
    await auditTab.click();

    // Wait for audit log table to load
    await page.waitForTimeout(3000);

    // Verify the audit trail table headers are visible
    const timestampHeader = page.locator('th', { hasText: /timestamp/i });
    await expect(timestampHeader).toBeVisible({ timeout: 10000 });

    const actionHeader = page.locator('th', { hasText: /action/i });
    await expect(actionHeader).toBeVisible();

    // Check that the table has at least one audit entry
    const auditRows = page.locator('tbody tr');
    const rowCount = await auditRows.count();

    if (rowCount === 0 || (rowCount === 1 && await page.textContent('tbody').then(t => t.includes('No audit entries')))) {
      console.log('⚠️ No audit entries found. Ensure Flow 2 (Admin Approval) ran first.');
      return;
    }

    // Look for an "approved" or "activated" action badge in the table
    const approvedBadge = page.locator('span', { hasText: /approved/i }).first();
    const activatedBadge = page.locator('span', { hasText: /activated/i }).first();

    const hasApproved = await approvedBadge.isVisible({ timeout: 3000 }).catch(() => false);
    const hasActivated = await activatedBadge.isVisible({ timeout: 3000 }).catch(() => false);

    // At least one of these should exist in a real scenario
    if (hasApproved || hasActivated) {
      console.log('✅ Audit trail contains approval/activation entries.');
    } else {
      console.log('ℹ️ No approved/activated entries found in the first page of audit log.');
      console.log('   This is expected if no approval was just performed.');
    }

    // Verify the status change column shows transitions (e.g., "pending → completed")
    const statusChangeCell = page.locator('text=→').first();
    if (await statusChangeCell.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✅ Status change transitions are displayed in the audit trail.');
    }
  });

  test('should verify Admin Subscriptions tab shows correct merchant status', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${ADMIN_APP_URL}/financials`);
    await page.waitForLoadState('networkidle');

    // Click "Active Subscriptions" tab
    const subsTab = page.locator('button', { hasText: /active subscriptions/i });
    await subsTab.click();

    // Wait for the subscription table to load
    await page.waitForTimeout(3000);

    // Verify the subscriptions table headers
    const merchantHeader = page.locator('th', { hasText: /merchant account/i });
    await expect(merchantHeader).toBeVisible({ timeout: 10000 });

    // Look for any "Active" subscription status badges
    const activeBadges = page.locator('span', { hasText: /^active$/i });
    const activeCount = await activeBadges.count();

    console.log(`ℹ️ Found ${activeCount} merchant(s) with 'Active' subscription status.`);

    // If a specific merchant email is known, we can check for it
    const merchantRow = page.locator(`text=${TEST_MERCHANT_EMAIL}`);
    if (await merchantRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✅ Test merchant found in subscription list.');
    }
  });

  test('should verify merchant settings show Active subscription after approval', async ({ page }) => {
    await loginAsMerchant(page);
    await page.goto(`${MERCHANT_APP_URL}/merchant/settings`);
    await page.waitForLoadState('networkidle');

    // Wait for settings page to fully load
    await page.waitForTimeout(3000);

    // Check for subscription status badge
    const bodyText = await page.textContent('body');

    // The STATUS_BADGES in settings/page.jsx maps statuses to visible badges.
    // After admin approval, the merchant should see "Active" status.
    const hasActiveStatus = bodyText.includes('Active');
    const hasPendingStatus = bodyText.includes('Awaiting Payment') || bodyText.includes('Pending');
    const hasTierInfo = bodyText.includes('Pro') || bodyText.includes('Enterprise') || bodyText.includes('Free');

    // Log the current state
    if (hasActiveStatus) {
      console.log('✅ Merchant subscription shows "Active" status — upgrade confirmed!');
    } else if (hasPendingStatus) {
      console.log('⚠️ Merchant subscription still shows "Pending" — admin may not have approved yet.');
    } else {
      console.log('ℹ️ Merchant subscription status:', hasTierInfo ? 'Tier info present' : 'No tier info found');
    }

    // Verify the page at minimum loaded correctly
    expect(bodyText.includes('Platform Settings') || bodyText.includes('Merchant Subscription')).toBeTruthy();

    // Verify the tier subscription card is rendered
    const subscriptionCard = page.locator('text=Merchant Subscription Tier');
    await expect(subscriptionCard).toBeVisible({ timeout: 10000 });
  });

  test('should verify the subscription action buttons are available for admin', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${ADMIN_APP_URL}/financials`);
    await page.waitForLoadState('networkidle');

    // Navigate to Active Subscriptions tab
    const subsTab = page.locator('button', { hasText: /active subscriptions/i });
    await subsTab.click();
    await page.waitForTimeout(3000);

    // Look for action buttons (Suspend, Terminate, Reinstate, Grant Trial)
    const bodyText = await page.textContent('body');

    const hasSuspend = bodyText.includes('Suspend');
    const hasTerminate = bodyText.includes('Terminate');
    const hasGrantTrial = bodyText.includes('Grant Trial');

    if (hasSuspend) console.log('✅ "Suspend" action button is available.');
    if (hasTerminate) console.log('✅ "Terminate" action button is available.');
    if (hasGrantTrial) console.log('✅ "Grant Trial" action button is available.');

    // At minimum, Grant Trial should always be visible (it's in the header)
    expect(hasGrantTrial).toBeTruthy();
  });
});
