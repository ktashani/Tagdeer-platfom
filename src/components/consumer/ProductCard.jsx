'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

export default function ProductCard({ item, theme, lang = 'en' }) {
    const [likes, setLikes] = useState(item.likes || 0);
    const [dislikes, setDislikes] = useState(item.dislikes || 0);
    const [voted, setVoted] = useState(null);
    const [isVoting, setIsVoting] = useState(false);

    const handleReact = async (reaction) => {
        if (isVoting || voted === reaction) return;
        setIsVoting(true);

        try {
            const { getDeviceFingerprint } = await import('@/lib/fingerprint');
            const fingerprint = getDeviceFingerprint();

            const res = await fetch('/api/catalog/react', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: item.id, fingerprint, reaction }),
            });

            const data = await res.json();
            if (res.ok) {
                setLikes(data.likes);
                setDislikes(data.dislikes);
                setVoted(reaction);
            }

            // Fire tracking pixel events
            if (typeof window !== 'undefined') {
                if (typeof window.fbq !== 'undefined') {
                    window.fbq('track', 'ViewContent', {
                        content_ids: [item.sku || item.id],
                        content_type: 'product',
                        value: item.price,
                        currency: 'LYD',
                    });
                }
                if (typeof window.gtag !== 'undefined') {
                    window.gtag('event', 'view_item', {
                        items: [{ id: item.sku || item.id, name: item.name, price: item.price }],
                    });
                }
            }
        } catch (err) {
            console.error('React error:', err);
        } finally {
            setIsVoting(false);
        }
    };

    const isAr = lang === 'ar';

    return (
        <div className="flex gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group">
            {item.image_url && (
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden">
                    <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />
                </div>
            )}
            <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-lg truncate">
                        {item.name}
                    </h4>
                    {item.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                            {item.description}
                        </p>
                    )}
                    {item.sku && (
                        <span className="text-[10px] text-slate-400 font-mono mt-1 inline-block">
                            SKU: {item.sku}
                        </span>
                    )}
                </div>
                <div className="flex items-center justify-between mt-2 gap-2">
                    {item.price > 0 && (
                        <span className="font-black text-lg" style={{ color: theme?.primaryColor || '#10b981' }}>
                            {item.price} <span className="text-xs font-medium">{isAr ? 'د.ل' : 'LYD'}</span>
                        </span>
                    )}
                    <div className="flex gap-3 text-sm shrink-0">
                        <button
                            onClick={() => handleReact('like')}
                            disabled={isVoting}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all ${voted === 'like'
                                    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 font-bold'
                                    : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50/50'
                                }`}
                            title={isAr ? 'أعجبني' : 'Like'}
                        >
                            <ThumbsUp className="w-4 h-4" /> {likes}
                        </button>
                        <button
                            onClick={() => handleReact('dislike')}
                            disabled={isVoting}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all ${voted === 'dislike'
                                    ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 font-bold'
                                    : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50/50'
                                }`}
                            title={isAr ? 'لم يعجبني' : 'Dislike'}
                        >
                            <ThumbsDown className="w-4 h-4" /> {dislikes}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
