import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

// ── Build a chainable Supabase mock that tracks calls ──────────────
function createSupabaseMock() {
    const calls = [];
    let insertFn;

    // Each chained method returns 'self' so .from().select().eq().gte() works
    const chainable = () => {
        const self = {
            select: vi.fn((...args) => { self._ops.push({ op: 'select', args }); return self; }),
            eq: vi.fn((...args) => { self._ops.push({ op: 'eq', args }); return self; }),
            gte: vi.fn((...args) => { self._ops.push({ op: 'gte', args }); return self; }),
            insert: vi.fn((payload) => {
                insertFn?.(payload);
                return Promise.resolve({ error: null });
            }),
            // When awaited (cooldown / diminishing), resolve with count: 0
            then: (resolve) => resolve({ count: 0, error: null }),
            _ops: [],
        };
        return self;
    };

    const from = vi.fn((table) => {
        const chain = chainable();
        calls.push({ table, chain });
        return chain;
    });

    return {
        from,
        calls,
        getInsertPayload: () => {
            const insertCall = calls.find(c => c.chain.insert.mock.calls.length > 0);
            return insertCall?.chain.insert.mock.calls[0]?.[0];
        },
        getTableNames: () => calls.map(c => c.table),
    };
}

const createContext = (supabaseMock, overrides = {}) => ({
    lang: 'en',
    setLang: vi.fn(),
    t: (key) => key,
    isRTL: false,
    businesses: [
        { id: 1, name: 'Test Biz', region: 'Tripoli', category: 'Electronics', recommends: 10, complains: 2, isShielded: false, logs: [] },
    ],
    setBusinesses: vi.fn(),
    supabase: supabaseMock,
    anonInteractions: 0,
    setAnonInteractions: vi.fn(),
    showLimitModal: false,
    setShowLimitModal: vi.fn(),
    toastMessage: '',
    setToastMessage: vi.fn(),
    showToast: vi.fn(),
    voteModal: { isOpen: true, businessId: 1, type: 'recommend' },
    setVoteModal: vi.fn(),
    voteReason: 'Great service!',
    setVoteReason: vi.fn(),
    showVerifySoonModal: false,
    setShowVerifySoonModal: vi.fn(),
    showPreRegModal: false,
    setShowPreRegModal: vi.fn(),
    user: { id: 'uuid-123', userId: 'VIP-ABCDE', vipTier: 'Bronze Tier' },
    ...overrides,
});

// Provide a mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

afterEach(() => { cleanup(); });

async function setupWithContext(contextOverrides = {}) {
    vi.resetModules();

    const sbMock = createSupabaseMock();
    const ctx = createContext(sbMock, contextOverrides);

    vi.doMock('@/context/TagdeerContext', () => ({
        useTagdeer: vi.fn().mockReturnValue(ctx),
    }));
    vi.doMock('next/navigation', () => ({
        useRouter: () => ({ push: vi.fn() }),
        usePathname: () => '/',
    }));
    vi.doMock('@/lib/fingerprint', () => ({
        getDeviceFingerprint: () => 'anon-test-fingerprint',
    }));

    const mod = await import('./ClientLayout');
    return { mod, sbMock, ctx };
}

describe('Log Submission Flow (submitVote)', () => {
    it('targets the "logs" table on every query, NOT "interactions"', async () => {
        const { mod, sbMock } = await setupWithContext();

        render(<mod.ClientLayout><div>children</div></mod.ClientLayout>);
        const submitButton = screen.getByRole('button', { name: /submit/i });

        await act(async () => { submitButton.click(); });

        const tableNames = sbMock.getTableNames();
        // All calls (cooldown, diminishing, insert) should target 'logs'
        expect(tableNames.length).toBeGreaterThanOrEqual(3);
        tableNames.forEach(name => {
            expect(name).toBe('logs');
        });
        expect(tableNames).not.toContain('interactions');
    });

    it('includes "weight" in the insert payload', async () => {
        const { mod, sbMock } = await setupWithContext();

        render(<mod.ClientLayout><div>children</div></mod.ClientLayout>);
        const submitButton = screen.getByRole('button', { name: /submit/i });

        await act(async () => { submitButton.click(); });

        const payload = sbMock.getInsertPayload();
        expect(payload).toBeDefined();
        expect(payload[0]).toHaveProperty('weight');
        expect(typeof payload[0].weight).toBe('number');
    });

    it('sends the correct full payload shape', async () => {
        const { mod, sbMock } = await setupWithContext();

        render(<mod.ClientLayout><div>children</div></mod.ClientLayout>);
        const submitButton = screen.getByRole('button', { name: /submit/i });

        await act(async () => { submitButton.click(); });

        const payload = sbMock.getInsertPayload();
        expect(payload).toEqual([{
            business_id: 1,
            interaction_type: 'recommend',
            reason_text: 'Great service!',
            profile_id: 'uuid-123',
            fingerprint: 'anon-test-fingerprint',
            weight: 1.0,  // Bronze Tier (1.0) × 0 past votes (1.0) = 1.0
        }]);
    });

    it('calculates lower weight for anonymous users', async () => {
        const { mod, sbMock } = await setupWithContext({ user: null });

        render(<mod.ClientLayout><div>children</div></mod.ClientLayout>);
        const submitButton = screen.getByRole('button', { name: /submit/i });

        await act(async () => { submitButton.click(); });

        const payload = sbMock.getInsertPayload();
        expect(payload[0]).toEqual(expect.objectContaining({
            profile_id: null,
            fingerprint: 'anon-test-fingerprint',
            weight: 0.2,  // Anonymous (0.2) × 0 past votes (1.0) = 0.2
        }));
    });
});
