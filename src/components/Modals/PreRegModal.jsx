import React from 'react';
import { X, Store, User, Phone } from 'lucide-react';

export function PreRegModal({ isOpen, onClose, preRegData, setPreRegData, onSubmit, t }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 relative animate-fade-in-up">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X className="h-5 w-5" />
        </button>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
            <Store className="h-6 w-6" />
          </div>
          <h3 className="text-2xl font-bold">{t('prereg_modal_title')}</h3>
        </div>
        
        <p className="text-slate-600 mb-6">{t('prereg_modal_desc')}</p>
        
        <div className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input 
              type="text" 
              placeholder={t('prereg_name')} 
              value={preRegData.name} 
              onChange={(e) => setPreRegData({...preRegData, name: e.target.value})} 
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input 
              type="tel" 
              placeholder={t('prereg_phone')} 
              value={preRegData.phone} 
              onChange={(e) => setPreRegData({...preRegData, phone: e.target.value})} 
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          
          <div className="relative">
            <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input 
              type="text" 
              placeholder={t('prereg_biz_name')} 
              value={preRegData.bizName} 
              onChange={(e) => setPreRegData({...preRegData, bizName: e.target.value})} 
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          
          <button 
            onClick={onSubmit} 
            className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-bold transition-colors"
          >
            {t('prereg_submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
