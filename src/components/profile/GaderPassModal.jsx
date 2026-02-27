'use client';

import React from 'react';
import QRCode from 'react-qr-code';
import { X } from 'lucide-react';

/**
 * GaderPassModal — QR code modal for the user's Digital Gader Pass.
 */
export function GaderPassModal({ user, lang, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative border border-gray-100" onClick={e => e.stopPropagation()}>
                {/* Top Bar */}
                <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600">{lang === 'ar' ? 'بطاقة قَدِّر الرقمية' : 'Digital Gader Pass'}</span>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-col items-center p-8">
                    {/* Tier Badge */}
                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-6 ${(user.gader || 0) >= 500
                        ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                        : (user.gader || 0) >= 100
                            ? 'bg-slate-50 text-slate-600 border border-slate-300'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                        <span className="text-lg">{(user.gader || 0) >= 500 ? '🥇' : (user.gader || 0) >= 100 ? '🥈' : '🥉'}</span>
                        {(user.gader || 0) >= 500 ? 'Gold' : (user.gader || 0) >= 100 ? 'Silver' : 'Bronze'}
                    </div>

                    {/* QR Code */}
                    <div className="p-4 bg-white border-2 border-dashed border-gray-200 rounded-xl">
                        <QRCode
                            value={`https://tagdeer.app/verify-user/${user.id}`}
                            size={180}
                            bgColor="#ffffff"
                            fgColor="#0f172a"
                            level="H"
                        />
                    </div>

                    {/* Monospace ID */}
                    <div className="font-mono text-sm text-gray-500 mt-4 tracking-wider bg-gray-50 px-3 py-1 rounded-md">
                        ID: {(user.id || '').substring(0, 8)}
                    </div>

                    {/* Footer Text */}
                    <p className="text-xs text-gray-400 mt-6 text-center">
                        {lang === 'ar'
                            ? 'اعرض هذا الرمز لأصحاب الأعمال للحصول على مكافآتك.'
                            : 'Show this to business owners to claim your rewards.'}
                    </p>
                </div>
            </div>
        </div>
    );
}
