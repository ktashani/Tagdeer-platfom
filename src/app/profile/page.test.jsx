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

vi.mock('@/lib/supabaseClient', () => ({
    supabase: {
        from: vi.fn(() => ({
            update: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null }))
            }))
        }))
    }
}));

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
