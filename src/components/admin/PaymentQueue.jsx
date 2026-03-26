'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Admin Payment Queue — review and action pending upgrade transactions.
 * Supports approve (with quota sync) and reject (with reason).
 */

export default function PaymentQueue() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      let query = supabase
        .from('transactions')
        .select('id, owner_id, business_id, requested_tier, amount, payment_method, payment_gateway, proof_url, status, rejection_reason, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) console.error('PaymentQueue fetch error:', error);
      setTransactions(data || []);
      setLoading(false);
    };
    fetchTransactions();
  }, [filter]);

  const handleApprove = async (txnId) => {
    setActionLoading(txnId);
    try {
      const { data, error } = await supabase.rpc('admin_confirm_payment', { p_txn_id: txnId });
      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === txnId ? { ...t, status: 'completed' } : t));
    } catch (err) {
      console.error('Approve error:', err);
      alert('فشل في الموافقة: ' + err.message);
    }
    setActionLoading(null);
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal);
    try {
      const { error } = await supabase.rpc('admin_reject_payment', {
        p_txn_id: rejectModal,
        p_reason: rejectReason || 'غير مطابق للشروط',
      });
      if (error) throw error;
      setTransactions(prev =>
        prev.map(t => t.id === rejectModal ? { ...t, status: 'rejected', rejection_reason: rejectReason } : t)
      );
    } catch (err) {
      console.error('Reject error:', err);
      alert('فشل في الرفض: ' + err.message);
    }
    setRejectModal(null);
    setRejectReason('');
    setActionLoading(null);
  };

  const statusConfig = {
    pending: { label: 'معلّق', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    completed: { label: 'مقبول ✅', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    rejected: { label: 'مرفوض ❌', color: 'bg-red-100 text-red-800 border-red-200' },
  };

  const gatewayLabels = {
    bank_transfer: 'تحويل بنكي',
    sadad: 'سداد',
    mobi_cash: 'موبي كاش',
    manual: 'يدوي',
  };

  return (
    <div className="space-y-4">
      {/* Header + Filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">طلبات الدفع</h3>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {[
            { value: 'pending', label: 'معلّقة' },
            { value: 'completed', label: 'مقبولة' },
            { value: 'rejected', label: 'مرفوضة' },
            { value: 'all', label: 'الكل' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filter === opt.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {/* Empty */}
      {!loading && transactions.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <div className="text-3xl mb-2">💳</div>
          <p>لا توجد طلبات {filter === 'pending' ? 'معلّقة' : ''}</p>
        </div>
      )}

      {/* Transaction List */}
      {!loading && transactions.map(txn => (
        <div key={txn.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusConfig[txn.status]?.color || ''}`}>
                  {statusConfig[txn.status]?.label || txn.status}
                </span>
                <span className="text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                  {txn.requested_tier}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500 mb-2">
                <div>
                  <span className="font-medium text-slate-700">المبلغ:</span>{' '}
                  {txn.amount} LYD
                </div>
                <div>
                  <span className="font-medium text-slate-700">الطريقة:</span>{' '}
                  {gatewayLabels[txn.payment_gateway] || txn.payment_gateway}
                </div>
                <div>
                  <span className="font-medium text-slate-700">التاريخ:</span>{' '}
                  {new Date(txn.created_at).toLocaleDateString('ar-LY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="truncate" title={txn.owner_id}>
                  <span className="font-medium text-slate-700">التاجر:</span>{' '}
                  {txn.owner_id?.slice(0, 8)}…
                </div>
              </div>

              {txn.proof_url && (
                <a href={txn.proof_url} target="_blank" rel="noopener noreferrer"
                   className="text-xs text-blue-600 hover:underline">
                  📎 عرض إثبات الدفع
                </a>
              )}

              {txn.rejection_reason && (
                <p className="text-xs text-red-600 mt-1">سبب الرفض: {txn.rejection_reason}</p>
              )}
            </div>

            {/* Actions */}
            {txn.status === 'pending' && (
              <div className="flex items-start gap-2 shrink-0">
                <button
                  onClick={() => handleApprove(txn.id)}
                  disabled={actionLoading === txn.id}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {actionLoading === txn.id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                  ) : '✓'} قبول
                </button>
                <button
                  onClick={() => setRejectModal(txn.id)}
                  disabled={actionLoading === txn.id}
                  className="px-4 py-2 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  ✕ رفض
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-3">سبب الرفض</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="اكتب سبب رفض طلب الترقية..."
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm resize-none h-24"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                إلغاء
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
