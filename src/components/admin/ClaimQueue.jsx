'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * ClaimQueue — Admin component for managing business ownership claims.
 * Fetches pending claims from business_claims + joined business/profile data,
 * and calls admin_approve_claim / admin_reject_claim RPCs.
 *
 * Dark theme variant for the admin portal.
 */

const STATUS_STYLES = {
  pending: {
    bg: 'bg-amber-500/10 border-amber-500/20',
    text: 'text-amber-400',
    label: 'قيد المراجعة',
  },
  approved: {
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-400',
    label: 'تمت الموافقة',
  },
  rejected: {
    bg: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-400',
    label: 'مرفوض',
  },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ClaimQueue() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // claim_id being actioned
  const [filter, setFilter] = useState('pending'); // pending | approved | rejected | all
  const [rejectModal, setRejectModal] = useState(null); // claim being rejected
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchClaims = useCallback(async () => {
    try {
      let query = supabase
        .from('business_claims')
        .select(`
          id, status, created_at, updated_at,
          business:business_id (id, name, city, category),
          profile:user_id (id, full_name, phone, role)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ClaimQueue] fetch error:', error.message);
        showToast(error.message, 'error');
        return;
      }

      setClaims(data || []);
    } catch (err) {
      console.error('[ClaimQueue] unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, showToast]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  // APPROVE
  const handleApprove = async (claimId) => {
    setActionLoading(claimId);
    try {
      const { data, error } = await supabase.rpc('admin_approve_claim', {
        p_claim_id: claimId,
      });

      if (error) {
        showToast(error.message, 'error');
        return;
      }

      showToast(`✅ Claim approved — ${data?.user_name || 'merchant'} promoted to merchant`);
      setClaims((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' } : c))
      );
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // REJECT
  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      const { error } = await supabase.rpc('admin_reject_claim', {
        p_claim_id: rejectModal.id,
        p_reason: rejectReason || null,
      });

      if (error) {
        showToast(error.message, 'error');
        return;
      }

      showToast('❌ Claim rejected');
      setClaims((prev) =>
        prev.map((c) => (c.id === rejectModal.id ? { ...c, status: 'rejected' } : c))
      );
      setRejectModal(null);
      setRejectReason('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = claims.filter((c) => c.status === 'pending').length;

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">طلبات تسجيل الأعمال</h2>
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex gap-1 bg-slate-900/50 rounded-lg p-1">
          {['pending', 'approved', 'rejected', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setLoading(true); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                filter === f
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_STYLES[f]?.label || f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="text-xs uppercase bg-slate-800/50 border-b border-slate-700/50">
            <tr>
              <th className="px-6 py-4 font-medium text-slate-300">Business</th>
              <th className="px-6 py-4 font-medium text-slate-300">Merchant</th>
              <th className="px-6 py-4 font-medium text-slate-300">Date</th>
              <th className="px-6 py-4 font-medium text-slate-300">Status</th>
              <th className="px-6 py-4 font-medium text-slate-300 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-400 border-t-transparent" />
                    <span className="text-slate-500">Loading claims...</span>
                  </div>
                </td>
              </tr>
            ) : claims.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No {filter !== 'all' ? filter : ''} claims found
                </td>
              </tr>
            ) : (
              claims.map((claim) => {
                const style = STATUS_STYLES[claim.status] || STATUS_STYLES.pending;
                const isActioning = actionLoading === claim.id;
                return (
                  <tr
                    key={claim.id}
                    className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">
                        {claim.business?.name || 'Unknown Business'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {[claim.business?.city, claim.business?.category].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-300">{claim.profile?.full_name || 'Unknown'}</div>
                      <div className="text-xs text-slate-500">{claim.profile?.phone || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {timeAgo(claim.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {claim.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleApprove(claim.id)}
                            disabled={isActioning}
                            className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {isActioning ? (
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-emerald-400 border-t-transparent" />
                            ) : (
                              '✓'
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModal(claim)}
                            disabled={isActioning}
                            className="text-slate-500 hover:text-red-400 font-medium transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">
                          {claim.status === 'approved' ? 'Processed' : 'Declined'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-1">Reject Claim</h3>
            <p className="text-sm text-slate-400 mb-4">
              Rejecting claim for <span className="text-white font-medium">{rejectModal.business?.name}</span> by{' '}
              <span className="text-white font-medium">{rejectModal.profile?.full_name}</span>
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="سبب الرفض (اختياري)..."
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 resize-none h-24"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === rejectModal.id}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {actionLoading === rejectModal.id && (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                )}
                Reject Claim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium animate-in slide-in-from-bottom-4 duration-300 ${
          toast.type === 'error'
            ? 'bg-red-950 border-red-800 text-red-200'
            : 'bg-emerald-950 border-emerald-800 text-emerald-200'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
