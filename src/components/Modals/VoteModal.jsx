import React, { useState, useEffect } from 'react';
import { X, ThumbsUp, ThumbsDown, AlertTriangle, Loader2 } from 'lucide-react';
import { generateFingerprint } from '@/lib/fingerprint';
import { supabase } from '@/lib/supabaseClient';

/**
 * VoteModal — collects a vote reason and submits it.
 * For anonymous users: checks vote limit via fingerprint before allowing submission.
 * Per AGENTS.md: "Unverified devices are limited to 3 logs per 24 hours."
 * W13: Now passes client IP for secondary rate limiting (15/IP/24h).
 */
export function VoteModal({ isOpen, onClose, voteReason, setVoteReason, onSubmit, t, type, isAnonymous = false, businessId }) {
  const [anonCheck, setAnonCheck] = useState(null); // { allowed, remaining, limit }
  const [checking, setChecking] = useState(false);
  const [clientIp, setClientIp] = useState(null);

  // Fetch client IP once on mount
  useEffect(() => {
    fetch('/api/client-ip')
      .then(r => r.json())
      .then(d => setClientIp(d.ip))
      .catch(() => setClientIp(null));
  }, []);

  useEffect(() => {
    if (!isOpen || !isAnonymous) return;

    const checkLimit = async () => {
      setChecking(true);
      try {
        const fp = await generateFingerprint();
        const { data, error } = await supabase.rpc('check_anon_vote_limit', {
          p_fingerprint: fp.hash,
          p_ip_hash: null,
          p_device_info: fp.deviceInfo,
        });
        if (!error && data) {
          setAnonCheck(data);
        }
      } catch (err) {
        console.error('Fingerprint check failed:', err);
      }
      setChecking(false);
    };

    checkLimit();
  }, [isOpen, isAnonymous]);

  if (!isOpen) return null;

  const isBlocked = isAnonymous && anonCheck && !anonCheck.allowed;

  const handleSubmit = async () => {
    if (isAnonymous && businessId) {
      // Use the fingerprint RPC to record the vote — now with IP
      const fp = await generateFingerprint();
      const { data, error } = await supabase.rpc('record_anon_vote', {
        p_fingerprint: fp.hash,
        p_business_id: businessId,
        p_type: type,
        p_ip_address: clientIp || null,
      });

      if (error || (data && !data.success)) {
        const errType = data?.error;
        let msg;
        if (errType === 'vote_limit_exceeded') {
          msg = t('vote_limit_exceeded') || 'لقد وصلت للحد الأقصى من التقييمات اليومية';
        } else if (errType === 'ip_rate_limit_exceeded') {
          msg = t('vote_limit_exceeded') || 'تم تجاوز حد التقييمات من هذا الجهاز';
        } else {
          msg = error?.message || 'فشل في تسجيل التقييم';
        }
        alert(msg);
        return;
      }
    }
    // Fall through to parent onSubmit for verified users or after anon recording
    onSubmit();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 relative animate-fade-in-up">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${type === 'recommend' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            {type === 'recommend' ? <ThumbsUp className="h-6 w-6" /> : <ThumbsDown className="h-6 w-6" />}
          </div>
          <h3 className="text-2xl font-bold">{t('vote_modal_title')}</h3>
        </div>

        <p className="text-slate-600 mb-6">
          {type === 'recommend' ? t('vote_modal_desc_rec') : t('vote_modal_desc_comp')}
        </p>

        {/* Anonymous vote limit warning */}
        {isAnonymous && checking && (
          <div className="flex items-center justify-center gap-2 mb-4 py-3 bg-blue-50 rounded-xl text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">جاري التحقق...</span>
          </div>
        )}

        {isBlocked && (
          <div className="flex items-center gap-3 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                وصلت للحد الأقصى ({anonCheck.limit} تقييمات / 24 ساعة)
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                سجّل دخول لتقييمات غير محدودة واكسب نقاط القَدْر
              </p>
            </div>
          </div>
        )}

        {isAnonymous && anonCheck && anonCheck.allowed && (
          <div className="flex items-center gap-2 mb-4 py-2 px-3 bg-slate-100 rounded-lg text-xs text-slate-500">
            <span>📊</span>
            <span>متبقي {anonCheck.remaining} تقييمات مجهولة اليوم</span>
          </div>
        )}

        <textarea
          value={voteReason}
          onChange={(e) => setVoteReason(e.target.value)}
          className="w-full p-4 rounded-xl border border-slate-300 mb-6 h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          placeholder={t('vote_reason')}
          disabled={isBlocked}
        ></textarea>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-xl font-bold transition-colors">
            {t('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isBlocked || checking}
            className={`flex-1 text-white py-4 rounded-xl font-bold transition-colors disabled:opacity-50 ${type === 'recommend' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {t('submit_vote')}
          </button>
        </div>
      </div>
    </div>
  );
}
