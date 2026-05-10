/**
 * Tagdeer Trust Engine
 * 
 * Pure utility functions for gamified vote weighting.
 * Implements tier-based multipliers and diminishing returns
 * to prevent score manipulation while rewarding verified users.
 */

/**
 * Maps a user's VIP tier to a base vote multiplier.
 * Anonymous users get minimal impact; verified users get amplified voice.
 *
 * @param {object|null} user - The user object from TagdeerContext (null = anonymous)
 * @returns {number} The tier multiplier
 */
export function getTierMultiplier(user) {
    if (!user) return 0.2; // Anonymous

    // Determine tier from the stored vipTier string
    const tier = (user.vipTier || '').toLowerCase();
    let tierFromString = 1.0; // default Bronze
    if (tier.includes('vip') || tier.includes('diamond')) tierFromString = 2.5;
    else if (tier.includes('gold')) tierFromString = 2.0;
    else if (tier.includes('silver')) tierFromString = 1.5;

    // Determine tier from gader_points (exponential scale)
    const points = user.gader || 0;
    let tierFromPoints = 1.0;                          // Bronze: 0–999
    if (points >= 20000) tierFromPoints = 2.5;         // VIP: 20,000+
    else if (points >= 5000) tierFromPoints = 2.0;     // Gold: 5,000–19,999
    else if (points >= 1000) tierFromPoints = 1.5;     // Silver: 1,000–4,999

    // Use the higher of the two
    return Math.max(tierFromString, tierFromPoints);
}

/**
 * Calculates a diminishing returns multiplier based on how many times
 * the same person has voted on the same business in the last 30 days.
 *
 * @param {number} pastVoteCount - Number of votes on this business in 30 days
 * @returns {number} The diminishing multiplier
 */
export function getDiminishingMultiplier(pastVoteCount) {
    if (pastVoteCount <= 0) return 1.0;
    if (pastVoteCount === 1) return 0.5;
    return 0.25; // 2+
}

/**
 * Calculates the final weight for a vote by combining
 * the tier multiplier and the diminishing returns multiplier.
 *
 * @param {object|null} user - The user object (null = anonymous)
 * @param {number} pastVoteCount - Votes on this business in the last 30 days
 * @returns {number} The final vote weight (rounded to 2 decimals)
 */
export function calculateVoteWeight(user, pastVoteCount) {
    const tier = getTierMultiplier(user);
    const diminishing = getDiminishingMultiplier(pastVoteCount);
    return Math.round(tier * diminishing * 100) / 100;
}

/**
 * Calculates the level decay multiplier based on current Gader points.
 * Higher points = lower decay = fewer points earned per vote.
 * Mirrors the server-side formula in submit_vote v3.
 *
 * @param {number} currentGader - Current Gader point total
 * @returns {number} The decay multiplier (1.0 → 0.2)
 */
export function calculateLevelDecay(currentGader) {
    const gader = currentGader || 0;
    return Math.max(0.2, 1.0 - Math.floor(gader / 200) * 0.1);
}

/**
 * Calculates the estimated Gader points a user will earn for a vote.
 * Triple-layer formula: category_base × phone_multiplier × level_decay
 * Mirrors the server-side submit_vote v3 logic for client-side preview.
 *
 * @param {object} params
 * @param {number} params.categoryBasePoints - Base points for the business category
 * @param {boolean} params.phoneVerified - Whether user has verified phone
 * @param {number} params.currentGader - User's current Gader total
 * @param {number} [params.phoneMultiplier=0.25] - Penalty for unverified (from config)
 * @returns {object} { earned, breakdown: { categoryBase, phoneMult, levelDecay } }
 */
export function calculatePointsEarned({
    categoryBasePoints = 3,
    phoneVerified = false,
    currentGader = 0,
    phoneMultiplier = 0.25
}) {
    const phoneMult = phoneVerified ? 1.0 : phoneMultiplier;
    const levelDecay = calculateLevelDecay(currentGader);
    const earned = Math.max(1, Math.round(categoryBasePoints * phoneMult * levelDecay));

    return {
        earned,
        breakdown: {
            categoryBase: categoryBasePoints,
            phoneMult,
            levelDecay
        }
    };
}
