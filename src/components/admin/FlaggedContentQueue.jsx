'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * FlaggedContentQueue — Admin moderation queue for logs flagged
 * by the check_log_content trigger.
 *
 * Actions:
 *   - Clear: remove flag, allow log to affect Gader Index
 *   - Delete: permanently remove the log
 *   - Shadow: keep hidden from Gader Index calculation
 */

export default function FlaggedContentQueue() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchFlagged = useCallback(async () => {
    const { data, error } = await supabase
      .from('logs')
      .select(`
        id, type, text, flag_reason, is_flagged, created_at,
        business:business_id (id, name)
      `)
      .eq('is_flagged', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[FlaggedContent] error:', error.message);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFlagged(); }, [fetchFlagged]);

  // CLEAR — unflag, allow to affect Gader Index
  const handleClear = async (logId) => {
    setActionLoading(logId);
    const { error } = await supabase
      .from('logs')
      .update({ is_flagged: false, flag_reason: null })
      .eq('id', logId);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('✅ Log cleared — now affects Gader Index');
      setLogs(prev => prev.filter(l => l.id !== logId));
    }
    setActionLoading(null);
  };

  // DELETE — permanently remove
  const handleDelete = async (logId) => {
    setActionLoading(logId);
    const { error } = await supabase
      .from('logs')
      .delete()
      .eq('id', logId);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('🗑️ Log deleted');
      setLogs(prev => prev.filter(l => l.id !== logId));
    }
    setActionLoading(null);
  };

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">🛡️ المحتوى المُبلَّغ عنه</h2>
          {logs.length > 0 && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
              {logs.length}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">Content flagged by The Judge</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="text-xs uppercase bg-slate-800/50 border-b border-slate-700/50">
            <tr>
              <th className="px-6 py-4 font-medium text-slate-300">Content</th>
              <th className="px-6 py-4 font-medium text-slate-300">Business</th>
              <th className="px-6 py-4 font-medium text-slate-300">Reason</th>
              <th className="px-6 py-4 font-medium text-slate-300">Date</th>
              <th className="px-6 py-4 font-medium text-slate-300 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-400 border-t-transparent" />
                    <span className="text-slate-500">Loading flagged content...</span>
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <div className="text-3xl mb-2">✅</div>
                  No flagged content — all clear
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isActioning = actionLoading === log.id;
                return (
                  <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 max-w-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs ${log.type === 'recommend' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {log.type === 'recommend' ? '👍' : '👎'}
                        </span>
                        <span className="text-xs text-slate-500 uppercase">{log.type}</span>
                      </div>
                      <p className="text-slate-300 text-sm truncate">{log.text || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300">{log.business?.name || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-md border border-red-500/20 font-mono">
                        {log.flag_reason?.replace('content_filter: ', '').replace('shadow_filter: ', '') || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {new Date(log.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleClear(log.id)}
                          disabled={isActioning}
                          className="text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors disabled:opacity-50"
                          title="Clear — allow to affect Gader Index"
                        >
                          ✓ Clear
                        </button>
                        <button
                          onClick={() => handleDelete(log.id)}
                          disabled={isActioning}
                          className="text-red-500 hover:text-red-400 text-xs font-medium transition-colors disabled:opacity-50"
                          title="Delete permanently"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
