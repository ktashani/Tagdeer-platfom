import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformHelp } from './PlatformHelp';

// Closed-over mock language state
let mockLang = 'en';

vi.mock('@/context/TagdeerContext', () => ({
    useTagdeer: () => ({
        lang: mockLang
    })
}));

// Mock ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe('PlatformHelp Component', () => {
    beforeEach(() => {
        mockLang = 'en';
        vi.clearAllMocks();
    });

    it('mounts successfully and displays the default tab (Consumer Guide) in English', () => {
        render(<PlatformHelp defaultTab="consumer" />);

        // Header Title
        expect(screen.getByText('Tagdeer Guide | Platform Rules & Equity')).toBeDefined();
        
        // Tab buttons should exist
        expect(screen.getByText('Consumer Guide')).toBeDefined();
        expect(screen.getByText('Merchant Guide')).toBeDefined();

        // Consumer specific cards should be visible
        expect(screen.getByText('Gader Wallet')).toBeDefined();
        expect(screen.getByText('QR Code Scanning')).toBeDefined();
        expect(screen.getByText('Anti-Cheat Rules & Platform Integrity')).toBeDefined();
        expect(screen.getByText('Evaluation (Tagdeer) Rules')).toBeDefined();

        // Merchant specific elements should NOT be visible initially
        expect(screen.queryByText('Subscription Tiers & Capabilities')).toBeNull();
        expect(screen.queryByText('Trust Shield & The Resolution Inbox')).toBeNull();
    });

    it('mounts successfully and displays the default tab (Merchant Guide) in English', () => {
        render(<PlatformHelp defaultTab="merchant" />);

        // Header Title
        expect(screen.getByText('Tagdeer Guide | Platform Rules & Equity')).toBeDefined();

        // Merchant specific elements should be visible
        expect(screen.getByText('Gader Index')).toBeDefined();
        expect(screen.getByText('Subscription Tiers & Capabilities')).toBeDefined();
        expect(screen.getByText('Trust Shield & The Resolution Inbox')).toBeDefined();

        // Consumer specific elements should NOT be visible
        expect(screen.queryByText('Gader Wallet')).toBeNull();
        expect(screen.queryByText('Anti-Cheat Rules & Platform Integrity')).toBeNull();
    });

    it('switches tabs correctly when buttons are clicked', () => {
        render(<PlatformHelp defaultTab="consumer" />);

        // Verify we are on consumer tab
        expect(screen.getByText('Gader Wallet')).toBeDefined();
        expect(screen.queryByText('Gader Index')).toBeNull();

        // Click Merchant Guide tab
        const merchantTabButton = screen.getByText('Merchant Guide').closest('button');
        expect(merchantTabButton).not.toBeNull();
        fireEvent.click(merchantTabButton);

        // Verify we switched to merchant tab
        expect(screen.queryByText('Gader Wallet')).toBeNull();
        expect(screen.getByText('Gader Index')).toBeDefined();

        // Click Consumer Guide tab back
        const consumerTabButton = screen.getByText('Consumer Guide').closest('button');
        expect(consumerTabButton).not.toBeNull();
        fireEvent.click(consumerTabButton);

        // Verify we switched back to consumer tab
        expect(screen.getByText('Gader Wallet')).toBeDefined();
        expect(screen.queryByText('Gader Index')).toBeNull();
    });

    it('properly localizes and formats the layout for Arabic (RTL) mode', () => {
        mockLang = 'ar';
        render(<PlatformHelp defaultTab="consumer" />);

        // Header Title in Arabic
        expect(screen.getByText('دليل منصة تقدير | قواعد وجدارة المنصة')).toBeDefined();
        expect(screen.getByText('أعطهم تقديرك، واكسب قدرك • اكتشف القوانين، الحدود، وحوافز الجدارة')).toBeDefined();

        // Tab buttons in Arabic
        expect(screen.getByText('دليل الزبون')).toBeDefined();
        expect(screen.getByText('دليل التاجر')).toBeDefined();

        // Consumer details in Arabic
        expect(screen.getByText('محفظة قَدْر (Gader Wallet)')).toBeDefined();
        expect(screen.getByText('مسح الكود (QR Scanning)')).toBeDefined();
        expect(screen.getByText('قواعد مكافحة الغش وأمان المنصة (Anti-Cheat)')).toBeDefined();
        
        // Assert anti-cheat rules mentions
        expect(screen.getByText(/فترة انتظار المتجر الواحد/)).toBeDefined();
        expect(screen.getByText(/حماية التجوال/)).toBeDefined();
        expect(screen.getByText(/الحد اليومي العام/)).toBeDefined();
        expect(screen.getByText(/منع المسح الذاتي/)).toBeDefined();
    });

    it('renders the merchant subscription comparison table correctly in Arabic', () => {
        mockLang = 'ar';
        render(<PlatformHelp defaultTab="merchant" />);

        // Arabic headers & text
        expect(screen.getByText('مؤشر القدر (Gader Index)')).toBeDefined();
        expect(screen.getByText('مقارنة الباقات والاشتراكات')).toBeDefined();
        expect(screen.getByText('الميزة / القدرة')).toBeDefined();
        expect(screen.getByText('الباقة المجانية')).toBeDefined();
        expect(screen.getByText('باقة برو')).toBeDefined();
        expect(screen.getByText('باقة المؤسسة')).toBeDefined();

        // Trust Shield info
        expect(screen.getByText('درع الحماية وصندوق الحلول (Trust Shield)')).toBeDefined();
        expect(screen.getByText(/عند قيام زبون موثق بتقديم شكوى سلبية/)).toBeDefined();
    });
});
