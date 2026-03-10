import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance monitoring: sample 10% of transactions in production
    tracesSampleRate: 0.1,

    // Session replay: capture 5% of sessions, 100% on error
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,

    // Only enable in production
    enabled: process.env.NODE_ENV === "production",

    // Environment tag
    environment: process.env.NODE_ENV,

    // Filter out noisy errors
    ignoreErrors: [
        "ResizeObserver loop",
        "Network request failed",
        "AbortError",
        "Load failed",
    ],
});
