'use client';

import React from 'react';
import { useTagdeer } from '@/context/TagdeerContext';
import { Toast } from '@/components/Toast';

export default function PortalsLayout({ children }) {
    const { isRTL, toastMessage, setToastMessage } = useTagdeer();

    return (
        <div
            className={`min-h-screen flex flex-col font-sans bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 ${isRTL ? 'text-right' : 'text-left'}`}
            dir={isRTL ? 'rtl' : 'ltr'}
        >
            <main className="flex-grow">
                {children}
            </main>

            <Toast message={toastMessage} onClose={() => setToastMessage('')} />
        </div>
    );
}
