import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DiscoverRoute from './page';
import { useTagdeer } from '../../context/TagdeerContext';

vi.mock('../../context/TagdeerContext', () => ({
    useTagdeer: vi.fn(),
}));

describe('DiscoverRoute', () => {
    it('renders without crashing and displays search input', () => {
        useTagdeer.mockReturnValue({
            t: (key) => key,
            lang: 'en',
            isRTL: false,
            businesses: [],
            anonInteractions: 0,
            showToast: vi.fn(),
            setShowLimitModal: vi.fn(),
            setVoteModal: vi.fn(),
            setVoteReason: vi.fn(),
        });

        render(<DiscoverRoute />);
        expect(screen.getByPlaceholderText('search_placeholder')).toBeInTheDocument();
    });
});
