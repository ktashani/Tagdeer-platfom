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

    it('flags standalone bad words at start/end of string', () => {
        expect(containsBadWords('scam detected here')).toBe(true);
        expect(containsBadWords('this is a scam')).toBe(true);
        expect(containsBadWords('crap')).toBe(true);
    });

    // ── BUG-02 FIX: Should NOT flag words that CONTAIN bad words as substrings ──
    it('does NOT flag "classic" (contains "ass")', () => {
        expect(containsBadWords('What a classic restaurant')).toBe(false);
    });

    it('does NOT flag "therapist" (contains "crap" shifted? — no, but it should not match "the")', () => {
        expect(containsBadWords('She is a great therapist')).toBe(false);
    });

    it('does NOT flag "assassin" (contains "ass")', () => {
        expect(containsBadWords('The movie is about an assassin')).toBe(false);
    });

    it('does NOT flag "scrapbook" (contains "crap")', () => {
        expect(containsBadWords('I made a scrapbook for her birthday')).toBe(false);
    });

    it('does NOT flag "Islamabad" (no bad word)', () => {
        expect(containsBadWords('I visited Islamabad last year')).toBe(false);
    });

    it('does NOT flag "spammer" partial match — flags because "spam" is a standalone word within "spammer" (Actually, with pure word boundary, spammer is one word, so it should be false)', () => {
        // NOTE: \b treats "spammer" as a single word, so "spam" is not at a boundary.
        // Therefore, it correctly returns false.
        expect(containsBadWords('Stop being a spammer')).toBe(false);
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
