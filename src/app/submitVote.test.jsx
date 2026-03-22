import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

// ── Build a Supabase mock that supports .rpc() ────────────
function createSupabaseMock(rpcResponse = { success: true, weight: 1.0, log_id: 'test-uuid', created_at: new Date().toISOString(), earned_points: 10, new_gader_total: 30, past_vote_count: 0, profile_id: 'uuid-123', fingerprint: 'anon-test-fingerprint', interaction_type: 'recommend', reason_text: 'Great service!' }) {
    const rpcFn = vi.fn().mockResolvedValue({ data: rpcResponse, error: null });

    return {
        rpc: rpcFn,
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ error: null }),
            then: (resolve) => resolve({ count: 0, error: null }),
        }),
        getRpcCalls: () => rpcFn.mock.calls,
    };
}

// Provide a mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('useVoteSubmission — RPC-based submission', () => {
    let useVoteSubmission;
    let containsBadWords;

    beforeEach(async () => {
        vi.resetModules();

        vi.doMock('@/lib/fingerprint', () => ({
            getDeviceFingerprint: () => 'anon-test-fingerprint',
        }));

        vi.doMock('@/lib/contentFilter', () => ({
            containsBadWords: vi.fn().mockReturnValue(false),
        }));

        const mod = await import('@/hooks/useVoteSubmission');
        useVoteSubmission = mod.useVoteSubmission;

        const filterMod = await import('@/lib/contentFilter');
        containsBadWords = filterMod.containsBadWords;
    });

    it('calls supabase.rpc("submit_vote") with correct parameters', async () => {
        const sbMock = createSupabaseMock();
        const showToast = vi.fn();
        const setBusinesses = vi.fn();
        const setUser = vi.fn();

        const { result } = renderHook(() => useVoteSubmission({
            user: { id: 'uuid-123', vipTier: 'Bronze Tier', role: 'consumer' },
            supabase: sbMock,
            lang: 'en',
            anonInteractions: 0,
            setAnonInteractions: vi.fn(),
            setUser,
            showToast,
            setShowLimitModal: vi.fn(),
            setBusinesses,
        }));

        let voteResult;
        await act(async () => {
            voteResult = await result.current.submitVote('biz-1', 'recommend', 'Great service!', true);
        });

        expect(voteResult).toEqual({ success: true, weight: 1.0 });
        expect(sbMock.rpc).toHaveBeenCalledWith('submit_vote', {
            p_business_id: 'biz-1',
            p_interaction_type: 'recommend',
            p_reason_text: 'Great service!',
            p_profile_id: 'uuid-123',
            p_fingerprint: 'anon-test-fingerprint',
            p_is_flagged: false,
        });
    });

    it('blocks merchant accounts from voting', async () => {
        const sbMock = createSupabaseMock();
        const showToast = vi.fn();

        const { result } = renderHook(() => useVoteSubmission({
            user: { id: 'uuid-merchant', role: 'merchant' },
            supabase: sbMock,
            lang: 'en',
            anonInteractions: 0,
            setAnonInteractions: vi.fn(),
            setUser: vi.fn(),
            showToast,
            setShowLimitModal: vi.fn(),
            setBusinesses: vi.fn(),
        }));

        let voteResult;
        await act(async () => {
            voteResult = await result.current.submitVote('biz-1', 'recommend', '', true);
        });

        expect(voteResult).toBe(false);
        expect(sbMock.rpc).not.toHaveBeenCalled();
        expect(showToast).toHaveBeenCalled();
    });

    it('handles cooldown_active error from server', async () => {
        const sbMock = createSupabaseMock({ error: 'cooldown_active' });
        const showToast = vi.fn();

        const { result } = renderHook(() => useVoteSubmission({
            user: { id: 'uuid-123', role: 'consumer' },
            supabase: sbMock,
            lang: 'en',
            anonInteractions: 0,
            setAnonInteractions: vi.fn(),
            setUser: vi.fn(),
            showToast,
            setShowLimitModal: vi.fn(),
            setBusinesses: vi.fn(),
        }));

        let voteResult;
        await act(async () => {
            voteResult = await result.current.submitVote('biz-1', 'recommend', '', true);
        });

        expect(voteResult).toBe(false);
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('24 hours'));
    });

    it('handles anonymous_weekly_limit error from server', async () => {
        const sbMock = createSupabaseMock({ error: 'anonymous_weekly_limit', limit: 7 });
        const setShowLimitModal = vi.fn();

        const { result } = renderHook(() => useVoteSubmission({
            user: null,
            supabase: sbMock,
            lang: 'en',
            anonInteractions: 0,
            setAnonInteractions: vi.fn(),
            setUser: vi.fn(),
            showToast: vi.fn(),
            setShowLimitModal,
            setBusinesses: vi.fn(),
        }));

        await act(async () => {
            await result.current.submitVote('biz-1', 'recommend', '', true);
        });

        expect(setShowLimitModal).toHaveBeenCalledWith(true);
    });

    it('sends is_flagged=true when bad words are detected', async () => {
        containsBadWords.mockReturnValue(true);
        const sbMock = createSupabaseMock();

        const { result } = renderHook(() => useVoteSubmission({
            user: { id: 'uuid-123', role: 'consumer' },
            supabase: sbMock,
            lang: 'en',
            anonInteractions: 0,
            setAnonInteractions: vi.fn(),
            setUser: vi.fn(),
            showToast: vi.fn(),
            setShowLimitModal: vi.fn(),
            setBusinesses: vi.fn(),
        }));

        await act(async () => {
            await result.current.submitVote('biz-1', 'recommend', 'bad content here', true);
        });

        expect(sbMock.rpc).toHaveBeenCalledWith('submit_vote', expect.objectContaining({
            p_is_flagged: true,
        }));
    });

    it('updates setUser with new Gader total from server response', async () => {
        const sbMock = createSupabaseMock({
            success: true, weight: 1.0, log_id: 'test-uuid', created_at: new Date().toISOString(),
            earned_points: 10, new_gader_total: 50, past_vote_count: 0,
            profile_id: 'uuid-123', fingerprint: null, interaction_type: 'recommend',
        });
        const setUser = vi.fn();

        const { result } = renderHook(() => useVoteSubmission({
            user: { id: 'uuid-123', role: 'consumer', gader: 40 },
            supabase: sbMock,
            lang: 'en',
            anonInteractions: 0,
            setAnonInteractions: vi.fn(),
            setUser,
            showToast: vi.fn(),
            setShowLimitModal: vi.fn(),
            setBusinesses: vi.fn(),
        }));

        await act(async () => {
            await result.current.submitVote('biz-1', 'recommend', '', true);
        });

        expect(setUser).toHaveBeenCalled();
        // Verify the setter function updates gader to new total
        const setterFn = setUser.mock.calls[0][0];
        const result2 = setterFn({ id: 'uuid-123', gader: 40 });
        expect(result2.gader).toBe(50);
    });

    it('shows diminishing returns notification for past_vote_count > 0', async () => {
        const sbMock = createSupabaseMock({
            success: true, weight: 0.5, log_id: 'test-uuid', created_at: new Date().toISOString(),
            earned_points: 5, new_gader_total: 25, past_vote_count: 1,
            profile_id: 'uuid-123', fingerprint: null, interaction_type: 'recommend',
        });
        const showToast = vi.fn();

        const { result } = renderHook(() => useVoteSubmission({
            user: { id: 'uuid-123', role: 'consumer' },
            supabase: sbMock,
            lang: 'en',
            anonInteractions: 0,
            setAnonInteractions: vi.fn(),
            setUser: vi.fn(),
            showToast,
            setShowLimitModal: vi.fn(),
            setBusinesses: vi.fn(),
        }));

        await act(async () => {
            await result.current.submitVote('biz-1', 'recommend', '', true);
        });

        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('reduced'));
    });

    it('for anonymous users: increments localStorage counter', async () => {
        const sbMock = createSupabaseMock({
            success: true, weight: 0.2, log_id: 'anon-uuid', created_at: new Date().toISOString(),
            earned_points: 5, new_gader_total: null, past_vote_count: 0,
            profile_id: null, fingerprint: 'anon-test-fingerprint', interaction_type: 'recommend',
        });
        const setAnonInteractions = vi.fn();

        // Mock localStorage
        const localStorageMock = { getItem: vi.fn().mockReturnValue('2'), setItem: vi.fn() };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

        const { result } = renderHook(() => useVoteSubmission({
            user: null,
            supabase: sbMock,
            lang: 'en',
            anonInteractions: 2,
            setAnonInteractions,
            setUser: vi.fn(),
            showToast: vi.fn(),
            setShowLimitModal: vi.fn(),
            setBusinesses: vi.fn(),
        }));

        await act(async () => {
            await result.current.submitVote('biz-1', 'recommend', '', false);
        });

        expect(setAnonInteractions).toHaveBeenCalledWith(3);
        expect(localStorageMock.setItem).toHaveBeenCalledWith('trust_ledger_interactions', '3');
    });
});
