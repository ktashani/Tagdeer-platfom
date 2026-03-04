/**
 * Serial Code Generator for Tagdeer Coupons
 * Format: TAG-{MERCHANT_PREFIX}-{RANDOM_ALPHANUM}
 * Example: TAG-CAF-8X99AB
 */

/**
 * Generates a unique serial code for a coupon.
 * @param {string} businessName - The name of the business to derive the prefix.
 * @param {number} randomLength - Length of the random alphanumeric part (default 6).
 * @returns {string} - The generated serial code.
 */
export function generateCouponSerial(businessName, randomLength = 6) {
    if (!businessName) {
        businessName = "MER"; // Fallback
    }

    // 1. Clean business name: remove special chars, keep alphanumeric, uppercase
    const cleanName = businessName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // 2. Get prefix (first 3 letters, padded with 'X' if too short)
    let prefix = cleanName.substring(0, 3);
    while (prefix.length < 3) {
        prefix += 'X';
    }

    // 3. Generate random alphanumeric string
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars: I, O, 1, 0
    let randomPart = '';

    for (let i = 0; i < randomLength; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomPart += characters.charAt(randomIndex);
    }

    // 4. Combine parts
    return `TAG-${prefix}-${randomPart}`;
}
