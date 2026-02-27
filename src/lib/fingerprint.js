/**
 * Utility for anonymous device traceability.
 * Generates a unique fingerprint based on UserAgent and stores a UUID in localStorage.
 * This is used to anchor anonymous logs and enforce rate limits.
 */

export const getDeviceFingerprint = () => {
    // Only run on client side
    if (typeof window === 'undefined') return 'server-side';

    const STORAGE_KEY = 'tagdeer_device_fingerprint';
    let fingerprint = localStorage.getItem(STORAGE_KEY);

    if (!fingerprint) {
        // Generate a new fingerprint
        const userAgent = navigator.userAgent;
        const screenRes = `${window.screen.width}x${window.screen.height}`;
        const timestamp = new Date().getTime();

        // Simple hash function for the base info
        const baseString = `${userAgent}-${screenRes}-${timestamp}`;
        let hash = 0;
        for (let i = 0; i < baseString.length; i++) {
            const char = baseString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        // Combine with a random string to ensure uniqueness
        const randomStr = Math.random().toString(36).substring(2, 15);
        fingerprint = `anon-${Math.abs(hash)}-${randomStr}`;

        localStorage.setItem(STORAGE_KEY, fingerprint);
    }

    return fingerprint;
};
