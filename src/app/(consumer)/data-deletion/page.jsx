'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shield, Trash2, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

function DataDeletionContent() {
    const searchParams = useSearchParams();
    const confirmationCode = searchParams.get('code');

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">Tagdeer — تقدير</h1>
                        <p className="text-xs text-slate-500">Data Protection & Privacy</p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-10">
                {/* Confirmation banner (shown when redirected from Facebook) */}
                {confirmationCode && (
                    <div className="mb-8 p-5 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-4">
                        <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                        <div>
                            <h2 className="text-base font-bold text-green-800 mb-1">
                                Data Deletion Request Received
                            </h2>
                            <p className="text-sm text-green-700 mb-2">
                                Your data deletion request has been processed. Your personal information
                                has been anonymized and your Facebook account has been unlinked from Tagdeer.
                            </p>
                            <div className="bg-white border border-green-200 rounded-lg px-4 py-2 inline-block">
                                <span className="text-xs text-slate-500">Confirmation Code: </span>
                                <span className="font-mono font-bold text-green-800">{confirmationCode}</span>
                            </div>
                            <p className="text-xs text-green-600 mt-2">
                                Please save this code for your records. Data deletion is typically completed within 24 hours.
                            </p>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="space-y-8">
                    {/* Title */}
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
                            <Trash2 className="w-8 h-8 text-red-500" />
                            User Data Deletion
                        </h1>
                        <p className="text-slate-600 leading-relaxed">
                            Tagdeer respects your privacy and complies with data protection regulations.
                            You have the right to request deletion of your personal data at any time.
                        </p>
                    </div>

                    {/* Arabic Section */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100" dir="rtl">
                        <h2 className="text-xl font-bold text-slate-900 mb-2">حذف بيانات المستخدم</h2>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            تحترم منصة تقدير خصوصيتك وتلتزم بقوانين حماية البيانات.
                            يحق لك طلب حذف بياناتك الشخصية في أي وقت.
                            عند حذف حسابك، سيتم إزالة جميع المعلومات الشخصية المرتبطة بحسابك بشكل دائم.
                        </p>
                    </div>

                    {/* What we delete */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">What Data We Delete</h2>
                        <div className="grid gap-3">
                            {[
                                'Your name, email address, and profile picture',
                                'Phone number and verification status',
                                'Facebook account linkage and OAuth tokens',
                                'Profile bio and personal preferences',
                                'Language and notification settings',
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
                                    <Trash2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                    <span className="text-sm text-slate-700">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* What we retain */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">What We May Retain</h2>
                        <p className="text-sm text-slate-600 mb-3">
                            For legal compliance and platform integrity, we may retain anonymized records of:
                        </p>
                        <div className="grid gap-3">
                            {[
                                'Anonymized review logs (with no personally identifiable information)',
                                'Transaction and coupon audit records (required for financial compliance)',
                                'Aggregated business ratings (your individual identity is removed)',
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl">
                                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <span className="text-sm text-slate-700">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* How to request */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">How to Request Data Deletion</h2>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                    <span className="text-blue-600 font-bold text-sm">1</span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">Via Facebook</h3>
                                    <p className="text-sm text-slate-600">
                                        Remove the Tagdeer app from your Facebook account settings.
                                        Go to <strong>Facebook → Settings → Apps and Websites</strong> → find Tagdeer → Remove.
                                        This automatically triggers our data deletion process.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                    <span className="text-blue-600 font-bold text-sm">2</span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">Via Email</h3>
                                    <p className="text-sm text-slate-600">
                                        Send a data deletion request to{' '}
                                        <a href="mailto:privacy@tagdeer.app" className="text-blue-600 font-semibold hover:underline">
                                            privacy@tagdeer.app
                                        </a>{' '}
                                        or{' '}
                                        <a href="mailto:k.tashani94@gmail.com" className="text-blue-600 font-semibold hover:underline">
                                            k.tashani94@gmail.com
                                        </a>{' '}
                                        with the subject line "Data Deletion Request" and your account email address.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                    <span className="text-blue-600 font-bold text-sm">3</span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">Processing Time</h3>
                                    <p className="text-sm text-slate-600">
                                        Data deletion requests are processed within <strong>24 hours</strong>.
                                        You will receive a confirmation code and can track the status on this page.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                        <div className="flex items-start gap-4">
                            <Mail className="w-6 h-6 text-blue-600 shrink-0 mt-1" />
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 mb-1">Contact Us</h2>
                                <p className="text-sm text-slate-600 mb-3">
                                    If you have any questions about your data or privacy, contact our data protection team:
                                </p>
                                <div className="space-y-1">
                                    <p className="text-sm">
                                        <span className="text-slate-500">Email: </span>
                                        <a href="mailto:k.tashani94@gmail.com" className="text-blue-600 font-semibold hover:underline">
                                            k.tashani94@gmail.com
                                        </a>
                                    </p>
                                    <p className="text-sm">
                                        <span className="text-slate-500">Platform: </span>
                                        <a href="https://tagdeer.app" className="text-blue-600 font-semibold hover:underline">
                                            tagdeer.app
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 bg-white mt-12 py-6">
                <div className="max-w-3xl mx-auto px-4 text-center text-xs text-slate-400">
                    <p>© {new Date().getFullYear()} Tagdeer — تقدير. All rights reserved.</p>
                    <p className="mt-1">أعطيهم تقديرك، واكسب قدرك</p>
                </div>
            </footer>
        </div>
    );
}

export default function DataDeletionPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-slate-500">Loading...</p>
            </div>
        }>
            <DataDeletionContent />
        </Suspense>
    );
}
