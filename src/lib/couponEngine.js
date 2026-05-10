/**
 * Tagdeer Coupon & Campaign Engine - Distribution Logic
 */
import { generateCouponSerial } from './serialCodeGenerator';

// Eligibility Rules — Gader Barrier + Phone Gate
const ELIGIBILITY = {
    minGaderPoints: 200,   // Platform barrier — configurable via platform_config.min_gader_for_rewards
    requiredStatus: ['Active'],
    requirePhoneVerified: true
};

/**
 * Checks if a user is eligible to receive a coupon from the pool.
 * Both gates must pass: sufficient Gader AND phone_verified.
 * @param {Object} user - The user object from profiles
 * @param {number} [overrideMinGader] - Optional override from platform_config
 * @returns {boolean} - True if eligible
 */
export function isEligibleForCoupon(user, overrideMinGader) {
    if (!user) return false;

    const minGader = overrideMinGader || ELIGIBILITY.minGaderPoints;

    // Gate 1: Must have sufficient Gader points (barrier)
    if ((user.gader_points || user.gader || 0) < minGader) return false;

    // Gate 2: Must have verified phone number
    if (ELIGIBILITY.requirePhoneVerified && !user.phone_verified) return false;

    // Gate 3: Status MUST be Active
    if (user.status && !ELIGIBILITY.requiredStatus.includes(user.status)) return false;

    return true;
}

/**
 * Returns the barrier progress for a user.
 * @param {Object} user - The user object
 * @param {number} [minGader=200] - Minimum Gader from platform config
 * @returns {Object} - { current, required, percentage, meetsBarrier, meetsPhone, isFullyEligible }
 */
export function getBarrierProgress(user, minGader = 200) {
    const current = user?.gader_points || user?.gader || 0;
    const meetsBarrier = current >= minGader;
    const meetsPhone = !!user?.phone_verified;

    return {
        current,
        required: minGader,
        remaining: Math.max(0, minGader - current),
        percentage: Math.min(100, (current / minGader) * 100),
        meetsBarrier,
        meetsPhone,
        isFullyEligible: meetsBarrier && meetsPhone
    };
}

/**
 * Calculates current threshold based on difficulty curve.
 * Baseline is 3. Every coupon earned increases difficulty by 1.
 * @param {number} difficultyLevel 
 * @returns {number} The threshold of logs needed
 */
export function calculateLogThreshold(difficultyLevel) {
    const base = 3;
    const diff = typeof difficultyLevel === 'number' ? difficultyLevel : 1;
    return base + (diff * 1);
}

/**
 * Checks if a redeemed coupon qualifies for the "Hot Coupon" 1.5x bonus.
 * Rule: Redeemed within 48 hours of generation.
 * @param {Date|string} generatedAt 
 * @param {Date|string} redeemedAt 
 * @returns {boolean} True if Hot Coupon
 */
export function isHotCoupon(generatedAt, redeemedAt) {
    if (!generatedAt || !redeemedAt) return false;

    const genTime = new Date(generatedAt).getTime();
    const redTime = new Date(redeemedAt).getTime();

    // Difference in hours
    const diffHours = (redTime - genTime) / (1000 * 60 * 60);

    return diffHours <= 48; // Less than or equal to 48 hours
}
