/**
 * Simple CSRF protection for admin API routes.
 *
 * Validates that the request includes a custom `X-Requested-With` header.
 * Browsers do NOT automatically send custom headers on cross-origin requests
 * (they trigger a CORS preflight), so this blocks CSRF attacks from
 * malicious websites that rely on automatic cookie sending.
 *
 * The admin frontend must include this header in all fetch() calls.
 */
export function validateCsrfHeader(request) {
    const xRequestedWith = request.headers.get('x-requested-with');
    return xRequestedWith === 'TagdeerAdmin';
}
