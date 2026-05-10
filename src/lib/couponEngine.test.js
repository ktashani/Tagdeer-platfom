import { describe, it, expect } from 'vitest';
import { isEligibleForCoupon, getBarrierProgress, calculateLogThreshold } from './couponEngine';

describe('couponEngine – isEligibleForCoupon (Barrier + Phone Gate)', () => {
    it('returns false for null user', () => {
        expect(isEligibleForCoupon(null)).toBe(false);
    });

    it('returns false when Gader below 200 barrier', () => {
        expect(isEligibleForCoupon({ gader_points: 199, phone_verified: true, status: 'Active' })).toBe(false);
    });

    it('returns false when phone not verified even with sufficient Gader', () => {
        expect(isEligibleForCoupon({ gader_points: 500, phone_verified: false, status: 'Active' })).toBe(false);
    });

    it('returns true when both gates pass', () => {
        expect(isEligibleForCoupon({ gader_points: 200, phone_verified: true, status: 'Active' })).toBe(true);
    });

    it('returns false when status is Banned', () => {
        expect(isEligibleForCoupon({ gader_points: 500, phone_verified: true, status: 'Banned' })).toBe(false);
    });

    it('accepts overrideMinGader parameter', () => {
        expect(isEligibleForCoupon({ gader_points: 100, phone_verified: true, status: 'Active' }, 100)).toBe(true);
        expect(isEligibleForCoupon({ gader_points: 100, phone_verified: true, status: 'Active' }, 200)).toBe(false);
    });

    it('uses user.gader as fallback for user.gader_points', () => {
        expect(isEligibleForCoupon({ gader: 200, phone_verified: true, status: 'Active' })).toBe(true);
    });
});

describe('couponEngine – getBarrierProgress', () => {
    it('returns 0% for new user', () => {
        const progress = getBarrierProgress({ gader: 0, phone_verified: false });
        expect(progress.current).toBe(0);
        expect(progress.required).toBe(200);
        expect(progress.remaining).toBe(200);
        expect(progress.percentage).toBe(0);
        expect(progress.meetsBarrier).toBe(false);
        expect(progress.meetsPhone).toBe(false);
        expect(progress.isFullyEligible).toBe(false);
    });

    it('returns correct progress at 100 Gader', () => {
        const progress = getBarrierProgress({ gader: 100, phone_verified: true });
        expect(progress.percentage).toBe(50);
        expect(progress.remaining).toBe(100);
        expect(progress.meetsBarrier).toBe(false);
        expect(progress.meetsPhone).toBe(true);
        expect(progress.isFullyEligible).toBe(false);
    });

    it('returns fully eligible at 200+ with phone verified', () => {
        const progress = getBarrierProgress({ gader: 250, phone_verified: true });
        expect(progress.percentage).toBe(100);
        expect(progress.remaining).toBe(0);
        expect(progress.meetsBarrier).toBe(true);
        expect(progress.meetsPhone).toBe(true);
        expect(progress.isFullyEligible).toBe(true);
    });

    it('respects custom minGader parameter', () => {
        const progress = getBarrierProgress({ gader: 150, phone_verified: true }, 100);
        expect(progress.isFullyEligible).toBe(true);
    });
});

describe('couponEngine – calculateLogThreshold (difficulty escalation)', () => {
    it('first coupon needs 4 logs (3 + difficulty 1)', () => {
        expect(calculateLogThreshold(1)).toBe(4);
    });

    it('5th coupon needs 8 logs', () => {
        expect(calculateLogThreshold(5)).toBe(8);
    });

    it('10th coupon needs 13 logs (very hard)', () => {
        expect(calculateLogThreshold(10)).toBe(13);
    });

    it('defaults to difficulty 1 if not provided', () => {
        expect(calculateLogThreshold(undefined)).toBe(4);
        expect(calculateLogThreshold(null)).toBe(4);
    });
});
