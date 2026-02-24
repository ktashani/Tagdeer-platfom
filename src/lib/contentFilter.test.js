import { describe, it, expect } from 'vitest';
import { containsBadWords } from './contentFilter';

describe('contentFilter – containsBadWords', () => {
    // ── Should FLAG prohibited content ──────────────────────────────
    it('flags English bad words', () => {
        expect(containsBadWords('This place is a total scam')).toBe(true);
    });

    it('flags bad words regardless of casing', () => {
        expect(containsBadWords('FAKE reviews everywhere')).toBe(true);
        expect(containsBadWords('What a Fraud!')).toBe(true);
    });

    it('flags Arabic prohibited words', () => {
        expect(containsBadWords('هذا المحل نصاب')).toBe(true);
        expect(containsBadWords('صاحبه غشاش')).toBe(true);
    });

    it('flags bad words embedded inside a larger sentence', () => {
        expect(containsBadWords('I think they are spamming people')).toBe(true);
    });

    // ── Should ALLOW clean content ──────────────────────────────────
    it('allows clean English text', () => {
        expect(containsBadWords('Great service and friendly staff!')).toBe(false);
    });

    it('allows clean Arabic text', () => {
        expect(containsBadWords('خدمة ممتازة وأسعار معقولة')).toBe(false);
    });

    // ── Edge cases ──────────────────────────────────────────────────
    it('returns false for empty string', () => {
        expect(containsBadWords('')).toBe(false);
    });

    it('returns false for null or undefined', () => {
        expect(containsBadWords(null)).toBe(false);
        expect(containsBadWords(undefined)).toBe(false);
    });

    it('returns false for non-string input', () => {
        expect(containsBadWords(12345)).toBe(false);
    });
});
