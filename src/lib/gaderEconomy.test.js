import { describe, it, expect } from 'vitest';
import { calculateLevelDecay, calculatePointsEarned } from './trustEngine';

describe('trustEngine – calculateLevelDecay', () => {
    it('returns 1.0 for 0 Gader (onboarding phase)', () => {
        expect(calculateLevelDecay(0)).toBe(1.0);
    });

    it('returns 1.0 for 99 Gader (still in first band)', () => {
        expect(calculateLevelDecay(99)).toBe(1.0);
    });

    it('returns 0.9 for 200 Gader (second band)', () => {
        expect(calculateLevelDecay(200)).toBe(0.9);
    });

    it('returns 0.8 for 400 Gader', () => {
        expect(calculateLevelDecay(400)).toBe(0.8);
    });

    it('returns 0.5 for 1000 Gader (Silver approach)', () => {
        expect(calculateLevelDecay(1000)).toBe(0.5);
    });

    it('floors at 0.2 for very high Gader (20000+)', () => {
        expect(calculateLevelDecay(20000)).toBe(0.2);
        expect(calculateLevelDecay(99999)).toBe(0.2);
    });

    it('handles null/undefined gracefully', () => {
        expect(calculateLevelDecay(null)).toBe(1.0);
        expect(calculateLevelDecay(undefined)).toBe(1.0);
    });
});

describe('trustEngine – calculatePointsEarned', () => {
    it('verified user + café (base 2) + 0 Gader → 2 pts', () => {
        const result = calculatePointsEarned({
            categoryBasePoints: 2,
            phoneVerified: true,
            currentGader: 0,
        });
        expect(result.earned).toBe(2);
        expect(result.breakdown.phoneMult).toBe(1.0);
        expect(result.breakdown.levelDecay).toBe(1.0);
    });

    it('unverified user + café (base 2) + 0 Gader → 1 pt (floor)', () => {
        const result = calculatePointsEarned({
            categoryBasePoints: 2,
            phoneVerified: false,
            currentGader: 0,
        });
        // 2 * 0.25 * 1.0 = 0.5 → rounds to 1 (min floor)
        expect(result.earned).toBe(1);
        expect(result.breakdown.phoneMult).toBe(0.25);
    });

    it('verified user + real estate (base 50) + 0 Gader → 50 pts', () => {
        const result = calculatePointsEarned({
            categoryBasePoints: 50,
            phoneVerified: true,
            currentGader: 0,
        });
        expect(result.earned).toBe(50);
    });

    it('verified user + café (base 2) + 500 Gader (decay 0.8) → 2 pts', () => {
        const result = calculatePointsEarned({
            categoryBasePoints: 2,
            phoneVerified: true,
            currentGader: 500,
        });
        // 2 * 1.0 * 0.8 = 1.6 → rounds to 2
        expect(result.earned).toBe(2);
    });

    it('unverified user + electronics (base 10) + 100 Gader → 3 pts', () => {
        const result = calculatePointsEarned({
            categoryBasePoints: 10,
            phoneVerified: false,
            currentGader: 100,
        });
        // 10 * 0.25 * 1.0 = 2.5 → rounds to 3
        expect(result.earned).toBe(3);
    });

    it('verified Gold user + café (base 2) + 6000 Gader (decay 0.2) → 1 pt (floor)', () => {
        const result = calculatePointsEarned({
            categoryBasePoints: 2,
            phoneVerified: true,
            currentGader: 6000,
        });
        // 2 * 1.0 * 0.2 = 0.4 → rounds to 0 → floored to 1
        expect(result.earned).toBe(1);
    });

    it('minimum earned is always 1, never 0', () => {
        const result = calculatePointsEarned({
            categoryBasePoints: 1,
            phoneVerified: false,
            currentGader: 50000,
            phoneMultiplier: 0.25,
        });
        expect(result.earned).toBeGreaterThanOrEqual(1);
    });

    it('uses custom phoneMultiplier when provided', () => {
        const result = calculatePointsEarned({
            categoryBasePoints: 10,
            phoneVerified: false,
            currentGader: 0,
            phoneMultiplier: 0.1,
        });
        // 10 * 0.1 * 1.0 = 1
        expect(result.earned).toBe(1);
        expect(result.breakdown.phoneMult).toBe(0.1);
    });
});
