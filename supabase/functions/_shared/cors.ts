/**
 * Shared CORS configuration for all Supabase Edge Functions.
 * Restricts Access-Control-Allow-Origin to known Tagdeer domains.
 */

const ALLOWED_ORIGINS: string[] = [
    'https://tagdeer.app',
    'https://www.tagdeer.app',
    'https://merchant.tagdeer.app',
    'https://admin.tagdeer.app',
    'https://staging.tagdeer.app',
    'https://merchant.staging.tagdeer.app',
    'https://admin.staging.tagdeer.app',
];

// Allow localhost during development
const DEV_ORIGINS: string[] = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://admin.localhost:3000',
    'http://merchant.localhost:3000',
];

export function getCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get('origin') || '';

    // Check production origins first, then dev origins
    const allAllowed = [...ALLOWED_ORIGINS, ...DEV_ORIGINS];
    const matchedOrigin = allAllowed.find(allowed => origin === allowed);

    return {
        'Access-Control-Allow-Origin': matchedOrigin || ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
    };
}
