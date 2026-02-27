import { test, expect } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('Login & Screenshot Profile', async ({ page }) => {
    // Navigate to Login
    await page.goto('http://localhost:3000/login');
    
    // Trigger dev bypass modal
    await page.waitForSelector('button[aria-label="Toggle Dev Bypass"]', { timeout: 10000 });
    await page.click('button[aria-label="Toggle Dev Bypass"]');
    
    // Fill phone number
    await page.fill('input[type="tel"]', '+218999999999');
    await page.click('button:has-text("إرسال رمز التفعيل")'); // "Send verification code" in Arabic
    
    // Trigger dev bypass again
    await page.waitForSelector('button[aria-label="Toggle Dev Bypass Token"]', { timeout: 10000 });
    await page.click('button[aria-label="Toggle Dev Bypass Token"]');
    
    // Enter mock code
    await page.fill('input[type="text"]', '999999');
    await page.click('button:has-text("تحقق من الرمز")');
    
    // Wait for redirect to profile
    await page.waitForURL('**/profile', { timeout: 15000 });
    
    // Wait for new UI elements to load
    await page.waitForSelector('img[alt="User Avatar"]');
    await page.waitForSelector('text=20'); // Should show 20 points
    
    // Take a screenshot!
    await page.screenshot({ path: '.gemini/antigravity/brain/fc91c132-f6c7-4b7f-bf2c-ca0b6dc71821/profile_ui_test.png', fullPage: true });
});
