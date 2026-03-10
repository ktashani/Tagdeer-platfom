/**
 * Utility for Content Integrity (The Judge).
 * Implements a Bad Word Dictionary filter for all logs.
 * If a log contains prohibited slang or harassment, it returns true,
 * meaning it must be flagged for review and not impact the Gader Index until cleared.
 *
 * ✅ BUG-02 FIX: Uses word-boundary regex for English and space/punctuation
 * boundaries for Arabic to prevent false positives on words like
 * "classic", "therapist", "assassin", etc.
 */

// English bad words — matched with \b word boundaries
const ENGLISH_BAD_WORDS = [
    'spam', 'fake', 'scam', 'fraud', 'fuck', 'shit', 'bitch', 'asshole',
    'idiot', 'stupid', 'crap', 'bastard',
];

// Arabic bad words — matched with space/punctuation boundaries
const ARABIC_BAD_WORDS = [
    'نصاب', 'سارق', 'كذاب', 'غشاش', 'تفو', 'كلب', 'حمار', 'زبالة',
    'محتال', 'سرقة', 'عنصري', 'شتم', 'سب',
];

// ✅ English: Word-boundary regex prevents substring false positives
// Escapes special characters in words, then wraps in \b ... \b
const englishPattern = new RegExp(
    '\\b(' + ENGLISH_BAD_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
    'i'
);

// ✅ Arabic: Space/punctuation/start/end boundaries
// Arabic doesn't use \b correctly, so we use Unicode-aware boundaries
const arabicPattern = new RegExp(
    '(?:^|[\\s\\u060C\\u061B\\u061F\\u0021-\\u002F\\u003A-\\u0040])(' + ARABIC_BAD_WORDS.join('|') + ')(?=[\\s\\u060C\\u061B\\u061F\\u0021-\\u002F\\u003A-\\u0040]|$)',
    'u'
);

export const containsBadWords = (text) => {
    if (!text || typeof text !== 'string') return false;

    const normalizedText = text.toLowerCase();

    return englishPattern.test(normalizedText) || arabicPattern.test(text);
};
