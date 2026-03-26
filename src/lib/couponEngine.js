/**
 * Tagdeer Coupon & Campaign Engine - Distribution Logic
 */
import { generateCouponSerial } from './serialCodeGenerator';

// Eligibility Rules
const ELIGIBILITY = {
    minGaderPoints: 50,
    requiredStatus: ['Active']
};

/**
 * Checks if a user is eligible to receive a coupon from the pool.
 * @param {Object} user - The user object from profiles
 * @returns {boolean} - True if eligible
 */
export function isEligibleForCoupon(user) {
    if (!user) return false;

    // Must be SMS-verified (profiles table generally implies verified account unless Guest)
    // Guest/Anonymous users have no profiles entry or don't reach 50 pts
    if ((user.gader_points || 0) < ELIGIBILITY.minGaderPoints) return false;

    // Status MUST be Active
    if (user.status && !ELIGIBILITY.requiredStatus.includes(user.status)) return false;

    return true;
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
