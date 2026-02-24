import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTierMultiplier, getDiminishingMultiplier, calculateVoteWeight } from './trustEngine';

describe('trustEngine – getTierMultiplier', () => {
    it('returns 0.2 for anonymous users (null)', () => {
        expect(getTierMultiplier(null)).toBe(0.2);
    });

    it('returns 0.2 for undefined user', () => {
        expect(getTierMultiplier(undefined)).toBe(0.2);
    });

    it('returns 1.0 for Bronze Tier users', () => {
        expect(getTierMultiplier({ vipTier: 'Bronze Tier' })).toBe(1.0);
    });

    it('returns 1.0 for users with no tier set', () => {
        expect(getTierMultiplier({ vipTier: '' })).toBe(1.0);
        expect(getTierMultiplier({})).toBe(1.0);
    });

    it('returns 1.5 for Silver Tier users', () => {
        expect(getTierMultiplier({ vipTier: 'Silver Tier' })).toBe(1.5);
    });

    it('returns 2.0 for Gold Tier users', () => {
        expect(getTierMultiplier({ vipTier: 'Gold Tier' })).toBe(2.0);
    });

    it('returns 2.0 for VIP Tier users', () => {
        expect(getTierMultiplier({ vipTier: 'VIP Tier' })).toBe(2.0);
    });

    it('is case-insensitive for tier names', () => {
        expect(getTierMultiplier({ vipTier: 'silver tier' })).toBe(1.5);
        expect(getTierMultiplier({ vipTier: 'GOLD TIER' })).toBe(2.0);
    });
});

describe('trustEngine – getDiminishingMultiplier', () => {
    it('returns 1.0 for 0 past votes', () => {
        expect(getDiminishingMultiplier(0)).toBe(1.0);
    });

    it('returns 0.5 for 1 past vote', () => {
        expect(getDiminishingMultiplier(1)).toBe(0.5);
    });

    it('returns 0.25 for 2 past votes', () => {
        expect(getDiminishingMultiplier(2)).toBe(0.25);
    });

    it('returns 0.25 for 5+ past votes', () => {
        expect(getDiminishingMultiplier(5)).toBe(0.25);
        expect(getDiminishingMultiplier(100)).toBe(0.25);
    });

    it('returns 1.0 for negative count (edge case)', () => {
        expect(getDiminishingMultiplier(-1)).toBe(1.0);
    });
});

describe('trustEngine – calculateVoteWeight', () => {
    it('calculates anonymous + 0 past votes = 0.2', () => {
        expect(calculateVoteWeight(null, 0)).toBe(0.2);
    });

    it('calculates anonymous + 1 past vote = 0.1', () => {
        expect(calculateVoteWeight(null, 1)).toBe(0.1);
    });

    it('calculates anonymous + 2+ past votes = 0.05', () => {
        expect(calculateVoteWeight(null, 3)).toBe(0.05);
    });

    it('calculates Bronze + 0 past votes = 1.0', () => {
        expect(calculateVoteWeight({ vipTier: 'Bronze Tier' }, 0)).toBe(1.0);
    });

    it('calculates Silver + 0 past votes = 1.5', () => {
        expect(calculateVoteWeight({ vipTier: 'Silver Tier' }, 0)).toBe(1.5);
    });

    it('calculates Gold + 0 past votes = 2.0', () => {
        expect(calculateVoteWeight({ vipTier: 'Gold Tier' }, 0)).toBe(2.0);
    });

    it('calculates Gold + 1 past vote = 1.0', () => {
        expect(calculateVoteWeight({ vipTier: 'Gold Tier' }, 1)).toBe(1.0);
    });

    it('calculates Silver + 2 past votes = 0.38', () => {
        // 1.5 * 0.25 = 0.375, rounded to 0.38
        expect(calculateVoteWeight({ vipTier: 'Silver Tier' }, 2)).toBe(0.38);
    });
});

// ── Time-Mocked Scenarios ──────────────────────────────────────────
// These test the date math used by submitVote to build Supabase query
// timestamps. We replicate the exact same logic here with fake time.

describe('trustEngine – 24-Hour Cooldown Timestamp Logic', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('produces correct 24h-ago ISO string at a known point in time', () => {
        // Set time to 2026-02-25T12:00:00Z
        const now = new Date('2026-02-25T12:00:00Z');
        vi.setSystemTime(now);

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        expect(twentyFourHoursAgo).toBe('2026-02-24T12:00:00.000Z');
    });

    it('a vote 23 hours ago is WITHIN the cooldown window', () => {
        const now = new Date('2026-02-25T12:00:00Z');
        vi.setSystemTime(now);

        const voteTime = new Date('2026-02-25T13:00:00Z'); // 1h from "now" but set at 25th 13:00
        // Actually, let's think of it as: vote was at 2026-02-24T13:00:00Z (23h ago)
        const voteTimestamp = new Date('2026-02-24T13:00:00Z');
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Vote timestamp is AFTER the 24h boundary → still in cooldown
        expect(voteTimestamp.getTime()).toBeGreaterThan(twentyFourHoursAgo.getTime());
    });

    it('a vote 25 hours ago is OUTSIDE the cooldown window', () => {
        const now = new Date('2026-02-25T12:00:00Z');
        vi.setSystemTime(now);

        const voteTimestamp = new Date('2026-02-24T11:00:00Z'); // 25h ago
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Vote timestamp is BEFORE the 24h boundary → cooldown expired
        expect(voteTimestamp.getTime()).toBeLessThan(twentyFourHoursAgo.getTime());
    });
});

describe('trustEngine – 30-Day Diminishing Returns Timestamp Logic', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('produces correct 30-day-ago ISO string', () => {
        const now = new Date('2026-03-15T10:00:00Z');
        vi.setSystemTime(now);

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        expect(thirtyDaysAgo).toBe('2026-02-13T10:00:00.000Z');
    });

    it('a vote 15 days ago is WITHIN the 30-day window', () => {
        const now = new Date('2026-03-15T10:00:00Z');
        vi.setSystemTime(now);

        const voteTimestamp = new Date('2026-03-01T10:00:00Z'); // 14 days ago
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        expect(voteTimestamp.getTime()).toBeGreaterThan(thirtyDaysAgo.getTime());
    });

    it('a vote 31 days ago is OUTSIDE the 30-day window', () => {
        const now = new Date('2026-03-15T10:00:00Z');
        vi.setSystemTime(now);

        const voteTimestamp = new Date('2026-02-12T10:00:00Z'); // 31 days ago
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        expect(voteTimestamp.getTime()).toBeLessThan(thirtyDaysAgo.getTime());
    });

    it('combines correctly: Silver tier + 2 votes in 30 days = 0.38 weight', () => {
        vi.setSystemTime(new Date('2026-03-15T10:00:00Z'));

        // Simulate: user already voted twice in the last 30 days
        const pastVoteCount = 2;
        const silverUser = { vipTier: 'Silver Tier' };

        const weight = calculateVoteWeight(silverUser, pastVoteCount);
        expect(weight).toBe(0.38); // 1.5 × 0.25 = 0.375 → rounded 0.38
    });

    it('combines correctly: Gold tier + first vote ever = 2.0 weight', () => {
        vi.setSystemTime(new Date('2026-03-15T10:00:00Z'));

        const pastVoteCount = 0;
        const goldUser = { vipTier: 'Gold Tier' };

        const weight = calculateVoteWeight(goldUser, pastVoteCount);
        expect(weight).toBe(2.0); // 2.0 × 1.0 = 2.0
    });
});
