'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * UpgradeRequestForm — allows merchants to request a tier upgrade.
 * Inserts into `transactions` table and shows pending status.
 */
export default function UpgradeRequestForm({ currentTier, businessId, onSuccess }) {
    const [tiers, setTiers] = useState([]);
    const [selectedTier, setSelectedTier] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [proofUrl, setProofUrl] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            const { data } = await supabase
                .from('subscription_tiers')
                .select('id, name, price, description, allocations')
                .order('price', { ascending: true });
            setTiers((data || []).filter(t => t.name.toLowerCase() !== (currentTier || '').toLowerCase()));
        };
        fetch();
    }, [currentTier]);

    const handleSubmit = async () => {
        if (!selectedTier) return;
        setSubmitting(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase.from('transactions').insert([{
                owner_id: user.id,
                business_id: businessId || null,
                requested_tier: selectedTier.name,
                amount: selectedTier.price || 0,
                payment_method: 'manual',
                payment_gateway: 'bank_transfer',
                proof_url: proofUrl || null,
                status: 'pending',
            }]);

            if (error) throw error;
            setSubmitted(true);
            if (onSuccess) onSuccess();
        } catch (err) {
            alert('فشل في إرسال الطلب: ' + err.message);
        }
        setSubmitting(false);
    };

    if (submitted) {
        return (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center animate-in zoom-in-95">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-lg font-bold text-emerald-400">تم إرسال طلب الترقية!</h3>
                <p className="text-emerald-400/70 text-sm mt-1">سيتم مراجعة طلبك من قبل الإدارة. ستتلقى إشعاراً عند الموافقة.</p>
            </div>
        );
    }

    if (!showForm) {
        return (
            <button
                onClick={() => setShowForm(true)}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 text-sm"
            >
                ⬆️ ترقية الاشتراك
            </button>
        );
    }

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 space-y-4 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">اختر الباقة</h3>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-200 text-sm">✕</button>
            </div>

            {/* Tier Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tiers.map(tier => (
                    <button
                        key={tier.id}
                        onClick={() => setSelectedTier(tier)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                            selectedTier?.id === tier.id
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-slate-600 hover:border-slate-500'
                        }`}
                    >
                        <div className="font-bold text-white text-sm">{tier.name}</div>
                        <div className="text-blue-400 font-bold mt-1">{tier.price} LYD<span className="text-xs text-slate-400">/شهر</span></div>
                        {tier.description && (
                            <p className="text-xs text-slate-400 mt-2 line-clamp-2">{tier.description}</p>
                        )}
                        {tier.allocations && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {Object.entries(tier.allocations).slice(0, 3).map(([k, v]) => (
                                    <span key={k} className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                                        {k}: {v}
                                    </span>
                                ))}
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {selectedTier && (
                <>
                    {/* Proof Upload */}
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">إثبات الدفع (رابط صورة التحويل)</label>
                        <input
                            type="url"
                            value={proofUrl}
                            onChange={(e) => setProofUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            dir="ltr"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">اختياري — يمكنك رفع الإثبات لاحقاً من صفحة الفواتير</p>
                    </div>

                    {/* Bank Details */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                        <p className="text-xs font-bold text-blue-400 mb-2">معلومات التحويل البنكي:</p>
                        <div className="text-xs text-blue-300 space-y-1">
                            <p>البنك: مصرف الجمهورية</p>
                            <p>رقم الحساب: 1234-5678-9012</p>
                            <p>المبلغ: <strong>{selectedTier.price} LYD</strong></p>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/20"
                    >
                        {submitting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        ) : '📤'} إرسال طلب الترقية
                    </button>
                </>
            )}
        </div>
    );
}
