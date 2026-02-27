'use client';
import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export function Toast({ message, onClose }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  const isError = message.toLowerCase().includes('error') || message.toLowerCase().includes('failed');
  const isSuccess = message.toLowerCase().includes('success') || message.toLowerCase().includes('received');

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-fade-in-up">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-lg ${isError ? 'bg-red-600' : isSuccess ? 'bg-green-600' : 'bg-slate-800'} text-white`}>
        {isError ? <AlertCircle className="h-5 w-5" /> : isSuccess ? <CheckCircle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
        <span className="font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
