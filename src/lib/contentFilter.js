/**
 * Utility for Content Integrity (The Judge).
 * Implements a Bad Word Dictionary filter for all logs.
 * If a log contains prohibited slang or harassment, it returns true,
 * meaning it must be flagged for review and not impact the Gader Index until cleared.
 */

// A basic array of words that trigger the content filter.
// Note: This is a foundational list and should be expanded based on cultural context and operational experience.
const BAD_WORDS_DICTIONARY = [
    // English examples
    'spam', 'fake', 'scam', 'fraud', 'fuck', 'shit', 'bitch', 'asshole',
    'idiot', 'stupid', 'crap', 'bastard',

    // Arabic examples (general/Libyan context - placeholder offensive terms to be expanded)
    'نصاب', 'سارق', 'كذاب', 'غشاش', 'تفو', 'كلب', 'حمار', 'زبالة', 'محتال', 'سرقة',
    'عنصري', 'شتم', 'سب'
];

export const containsBadWords = (text) => {
    if (!text || typeof text !== 'string') return false;

    const normalizedText = text.toLowerCase();

    // Check if any word in the dictionary exists as a substring in the normalized text
    // A more sophisticated implementation might use regex with word boundaries (\b) 
    // but substring match is safer for catching variations in Arabic and connected letters.
    return BAD_WORDS_DICTIONARY.some(badWord => normalizedText.includes(badWord.toLowerCase()));
};
