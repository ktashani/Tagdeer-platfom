/**
 * Multi-signal Device Fingerprinting (Phase 1d)
 *
 * Generates a composite fingerprint using multiple browser signals
 * that survive localStorage clearing. Combines:
 *   - Canvas rendering fingerprint
 *   - WebGL renderer string
 *   - Timezone + language
 *   - Screen resolution + color depth
 *   - localStorage UUID (for backwards compatibility)
 *
 * Both the signal hash and localStorage UUID are returned so the
 * server can cross-reference to detect evasion attempts.
 */

/**
 * Simple string → numeric hash (djb2).
 * Used as a fast, non-cryptographic fingerprint combiner.
 */
function djb2Hash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Canvas fingerprint — rendering differences across browsers/hardware
 * produce a nearly unique pixel pattern.
 */
function getCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        // Draw text with specific font/style
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Tagdeer 🔐', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Gader Index', 4, 17);

        return djb2Hash(canvas.toDataURL());
    } catch {
        return 'canvas-err';
    }
}

/**
 * WebGL renderer — GPU model string is fairly unique across devices.
 */
function getWebGLRenderer() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return '';
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return 'no-debug';
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
        return djb2Hash(vendor + '|' + renderer);
    } catch {
        return 'webgl-err';
    }
}

/**
 * Collect all signals and produce a composite fingerprint.
 * Returns an object with both the signal-based hash and the localStorage UUID.
 */
function computeSignalFingerprint() {
    const signals = [
        // Canvas
        getCanvasFingerprint(),
        // WebGL
        getWebGLRenderer(),
        // Timezone
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        // Language
        navigator.language || '',
        navigator.languages?.join(',') || '',
        // Screen
        `${window.screen.width}x${window.screen.height}`,
        `${window.screen.colorDepth}`,
        // Platform
        navigator.platform || '',
        // User Agent
        navigator.userAgent,
        // Hardware concurrency (CPU cores)
        String(navigator.hardwareConcurrency || ''),
        // Touch support
        String(navigator.maxTouchPoints || 0),
    ];

    return 'sig-' + djb2Hash(signals.join('|||'));
}

const STORAGE_KEY = 'tagdeer_device_fingerprint';
const SIGNAL_KEY = 'tagdeer_signal_hash';

/**
 * Get the device fingerprint string.
 * Returns the localStorage UUID for backwards compatibility.
 * Internally also computes and stores the signal hash.
 */
export const getDeviceFingerprint = () => {
    if (typeof window === 'undefined') return 'server-side';

    let storedId = localStorage.getItem(STORAGE_KEY);

    if (!storedId) {
        const randomStr = Math.random().toString(36).substring(2, 15);
        const ts = Date.now().toString(36);
        storedId = `anon-${ts}-${randomStr}`;
        localStorage.setItem(STORAGE_KEY, storedId);
    }

    // Compute and cache signal hash (recalculate occasionally)
    try {
        const signalHash = computeSignalFingerprint();
        localStorage.setItem(SIGNAL_KEY, signalHash);
    } catch {
        // Signal computation is best-effort
    }

    return storedId;
};

/**
 * Get the signal-based fingerprint (for cross-referencing).
 * This survives localStorage clears because the same signals
 * produce the same hash.
 */
export const getSignalFingerprint = () => {
    if (typeof window === 'undefined') return null;

    // Try cached first
    const cached = localStorage.getItem(SIGNAL_KEY);
    if (cached) return cached;

    // Compute fresh
    try {
        const signalHash = computeSignalFingerprint();
        localStorage.setItem(SIGNAL_KEY, signalHash);
        return signalHash;
    } catch {
        return null;
    }
};

/**
 * Get both fingerprint identifiers for server-side submission.
 * The server can match on either to detect localStorage evasion.
 */
export const getDeviceIdentifiers = () => {
    return {
        fingerprint: getDeviceFingerprint(),
        signalHash: getSignalFingerprint(),
    };
};
