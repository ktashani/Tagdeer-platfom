/**
 * Returns the correct cookie domain for the current environment.
 *
 * - Localhost / development: undefined (browser defaults to exact hostname)
 * - Staging  (ROOT_DOMAIN = staging.tagdeer.app): ".staging.tagdeer.app"
 * - Production (ROOT_DOMAIN = tagdeer.app):       ".tagdeer.app"
 *
 * The leading dot ensures cookies are shared across all subdomains
 * of that environment (e.g., admin.staging.tagdeer.app, merchant.staging.tagdeer.app)
 * WITHOUT leaking between staging ↔ production.
 */
export function getCookieDomain() {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

    // No domain set, or localhost → let the browser scope to the exact hostname
    if (!rootDomain || rootDomain.includes('localhost') || rootDomain.includes('127.0.0.1')) {
        return undefined;
    }

    // Prepend dot for subdomain sharing: "staging.tagdeer.app" → ".staging.tagdeer.app"
    return rootDomain.startsWith('.') ? rootDomain : `.${rootDomain}`;
}
