'use client';

import { useState } from 'react';
import ProductCard from '@/components/consumer/ProductCard';
import ProductDetailModal from './ProductDetailModal';
import { LayoutGrid } from 'lucide-react';

export default function StorefrontProductsUI({ groupedProducts, title, allProducts, theme, isRTL }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

    if (!allProducts || allProducts.length === 0) return null;

    const visibleProducts = isExpanded ? allProducts : allProducts.slice(0, 4);

    return (
        <div className="mt-12">
            <div className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h3 className={`text-2xl font-black flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="w-2 h-8 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                    {title}
                </h3>
                {allProducts.length > 4 && !isExpanded && (
                    <button 
                        onClick={() => setIsExpanded(true)}
                        className={`text-sm font-bold flex items-center gap-2 hover:opacity-70 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
                        style={{ color: theme.primaryColor }}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        {isRTL ? `عرض الكل (${allProducts.length})` : `Show All (${allProducts.length})`}
                    </button>
                )}
            </div>

            {isExpanded ? (
                <div className="space-y-10">
                    {Object.entries(groupedProducts).map(([category, items]) => (
                        <div key={category}>
                            <h4 className={`font-bold text-lg mb-4 opacity-80 uppercase tracking-wide text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                                {category}
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                                {items.map(item => (
                                    <div key={item.id} onClick={() => setSelectedProduct(item)} className="cursor-pointer h-full">
                                        <ProductCard product={item} onClick={() => {}} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    {visibleProducts.map(item => (
                        <div key={item.id} onClick={() => setSelectedProduct(item)} className="cursor-pointer h-full">
                            <ProductCard product={item} onClick={() => {}} />
                        </div>
                    ))}
                </div>
            )}

            <ProductDetailModal 
                isOpen={!!selectedProduct} 
                onClose={() => setSelectedProduct(null)} 
                product={selectedProduct} 
                theme={theme}
                isRTL={isRTL}
                allProducts={allProducts}
            />
        </div>
    );
}
