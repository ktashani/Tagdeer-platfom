import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async headers() {
        return [{
            source: '/(.*)',
            headers: [
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
            ],
        }];
    },
};

export default withSentryConfig(nextConfig, {
    // Suppresses all Sentry build-time logs
    silent: true,

    // Upload source maps to Sentry for debugging
    // Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars
    // These are only needed during the build step on CI/CD
    org: process.env.SENTRY_ORG || "tagdeer",
    project: process.env.SENTRY_PROJECT || "tagdeer-platform",

    // Hides source maps from clients in production
    hideSourceMaps: true,

    // Disables Sentry's automatic instrumentation if no DSN is set
    disableLogger: true,
});
