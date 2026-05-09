import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagdeerProvider, useTagdeer } from './TagdeerContext';

// Mock the useSupabase hook — no live DB in tests
vi.mock('../hooks/useSupabase', () => ({
    useSupabase: () => ({ supabase: null }),
}));

// Provide a mock ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

/**
 * A helper component that exposes context values to the test
 * and provides a button to trigger login.
 */
function TestConsumer() {
    const { user, login, t } = useTagdeer();
    return (
        <div>
            <span data-testid="user-status">{user ? user.userId : 'logged-out'}</span>
            <span data-testid="user-id">{user ? user.id : 'none'}</span>
            <button onClick={() => login('0912345678')}>Login</button>
        </div>
    );
}

describe('TagdeerContext – Integration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('provides default state with no user logged in', () => {
        render(
            <TagdeerProvider>
                <TestConsumer />
            </TagdeerProvider>
        );

        expect(screen.getByTestId('user-status').textContent).toBe('logged-out');
    });

    it('updates user state after calling login (offline fallback)', async () => {
        render(
            <TagdeerProvider>
                <TestConsumer />
            </TagdeerProvider>
        );

        // Before login
        expect(screen.getByTestId('user-status').textContent).toBe('logged-out');

        // Trigger login (supabase is null, so the offline fallback path runs)
        await act(async () => {
            screen.getByText('Login').click();
        });

        // After login — user should be populated with a VIP-XXXXX userId
        const status = screen.getByTestId('user-status').textContent;
        expect(status).toMatch(/^VIP-/);

        // Should also have the mock UUID id
        const userId = screen.getByTestId('user-id').textContent;
        expect(userId).toBe('mock-uuid');
    });

    it('provides businesses array from context (empty when offline)', () => {
        function BizConsumer() {
            const { businesses } = useTagdeer();
            return <span data-testid="biz-count">{businesses.length}</span>;
        }

        render(
            <TagdeerProvider>
                <BizConsumer />
            </TagdeerProvider>
        );

        // When supabase is null (offline/test), businesses starts as an empty array
        // — the provider correctly initializes with [] and skips fetching
        expect(Number(screen.getByTestId('biz-count').textContent)).toBe(0);
    });

    it('provides all expected context keys from the bridge', () => {
        function KeyChecker() {
            const ctx = useTagdeer();
            const requiredKeys = [
                'lang', 'setLang', 't', 'isRTL',
                'businesses', 'setBusinesses',
                'supabase',
                'user', 'setUser', 'loading',
                'showLoginModal', 'setShowLoginModal',
                'login', 'loginWithOtp', 'loginWithEmail',
                'anonInteractions', 'setAnonInteractions',
                'showLimitModal', 'setShowLimitModal',
                'voteModal', 'setVoteModal',
                'toastMessage', 'showToast',
            ];
            const missingKeys = requiredKeys.filter(k => !(k in ctx));
            return <span data-testid="missing-keys">{missingKeys.join(',') || 'none'}</span>;
        }

        render(
            <TagdeerProvider>
                <KeyChecker />
            </TagdeerProvider>
        );

        expect(screen.getByTestId('missing-keys').textContent).toBe('none');
    });
});
