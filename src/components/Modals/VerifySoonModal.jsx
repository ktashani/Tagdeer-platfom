import React from 'react';
import { X, Clock, Sparkles } from 'lucide-react';

export function VerifySoonModal({ isOpen, onClose, t }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 relative animate-fade-in-up text-center">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X className="h-5 w-5" />
        </button>
        
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Clock className="h-8 w-8 text-blue-600" />
        </div>
        
        <h3 className="text-2xl font-bold mb-3">{t('verify_soon_title')}</h3>
        <p className="text-slate-600 mb-6">{t('verify_soon_desc')}</p>
        
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
          <div className="flex items-center justify-center gap-2 text-blue-700 font-medium">
            <Sparkles className="h-5 w-5" />
            <span>{t('soon_business_login')}</span>
          </div>
        </div>
        
        <button 
          onClick={onClose} 
          className="w-full mt-6 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors"
        >
          {t('maybe_later')}
        </button>
      </div>
    </div>
  );
}
