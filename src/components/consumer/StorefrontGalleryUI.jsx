'use client';

import { useState } from 'react';
import GalleryLightbox from './GalleryLightbox';

export default function StorefrontGalleryUI({ images = [], title, theme, isRTL }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    if (!images || images.length === 0) return null;

    return (
        <div className="mt-12">
            <h3 className={`text-2xl font-black mb-6 flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="w-2 h-8 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                {title}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                {images.slice(0, 8).map((img, i) => (
                    <div 
                        key={i} 
                        className="relative pb-[100%] rounded-xl overflow-hidden cursor-pointer group bg-slate-100 dark:bg-slate-800"
                        onClick={() => { setCurrentIndex(i); setIsOpen(true); }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src={img} 
                            alt={`Gallery image ${i + 1}`} 
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                        />
                        {i === 7 && images.length > 8 && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <span className="text-white font-bold text-xl md:text-2xl">+{images.length - 8}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            <GalleryLightbox 
                images={images} 
                initialIndex={currentIndex} 
                isOpen={isOpen} 
                onClose={() => setIsOpen(false)} 
            />
        </div>
    );
}
