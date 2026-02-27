import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProfilePage from './page';
import { useTagdeer } from '@/context/TagdeerContext';

// Mock Dependencies
vi.mock('@/context/TagdeerContext', () => ({
    useTagdeer: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/supabaseClient', () => {
    const chainable = () => {
        const self = {
            select: vi.fn(() => self),
            eq: vi.fn(() => self),
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            update: vi.fn(() => self),
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            then: (resolve) => resolve({ data: [], error: null }),
        };
        return self;
    };
    return {
        supabase: {
            from: vi.fn(() => chainable()),
        },
    };
});

// Provide a mock ResizeObserver to prevent Radix UI from crashing in jsdom
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

describe('ProfilePage', () => {
    it('renders user details correctly', () => {
        useTagdeer.mockReturnValue({
            user: {
                id: '123',
                full_name: 'Omar Mukhtar',
                birth_date: '1990-01-01',
                city: 'Tripoli',
                gender: 'male'
            },
            logout: vi.fn(),
            t: (key) => key,
            isRTL: false,
            setShowLoginModal: vi.fn(),
            lang: 'en',
        });

        render(<ProfilePage />);

        // Test that the mock user data populated the UI elements
        expect(screen.getByDisplayValue('Omar Mukhtar')).toBeInTheDocument();
    });
});
