/**
 * Browser Fingerprint Utility — AGENTS.md Compliance
 *
 * Generates a deterministic device fingerprint hash for anonymous vote tracking.
 * Combines: screen resolution, timezone, language, platform, color depth,
 * touch support, localStorage UUID seed.
 *
 * Per AGENTS.md: "Use Fingerprinting (Device info + IP Hash + LocalStorage UUID)"
 */

const STORAGE_KEY = 'tagdeer_device_fingerprint';

function getOrCreateUUID() {
    if (typeof window === 'undefined') return 'ssr';
    let uuid = localStorage.getItem(STORAGE_KEY);
    if (!uuid) {
        uuid = crypto.randomUUID
            ? crypto.randomUUID()
            : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(STORAGE_KEY, uuid);
    }
    return uuid;
}

async function sha256(str) {
    if (typeof window === 'undefined' || !crypto.subtle) {
        // Fallback for SSR / insecure context
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + c;
            hash = hash & hash;
        }
        return `fb-${Math.abs(hash).toString(16)}`;
    }
    const data = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns { hash, deviceInfo } for use with anon vote RPCs.
 */
export async function generateFingerprint() {
    if (typeof window === 'undefined') return { hash: 'ssr', deviceInfo: {} };

    const uuid = getOrCreateUUID();
    const screen = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const lang = navigator.language;
    const platform = navigator.platform || 'unknown';
    const touch = navigator.maxTouchPoints || 0;

    const raw = [uuid, screen, tz, lang, platform, touch].join('|');
    const hash = await sha256(raw);

    return {
        hash,
        deviceInfo: {
            screen,
            timezone: tz,
            language: lang,
            platform,
            touchPoints: touch,
        },
    };
}

/**
 * Legacy export for backwards compatibility.
 */
export const getDeviceFingerprint = () => {
    return getOrCreateUUID();
};
