'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ThumbsUp, ThumbsDown, Package } from 'lucide-react';

export default function ProductDetailModal({ isOpen, onClose, product, theme, isRTL, allProducts = [] }) {
    if (!product) return null;

    const t = isRTL ? {
        noDesc: 'لا يوجد وصف.',
        currency: 'د.ل',
        related: 'منتجات مشابهة',
    } : {
        noDesc: 'No description available.',
        currency: 'LYD',
        related: 'Related Products',
    };

    // Related products: same category, exclude current
    const relatedProducts = allProducts
        .filter(p => p.id !== product.id && p.category === product.category)
        .slice(0, 3);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className={`sm:max-w-md bg-white dark:bg-slate-900 border-none p-0 overflow-hidden max-h-[90vh] overflow-y-auto ${isRTL ? 'text-right' : 'text-left'}`}>
                <div className="relative w-full h-64 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                        <Package className="w-16 h-16 text-slate-300" />
                    )}
                </div>
                <div className="p-6">
                    <DialogHeader>
                        <div className={`flex justify-between items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <div>
                                <DialogTitle className={`text-2xl font-bold ${isRTL ? 'text-right' : 'text-left'}`}>{product.name}</DialogTitle>
                                {product.category && (
                                    <span className={`text-xs font-bold uppercase tracking-widest text-slate-500 mt-1 block ${isRTL ? 'text-right' : 'text-left'}`}>
                                        {product.category}
                                    </span>
                                )}
                            </div>
                            <span className="font-bold text-lg shrink-0" style={{ color: theme?.primaryColor || '#10b981' }}>
                                {product.price} {t.currency}
                            </span>
                        </div>
                    </DialogHeader>
                    <DialogDescription className={`mt-4 text-slate-600 dark:text-slate-300 text-base ${isRTL ? 'text-right' : 'text-left'}`}>
                        {product.description || t.noDesc}
                    </DialogDescription>

                    <div className={`mt-6 flex gap-4 pt-6 border-t border-slate-100 dark:border-slate-800 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg text-sm font-bold">
                            <ThumbsUp className="w-4 h-4" /> {product.likes || 0}
                        </div>
                        <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-3 py-1.5 rounded-lg text-sm font-bold">
                            <ThumbsDown className="w-4 h-4" /> {product.dislikes || 0}
                        </div>
                    </div>

                    {/* Related products from same category */}
                    {relatedProducts.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <h4 className={`text-sm font-bold uppercase tracking-widest text-slate-500 mb-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                                {t.related}
                            </h4>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                                {relatedProducts.map(rp => (
                                    <div key={rp.id} className="min-w-[120px] flex-shrink-0 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center cursor-default">
                                        <div className="w-full h-16 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-2 overflow-hidden">
                                            {rp.image_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={rp.image_url} alt={rp.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Package className="w-6 h-6 text-slate-400" />
                                            )}
                                        </div>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{rp.name}</p>
                                        <p className="text-xs font-medium mt-0.5" style={{ color: theme?.primaryColor || '#10b981' }}>
                                            {rp.price} {t.currency}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
