import React from 'react';
import { X, AlertTriangle, Shield } from 'lucide-react';

export function LimitModal({ isOpen, onClose, t }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 relative animate-fade-in-up text-center">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X className="h-5 w-5" />
        </button>
        
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        
        <h3 className="text-2xl font-bold mb-3">{t('anon_limit_title')}</h3>
        <p className="text-slate-600 mb-6">{t('anon_limit_desc')}</p>
        
        <div className="space-y-3">
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
            <Shield className="h-5 w-5" />
            {t('verify_account')}
          </button>
          <button 
            onClick={onClose} 
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-bold transition-colors"
          >
            {t('maybe_later')}
          </button>
        </div>
      </div>
    </div>
  );
}
