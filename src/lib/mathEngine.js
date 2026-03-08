/**
 * Tagdeer Math Engine
 * 
 * Client-side scoring utilities for businesses.
 * The authoritative scores (shadow_score, display_score) are computed DB-side,
 * but this provides a fallback/preview calculation for immediate UI feedback.
 */

/**
 * Calculates a business's display score from its recommend/complain counts.
 * Score = weighted_recommends / (weighted_recommends + weighted_complains) * 100
 * 
 * Returns null if fewer than 5 total interactions (not enough data for a meaningful score).
 *
 * @param {object} business - Business object with recommends/complains counts
 * @returns {number|null} Score from 0-100, or null if insufficient data
 */
export function calculateBusinessScore(business) {
    const r = business.recommends || 0;
    const c = business.complains || 0;
    const total = r + c;

    if (total < 5) return null; // Not enough data for a meaningful score

    return Math.round((r / total) * 100);
}

/**
 * Returns a human-friendly label for a business score.
 *
 * @param {number|null} score - Score from 0-100
 * @param {string} lang - Language code ('ar' or 'en')
 * @returns {string} Label like "Excellent", "Good", etc.
 */
export function getScoreLabel(score, lang = 'en') {
    if (score === null) return lang === 'ar' ? 'بيانات غير كافية' : 'Not enough data';
    if (score >= 90) return lang === 'ar' ? 'ممتاز' : 'Excellent';
    if (score >= 70) return lang === 'ar' ? 'جيد جداً' : 'Very Good';
    if (score >= 50) return lang === 'ar' ? 'جيد' : 'Good';
    if (score >= 30) return lang === 'ar' ? 'مقبول' : 'Fair';
    return lang === 'ar' ? 'ضعيف' : 'Poor';
}

/**
 * Returns a color class for a given score (for UI badges).
 *
 * @param {number|null} score - Score from 0-100
 * @returns {string} Tailwind color class
 */
export function getScoreColor(score) {
    if (score === null) return 'text-slate-400';
    if (score >= 90) return 'text-emerald-600';
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    if (score >= 30) return 'text-orange-600';
    return 'text-red-600';
}
