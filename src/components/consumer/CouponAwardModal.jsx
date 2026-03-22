import React, { useEffect } from 'react';
import { Gift, X, CheckCircle, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';

export function CouponAwardModal({ isOpen, onClose, data, t, isRTL, showToast }) {
    useEffect(() => {
        if (isOpen && data) {
            // Trigger confetti
            const duration = 3000;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#10b981', '#fbbf24', '#3b82f6']
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#10b981', '#fbbf24', '#3b82f6']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();
        }
    }, [isOpen, data]);

    if (!isOpen || !data) return null;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(data.serial);
        showToast(isRTL ? 'تم نسخ الرمز!' : 'Code copied!');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`}>
                {/* Header Pattern */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-8 text-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-white to-transparent" style={{ backgroundSize: '20px 20px' }} />
                    <Gift className="w-16 h-16 text-white mx-auto relative z-10 drop-shadow-md animate-bounce" />
                    <h2 className="text-2xl font-black text-white mt-4 relative z-10 leading-tight">
                        {isRTL ? 'آلف مبروك!' : 'Congratulations!'}
                    </h2>
                    <p className="text-emerald-100 mt-2 font-medium relative z-10">
                        {isRTL ? 'لقد ربحت قسيمة جديدة لمساهمتك' : 'You earned a new coupon for your contribution'}
                    </p>
                </div>

                <div className="p-6 md:p-8">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 text-center relative mt-[-3rem] shadow-lg z-20">
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">{data.business}</div>
                        
                        <div className="text-3xl font-black text-slate-800 dark:text-white my-3 flex items-center justify-center gap-2">
                            {data.offer_type === 'percentage' && `${data.discount_value}% OFF`}
                            {data.offer_type === 'fixed' && `${data.discount_value} LYD OFF`}
                            {data.offer_type === 'free_item' && 'FREE ITEM'}
                        </div>

                        <div className="flex justify-center my-6">
                            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                                <QRCodeSVG value={data.serial} size={150} level="H" />
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-3">
                            <div className="font-mono text-xl font-bold tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                {data.serial}
                            </div>
                            <button
                                onClick={copyToClipboard}
                                className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                <Copy className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-6 font-medium leading-relaxed">
                        {isRTL
                            ? `هذه القسيمة متوفرة الآن في محفظتك. يمكنك استخدامها عند زيارتك لـ ${data.business}.`
                            : `This coupon is now available in your wallet. Show it on your next visit to ${data.business}.`}
                    </p>

                    <button
                        onClick={onClose}
                        className="w-full mt-6 py-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                        {isRTL ? 'رائع، شكراً!' : 'Awesome, thanks!'} <CheckCircle className="w-5 h-5" />
                    </button>
                </div>
                
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors z-20"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
