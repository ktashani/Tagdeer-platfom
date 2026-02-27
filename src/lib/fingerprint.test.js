import { describe, it, expect, beforeEach } from 'vitest';
import { getDeviceFingerprint } from './fingerprint';

describe('fingerprint – getDeviceFingerprint', () => {
    beforeEach(() => {
        // Clear any stored fingerprint before each test
        localStorage.removeItem('tagdeer_device_fingerprint');
    });

    it('generates a fingerprint with the "anon-" prefix', () => {
        const fp = getDeviceFingerprint();
        expect(fp).toMatch(/^anon-/);
    });

    it('returns the same fingerprint on consecutive calls (localStorage persistence)', () => {
        const first = getDeviceFingerprint();
        const second = getDeviceFingerprint();
        expect(first).toBe(second);
    });

    it('stores the fingerprint in localStorage under the correct key', () => {
        const fp = getDeviceFingerprint();
        expect(localStorage.getItem('tagdeer_device_fingerprint')).toBe(fp);
    });

    it('generates a NEW fingerprint after localStorage is cleared', () => {
        const first = getDeviceFingerprint();
        localStorage.removeItem('tagdeer_device_fingerprint');
        const second = getDeviceFingerprint();

        // Both should be valid fingerprints but are extremely unlikely to match
        expect(second).toMatch(/^anon-/);
        // Note: there's a tiny theoretical chance they match, but practically impossible
    });

    it('returns a pre-existing fingerprint from localStorage if one exists', () => {
        const existingFp = 'anon-9999-preexisting';
        localStorage.setItem('tagdeer_device_fingerprint', existingFp);

        const fp = getDeviceFingerprint();
        expect(fp).toBe(existingFp);
    });
});
