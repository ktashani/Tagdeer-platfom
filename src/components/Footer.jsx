'use client';

import { BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

export function Footer({ t }) {
    return (
        <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-2">
                    <BadgeCheck className="h-8 w-8 text-green-500" />
                    <span className="font-bold text-xl text-white">Tagdeer</span>
                </div>
                <div className="flex gap-4 items-center text-sm">
                    <Link href="/discover" className="hover:text-white transition-colors">Discover</Link>
                    <Link href="/about" className="hover:text-white transition-colors">About</Link>
                    <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                    <a href="/merchant/login" className="hover:text-white transition-colors font-medium text-blue-400 hover:text-blue-300">Merchant Login</a>
                </div>
                <div className="flex flex-col items-center md:items-end gap-2">
                    <Link href="/privacy" className="text-sm hover:text-white transition-colors">
                        Privacy Policy | سياسة الخصوصية
                    </Link>
                    <p className="text-sm">© 2026 Tagdeer Libya.</p>
                </div>
            </div>
        </footer>
    );
}
