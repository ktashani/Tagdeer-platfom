import React from 'react';
import { X, ThumbsUp, ThumbsDown } from 'lucide-react';

export function VoteModal({ isOpen, onClose, voteReason, setVoteReason, onSubmit, t, type }) {
  if (!isOpen) return null;

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
        
        <textarea 
          value={voteReason} 
          onChange={(e) => setVoteReason(e.target.value)}
          className="w-full p-4 rounded-xl border border-slate-300 mb-6 h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          placeholder={t('vote_reason')}
        ></textarea>
        
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-xl font-bold transition-colors">
            {t('cancel')}
          </button>
          <button 
            onClick={onSubmit} 
            className={`flex-1 text-white py-4 rounded-xl font-bold transition-colors ${type === 'recommend' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {t('submit_vote')}
          </button>
        </div>
      </div>
    </div>
  );
}
