import { describe, it, expect } from 'vitest';

const VALID_GATEWAY_IDS = ['manual_bank', 'crypto_usdt', 'tlync_lyd'];
const VALID_TYPES = ['manual', 'crypto', 'api'];

// Mock gateway config (matches Phase 0 seed)
const mockGateways = [
    { id: 'manual_bank', name: 'Bank Transfer', type: 'manual', currency: 'LYD', isActive: true, config: { bank_name: 'Test', account_number: '123' } },
    { id: 'crypto_usdt', name: 'Crypto (USDT-TRC20)', type: 'crypto', currency: 'USDT', isActive: false, config: { wallet_address: 'TXxxx', exchange_rate_lyd_per_usdt: 6.2 } },
    { id: 'tlync_lyd', name: 'Tlync', type: 'api', currency: 'LYD', isActive: false, config: {} }
];

describe('Payment Gateway Config', () => {
    it('should have valid gateway IDs', () => {
        mockGateways.forEach(gw => {
            expect(VALID_GATEWAY_IDS).toContain(gw.id);
        });
    });

    it('should have valid types', () => {
        mockGateways.forEach(gw => {
            expect(VALID_TYPES).toContain(gw.type);
        });
    });

    it('should filter only active gateways for checkout', () => {
        const active = mockGateways.filter(gw => gw.isActive);
        expect(active.length).toBe(1);
        expect(active[0].id).toBe('manual_bank');
    });

    it('should calculate USDT amount correctly', () => {
        const rate = 6.2;
        const lydAmount = 50;
        const usdtAmount = (lydAmount / rate).toFixed(2);
        expect(usdtAmount).toBe('8.06');
    });

    it('crypto gateway should have wallet address and exchange rate', () => {
        const crypto = mockGateways.find(g => g.id === 'crypto_usdt');
        expect(crypto.config.wallet_address).toBeTruthy();
        expect(crypto.config.exchange_rate_lyd_per_usdt).toBeGreaterThan(0);
    });
});
