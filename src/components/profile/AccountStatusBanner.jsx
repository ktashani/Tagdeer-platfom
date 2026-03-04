'use client';

import React from 'react';
import { AlertTriangle, Ban, Mail } from 'lucide-react';

/**
 * AccountStatusBanner - Shows a warning banner when a user account
 * is Restricted or Banned. Provides context and contact information.
 */
export function AccountStatusBanner({ status, lang }) {
    if (!status || status === 'Active') return null;

    const isBanned = status === 'Banned';

    return (
        <div className={`p-4 rounded-xl mb-6 border ${isBanned
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
            <div className="flex items-start gap-3">
                {isBanned
                    ? <Ban className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                }
                <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">
                        {isBanned
                            ? (lang === 'ar' ? '⛔ حسابك موقوف' : '⛔ Account Suspended')
                            : (lang === 'ar' ? '⚠️ حسابك مقيّد' : '⚠️ Account Restricted')
                        }
                    </h3>
                    <p className="text-sm leading-relaxed mb-3">
                        {isBanned
                            ? (lang === 'ar'
                                ? 'تم إيقاف حسابك بسبب مخالفة سياسات المنصة. يرجى التواصل مع الإدارة لمزيد من المعلومات.'
                                : 'Your account has been suspended due to a violation of platform policies. Please contact the administration for more information.')
                            : (lang === 'ar'
                                ? 'تم تقييد بعض صلاحيات حسابك. قد لا تتمكن من بعض الإجراءات حتى يتم مراجعة حسابك.'
                                : 'Some features of your account have been restricted. You may not be able to perform certain actions until your account is reviewed.')
                        }
                    </p>
                    <a
                        href="mailto:support@tagdeer.com"
                        className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${isBanned
                            ? 'bg-red-100 hover:bg-red-200 text-red-700'
                            : 'bg-amber-100 hover:bg-amber-200 text-amber-700'
                            }`}
                    >
                        <Mail className="w-4 h-4" />
                        {lang === 'ar' ? 'تواصل مع إدارة تقدير' : 'Contact Tagdeer Admin'}
                    </a>
                </div>
            </div>
        </div>
    );
}
