import React, { useState } from 'react';
import { X, ThumbsUp, ThumbsDown } from 'lucide-react';
import Link from 'next/link';

export function VoteModal({ isOpen, onClose, voteReason, setVoteReason, onSubmit, t, type, isAnonymous, lang }) {
  const [tosAccepted, setTosAccepted] = useState(false);

  if (!isOpen) return null;

  const isAr = lang === 'ar';

  const handleClose = () => {
    setTosAccepted(false);
    onClose();
  };

  const handleSubmit = () => {
    if (!tosAccepted) return;
    onSubmit();
    setTosAccepted(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 relative animate-fade-in-up">
        <button onClick={handleClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors">
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
        
        <textarea 
          value={voteReason} 
          onChange={(e) => setVoteReason(e.target.value)}
          className="w-full p-4 rounded-xl border border-slate-300 mb-4 h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          placeholder={t('vote_reason')}
        ></textarea>

        {/* ═══ LEGAL CONSENT GATE ═══ */}
        <label className="flex items-start gap-2.5 text-xs text-slate-500 mb-4 cursor-pointer select-none bg-slate-50 border border-slate-200 rounded-xl p-3 hover:bg-slate-100 transition-colors">
          <input
            type="checkbox"
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
          />
          <span className="leading-relaxed">
            {isAr
              ? <>أفهم أن هذا رأيي الشخصي وأتحمل المسؤولية الكاملة عن كلماتي. أوافق على <Link href="/terms" className="text-blue-600 hover:underline font-semibold" target="_blank">شروط الاستخدام</Link>.</>
              : <>I understand this is my personal opinion and I take full responsibility for my words. I agree to the <Link href="/terms" className="text-blue-600 hover:underline font-semibold" target="_blank">Terms of Use</Link>.</>
            }
          </span>
        </label>
        
        <div className="flex gap-3">
          <button onClick={handleClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-xl font-bold transition-colors">
            {t('cancel')}
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!tosAccepted}
            className={`flex-1 text-white py-4 rounded-xl font-bold transition-all ${
              !tosAccepted 
                ? 'bg-slate-300 cursor-not-allowed' 
                : type === 'recommend' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {t('submit_vote')}
          </button>
        </div>
      </div>
    </div>
  );
}
