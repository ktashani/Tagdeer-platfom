import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock TagdeerContext
const mockShowToast = vi.fn();
const mockSupabase = {
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
            })),
            eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
    })),
    rpc: vi.fn(() => Promise.resolve({ error: null }))
};

vi.mock('@/context/TagdeerContext', () => ({
    useTagdeer: () => ({
        supabase: mockSupabase,
        showToast: mockShowToast
    })
}));

vi.mock('date-fns', () => ({
    formatDistanceToNow: () => '1 hour ago'
}));

// Import after mocks
import UsersPage from './page';

// Mock ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('Admin Users Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock supabase.from('profiles').select('*').order(...)
        mockSupabase.from.mockReturnValue({
            select: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue(Promise.resolve({
                    data: [
                        { id: '1', full_name: 'John Consumer', email: 'john@test.com', phone: '+218111', gader_points: 100, role: 'user', status: 'Active', created_at: '2026-01-01T00:00:00Z' },
                        { id: '2', full_name: 'Sarah Merchant', email: 'sarah@biz.com', phone: '+218222', gader_points: 5500, role: 'merchant', status: 'Active', created_at: '2026-01-02T00:00:00Z' },
                        { id: '3', full_name: 'Bad Actor', email: 'bad@test.com', phone: '+218333', gader_points: 0, role: 'user', status: 'Banned', created_at: '2026-01-03T00:00:00Z' },
                        { id: '4', full_name: 'Flagged Merchant', email: 'flag@biz.com', phone: '+218444', gader_points: 200, role: 'merchant', status: 'Restricted', created_at: '2026-01-04T00:00:00Z' },
                    ],
                    error: null
                })),
                eq: vi.fn()
            })
        });
    });

    it('renders the page with header and tabs', async () => {
        await act(async () => {
            render(<UsersPage />);
        });

        expect(screen.getByText('User Management')).toBeDefined();
        expect(screen.getByText(/All Users/)).toBeDefined();
        expect(screen.getByText(/Consumers/)).toBeDefined();
        expect(screen.getByText(/Merchants/)).toBeDefined();
    });

    it('displays all users on the All tab', async () => {
        await act(async () => {
            render(<UsersPage />);
        });

        // Wait for the users to render
        expect(screen.getByText('John Consumer')).toBeDefined();
        expect(screen.getByText('Sarah Merchant')).toBeDefined();
        expect(screen.getByText('Bad Actor')).toBeDefined();
        expect(screen.getByText('Flagged Merchant')).toBeDefined();
    });

    it('renders correct status badges', async () => {
        await act(async () => {
            render(<UsersPage />);
        });

        const activeBadges = screen.getAllByText('Active');
        const bannedBadges = screen.getAllByText('Banned');
        const restrictedBadges = screen.getAllByText('Restricted');

        expect(activeBadges.length).toBeGreaterThanOrEqual(1);
        expect(bannedBadges.length).toBeGreaterThanOrEqual(1);
        expect(restrictedBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('renders correct role badges', async () => {
        await act(async () => {
            render(<UsersPage />);
        });

        const consumerBadges = screen.getAllByText('Consumer');
        const merchantBadges = screen.getAllByText('Merchant');

        expect(consumerBadges.length).toBe(2); // John + Bad Actor
        expect(merchantBadges.length).toBe(2); // Sarah + Flagged Merchant
    });

    it('filters by Consumers tab', async () => {
        await act(async () => {
            render(<UsersPage />);
        });

        const consumersTab = screen.getByText(/Consumers/);
        await act(async () => {
            fireEvent.click(consumersTab);
        });

        expect(screen.getByText('John Consumer')).toBeDefined();
        expect(screen.getByText('Bad Actor')).toBeDefined();
        expect(screen.queryByText('Sarah Merchant')).toBeNull();
        expect(screen.queryByText('Flagged Merchant')).toBeNull();
    });

    it('filters by Merchants tab', async () => {
        await act(async () => {
            render(<UsersPage />);
        });

        const merchantsTab = screen.getByText(/Merchants/);
        await act(async () => {
            fireEvent.click(merchantsTab);
        });

        expect(screen.getByText('Sarah Merchant')).toBeDefined();
        expect(screen.getByText('Flagged Merchant')).toBeDefined();
        expect(screen.queryByText('John Consumer')).toBeNull();
        expect(screen.queryByText('Bad Actor')).toBeNull();
    });

    it('shows restricted and banned counts in summary badges', async () => {
        await act(async () => {
            render(<UsersPage />);
        });

        expect(screen.getByText('1 Restricted')).toBeDefined();
        expect(screen.getByText('1 Banned')).toBeDefined();
    });

    it('search filters by user name', async () => {
        await act(async () => {
            render(<UsersPage />);
        });

        const searchInput = screen.getByPlaceholderText('Search by name, email, phone...');
        await act(async () => {
            fireEvent.change(searchInput, { target: { value: 'John' } });
        });

        expect(screen.getByText('John Consumer')).toBeDefined();
        expect(screen.queryByText('Sarah Merchant')).toBeNull();
    });
});
