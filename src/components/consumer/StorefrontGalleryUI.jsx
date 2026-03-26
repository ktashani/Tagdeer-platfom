'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react';
import GalleryLightbox from './GalleryLightbox';

/**
 * StorefrontGalleryUI — Premium horizontal carousel gallery with lightbox.
 * - Invisible when no images (returns null)
 * - Horizontal snap scroll, 3 images visible on desktop, 1.3 on mobile
 * - Click any image to open lightbox
 * - "View All" button opens masonry popup
 * - Mobile swipeable with scroll-snap
 */
export default function StorefrontGalleryUI({ images = [], title, theme, isRTL }) {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [showAllModal, setShowAllModal] = useState(false);
    const scrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    const primaryColor = theme?.primaryColor || '#10b981';

    // Return nothing if no images
    if (!images || images.length === 0) return null;

    const checkScrollability = () => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 10);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    };

    const scroll = (direction) => {
        const el = scrollRef.current;
        if (!el) return;
        const cardWidth = el.querySelector('[data-gallery-item]')?.offsetWidth || 300;
        el.scrollBy({ left: direction * cardWidth * 2, behavior: 'smooth' });
    };

    const openLightbox = (index) => {
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    return (
        <>
            <div className="mt-12">
                {/* Section Header */}
                <div className={`flex items-center justify-between mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <h3 className={`text-2xl font-black flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className="w-2 h-8 rounded-full" style={{ backgroundColor: primaryColor }} />
                        {title}
                        <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                            ({images.length})
                        </span>
                    </h3>
                    {images.length > 3 && (
                        <button
                            onClick={() => setShowAllModal(true)}
                            className={`text-sm font-bold flex items-center gap-2 hover:opacity-70 transition-opacity ${isRTL ? 'flex-row-reverse' : ''}`}
                            style={{ color: primaryColor }}
                        >
                            <Images className="w-4 h-4" />
                            {isRTL ? 'عرض الكل' : 'View All'}
                        </button>
                    )}
                </div>

                {/* Horizontal Carousel */}
                <div className="relative group">
                    {/* Desktop Navigation Arrows */}
                    {canScrollLeft && (
                        <button
                            onClick={() => scroll(-1)}
                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-20 w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all opacity-0 group-hover:opacity-100 hidden md:flex"
                            aria-label="Scroll left"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}
                    {canScrollRight && (
                        <button
                            onClick={() => scroll(1)}
                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-20 w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all opacity-0 group-hover:opacity-100 hidden md:flex"
                            aria-label="Scroll right"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    )}

                    {/* Scrollable Container */}
                    <div
                        ref={scrollRef}
                        onScroll={checkScrollability}
                        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                        dir={isRTL ? 'rtl' : 'ltr'}
                    >
                        {images.map((img, i) => (
                            <div
                                key={i}
                                data-gallery-item
                                className="snap-start shrink-0 w-[75vw] sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.5rem)] cursor-pointer group/item"
                                onClick={() => openLightbox(i)}
                            >
                                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={img}
                                        alt={`${title} ${i + 1}`}
                                        className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-500"
                                        loading="lazy"
                                    />
                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover/item:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-slate-900/90 flex items-center justify-center opacity-0 group-hover/item:opacity-100 scale-75 group-hover/item:scale-100 transition-all duration-300 shadow-lg">
                                            <Images className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Scroll Progress Bar (mobile) */}
                    {images.length > 1 && (
                        <div className="flex justify-center gap-1.5 mt-3 md:hidden">
                            {images.slice(0, Math.min(images.length, 8)).map((_, i) => (
                                <div
                                    key={i}
                                    className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"
                                />
                            ))}
                            {images.length > 8 && (
                                <span className="text-[10px] text-slate-400 ml-1">+{images.length - 8}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            <GalleryLightbox
                images={images}
                initialIndex={lightboxIndex}
                isOpen={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
            />

            {/* View All Modal — Full gallery in masonry grid */}
            {showAllModal && (
                <div
                    className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
                    onClick={() => setShowAllModal(false)}
                >
                    <div className="min-h-full py-8 px-4 md:px-8">
                        {/* Header */}
                        <div className="max-w-5xl mx-auto flex items-center justify-between mb-6">
                            <h2 className="text-white text-xl font-black flex items-center gap-3">
                                <Images className="w-5 h-5" />
                                {title} ({images.length})
                            </h2>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowAllModal(false); }}
                                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Masonry Grid */}
                        <div
                            className="max-w-5xl mx-auto columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {images.map((img, i) => (
                                <div
                                    key={i}
                                    className="break-inside-avoid rounded-xl overflow-hidden cursor-pointer group bg-slate-800 hover:ring-2 hover:ring-white/30 transition-all"
                                    onClick={() => { setShowAllModal(false); openLightbox(i); }}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={img}
                                        alt={`${title} ${i + 1}`}
                                        className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                                        loading="lazy"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
