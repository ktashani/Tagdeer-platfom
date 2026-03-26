'use client';

import React, { useState, memo } from 'react';
import { ThumbsUp, ThumbsDown, Heart } from 'lucide-react';

/**
 * ProductCard — Self-contained product card with image, details, and reaction buttons
 * all inside the card. Mobile-adaptive grid-friendly design.
 */
function ProductCard({ item: itemProp, product, theme, lang = 'en', onClick }) {
    const item = itemProp || product;
    if (!item) return null;

    const [likes, setLikes] = useState(item.likes || 0);
    const [dislikes, setDislikes] = useState(item.dislikes || 0);
    const [voted, setVoted] = useState(null);
    const [isVoting, setIsVoting] = useState(false);

    const isAr = lang === 'ar';

    const handleReact = async (e, reaction) => {
        e.stopPropagation(); // Don't trigger card click
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

    return (
        <div className="h-full flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
            {/* Product Image */}
            {item.image_url ? (
                <div className="aspect-square w-full bg-slate-50 dark:bg-slate-800 overflow-hidden relative">
                    <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />
                    {/* Price Badge on Image */}
                    {item.price > 0 && (
                        <div
                            className="absolute bottom-2 left-2 px-3 py-1.5 rounded-xl text-white text-sm font-black shadow-md backdrop-blur-sm"
                            style={{ backgroundColor: `${theme?.primaryColor || '#10b981'}dd` }}
                        >
                            {item.price} <span className="text-[10px] font-medium opacity-80">{isAr ? 'د.ل' : 'LYD'}</span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="aspect-square w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                    <span className="text-4xl opacity-30">📦</span>
                    {item.price > 0 && (
                        <div
                            className="absolute bottom-2 left-2 px-3 py-1.5 rounded-xl text-white text-sm font-black shadow-md"
                            style={{ backgroundColor: theme?.primaryColor || '#10b981' }}
                        >
                            {item.price} <span className="text-[10px] font-medium">{isAr ? 'د.ل' : 'LYD'}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Card Body */}
            <div className="flex flex-col flex-1 p-3.5">
                {/* Product Name */}
                <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-tight line-clamp-2 mb-1">
                    {item.name}
                </h4>

                {/* Description */}
                {item.description && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 mb-2">
                        {item.description}
                    </p>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Reaction Buttons — Inside the card */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                    <button
                        onClick={(e) => handleReact(e, 'like')}
                        disabled={isVoting}
                        className={`flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded-lg transition-all ${voted === 'like'
                                ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
                                : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20'
                            }`}
                    >
                        <ThumbsUp className="w-3.5 h-3.5" /> {likes}
                    </button>
                    <button
                        onClick={(e) => handleReact(e, 'dislike')}
                        disabled={isVoting}
                        className={`flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded-lg transition-all ${voted === 'dislike'
                                ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/30'
                                : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-900/20'
                            }`}
                    >
                        <ThumbsDown className="w-3.5 h-3.5" /> {dislikes}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default memo(ProductCard);
